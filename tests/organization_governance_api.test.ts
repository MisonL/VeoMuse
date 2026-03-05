import { describe, expect, it } from 'bun:test'
import { app } from '../apps/backend/src/index'
import { VideoOrchestrator } from '../apps/backend/src/services/VideoOrchestrator'
import { createAuthHeaders, createTestSession } from './helpers/auth'

VideoOrchestrator.registerDriver({
  id: 'test-fast-noop',
  name: 'Test Fast Noop Driver',
  async generate() {
    return {
      success: true,
      status: 'ok',
      operationName: 'test-fast-noop-operation',
      message: 'noop',
      provider: 'test-fast-noop'
    }
  }
})

describe('组织治理与配额 API', () => {
  it('应支持组织配额读写权限控制（member 可读、admin 可写）', async () => {
    const owner = await createTestSession('org-governance-owner')
    const member = await createTestSession('org-governance-member')

    const addMemberResp = await app.handle(
      new Request(`http://localhost/api/organizations/${owner.organizationId}/members`, {
        method: 'POST',
        headers: createAuthHeaders(owner.accessToken, {
          organizationId: owner.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          email: member.email,
          role: 'member'
        })
      })
    )
    expect(addMemberResp.status).toBe(200)

    const memberReadResp = await app.handle(
      new Request(`http://localhost/api/organizations/${owner.organizationId}/quota`, {
        headers: createAuthHeaders(member.accessToken, {
          organizationId: owner.organizationId
        })
      })
    )
    const memberReadData = (await memberReadResp.json()) as any
    expect(memberReadResp.status).toBe(200)
    expect(memberReadData.success).toBe(true)
    expect(memberReadData.quota.organizationId).toBe(owner.organizationId)

    const memberWriteResp = await app.handle(
      new Request(`http://localhost/api/organizations/${owner.organizationId}/quota`, {
        method: 'PUT',
        headers: createAuthHeaders(member.accessToken, {
          organizationId: owner.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          requestLimit: 10,
          storageLimitBytes: 1024,
          concurrencyLimit: 2
        })
      })
    )
    expect(memberWriteResp.status).toBe(403)

    const ownerWriteResp = await app.handle(
      new Request(`http://localhost/api/organizations/${owner.organizationId}/quota`, {
        method: 'PUT',
        headers: createAuthHeaders(owner.accessToken, {
          organizationId: owner.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          requestLimit: 11,
          storageLimitBytes: 2048,
          concurrencyLimit: 3
        })
      })
    )
    const ownerWriteData = (await ownerWriteResp.json()) as any
    expect(ownerWriteResp.status).toBe(200)
    expect(ownerWriteData.success).toBe(true)
    expect(ownerWriteData.quota.requestLimit).toBe(11)
    expect(ownerWriteData.quota.storageLimitBytes).toBe(2048)
    expect(ownerWriteData.quota.concurrencyLimit).toBe(3)
  })

  it('应在请求配额耗尽后阻断视频生成', async () => {
    const session = await createTestSession('org-governance-request')

    const setQuotaResp = await app.handle(
      new Request(`http://localhost/api/organizations/${session.organizationId}/quota`, {
        method: 'PUT',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          requestLimit: 1,
          storageLimitBytes: 0,
          concurrencyLimit: 0
        })
      })
    )
    expect(setQuotaResp.status).toBe(200)

    const firstGenerateResp = await app.handle(
      new Request('http://localhost/api/video/generate', {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          text: '第一次请求应放行',
          modelId: 'test-fast-noop'
        })
      })
    )
    expect(firstGenerateResp.status).toBe(200)

    const secondGenerateResp = await app.handle(
      new Request('http://localhost/api/video/generate', {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          text: '第二次请求应触发配额',
          modelId: 'test-fast-noop'
        })
      })
    )
    const secondGenerateData = (await secondGenerateResp.json()) as any
    expect(secondGenerateResp.status).toBe(429)
    expect(secondGenerateData.code).toBe('QUOTA_EXCEEDED')
    expect(secondGenerateData.reason).toBe('request')
  }, 15000)

  it('应在存储配额耗尽后阻断本地导入', async () => {
    const session = await createTestSession('org-governance-storage')

    const setQuotaResp = await app.handle(
      new Request(`http://localhost/api/organizations/${session.organizationId}/quota`, {
        method: 'PUT',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          requestLimit: 0,
          storageLimitBytes: 12,
          concurrencyLimit: 0
        })
      })
    )
    expect(setQuotaResp.status).toBe(200)

    const firstImportResp = await app.handle(
      new Request('http://localhost/api/storage/local-import', {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          fileName: 'a.txt',
          base64Data: Buffer.from('12345678').toString('base64')
        })
      })
    )
    const firstImportData = (await firstImportResp.json()) as any
    expect(firstImportResp.status).toBe(200)
    expect(firstImportData.success).toBe(true)

    const secondImportResp = await app.handle(
      new Request('http://localhost/api/storage/local-import', {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          fileName: 'b.txt',
          base64Data: Buffer.from('ABCDEFGH').toString('base64')
        })
      })
    )
    const secondImportData = (await secondImportResp.json()) as any
    expect(secondImportResp.status).toBe(429)
    expect(secondImportData.code).toBe('QUOTA_EXCEEDED')
    expect(secondImportData.reason).toBe('storage')
  })

  it('应支持审计导出并确保组织隔离', async () => {
    const ownerA = await createTestSession('org-governance-audit-a')
    const ownerB = await createTestSession('org-governance-audit-b')

    const createOrgAChannelResp = await app.handle(
      new Request(
        `http://localhost/api/organizations/${ownerA.organizationId}/channels/openai-compatible`,
        {
          method: 'PUT',
          headers: createAuthHeaders(ownerA.accessToken, {
            organizationId: ownerA.organizationId,
            contentTypeJson: true
          }),
          body: JSON.stringify({
            enabled: false
          })
        }
      )
    )
    expect(createOrgAChannelResp.status).toBe(200)

    const workspaceResp = await app.handle(
      new Request('http://localhost/api/workspaces', {
        method: 'POST',
        headers: createAuthHeaders(ownerA.accessToken, {
          organizationId: ownerA.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          name: '审计导出工作区',
          ownerName: 'Owner A'
        })
      })
    )
    const workspaceData = (await workspaceResp.json()) as any
    expect(workspaceResp.status).toBe(200)

    const projectId = workspaceData.defaultProject.id as string
    const snapshotResp = await app.handle(
      new Request(`http://localhost/api/projects/${projectId}/snapshots`, {
        method: 'POST',
        headers: createAuthHeaders(ownerA.accessToken, {
          organizationId: ownerA.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          content: {
            scene: 'audit-export'
          }
        })
      })
    )
    expect(snapshotResp.status).toBe(200)

    const createOrgBChannelResp = await app.handle(
      new Request(
        `http://localhost/api/organizations/${ownerB.organizationId}/channels/openai-compatible`,
        {
          method: 'PUT',
          headers: createAuthHeaders(ownerB.accessToken, {
            organizationId: ownerB.organizationId,
            contentTypeJson: true
          }),
          body: JSON.stringify({
            enabled: false
          })
        }
      )
    )
    expect(createOrgBChannelResp.status).toBe(200)

    const exportJsonResp = await app.handle(
      new Request(
        `http://localhost/api/organizations/${ownerA.organizationId}/audits/export?format=json&scope=all&limit=200`,
        {
          headers: createAuthHeaders(ownerA.accessToken, {
            organizationId: ownerA.organizationId
          })
        }
      )
    )
    const exportJsonData = (await exportJsonResp.json()) as any
    expect(exportJsonResp.status).toBe(200)
    expect(exportJsonData.success).toBe(true)
    expect(Array.isArray(exportJsonData.records)).toBe(true)
    expect(exportJsonData.records.length).toBeGreaterThan(0)
    expect(
      exportJsonData.records.every((item: any) => item.organizationId === ownerA.organizationId)
    ).toBe(true)
    expect(exportJsonData.records.some((item: any) => item.source === 'channel')).toBe(true)
    expect(exportJsonData.records.some((item: any) => item.source === 'workspace')).toBe(true)
    const channelRecords = exportJsonData.records.filter((item: any) => item.source === 'channel')
    expect(channelRecords.length).toBeGreaterThan(0)
    expect(channelRecords.some((item: any) => String(item.traceId || '').trim().length > 0)).toBe(
      true
    )

    const exportCsvResp = await app.handle(
      new Request(
        `http://localhost/api/organizations/${ownerA.organizationId}/audits/export?format=csv&scope=all&limit=200`,
        {
          headers: createAuthHeaders(ownerA.accessToken, {
            organizationId: ownerA.organizationId
          })
        }
      )
    )
    const exportCsvText = await exportCsvResp.text()
    expect(exportCsvResp.status).toBe(200)
    expect(exportCsvResp.headers.get('content-type') || '').toContain('text/csv')
    expect(exportCsvText).toContain('organizationId')
    expect(exportCsvText).toContain(ownerA.organizationId)
    expect(exportCsvText).not.toContain(ownerB.organizationId)
  })
})
