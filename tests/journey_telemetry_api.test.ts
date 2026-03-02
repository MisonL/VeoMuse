import { afterEach, describe, expect, it } from 'bun:test'
import { app } from '../apps/backend/src/index'
import { getLocalDb } from '../apps/backend/src/services/LocalDatabaseService'
import { createAuthHeaders, createTestSession } from './helpers/auth'

describe('旅程埋点 API', () => {
  const sessionPrefix = `test-journey-${Date.now()}`

  afterEach(() => {
    getLocalDb().prepare(`DELETE FROM journey_runs WHERE session_id LIKE ?`).run(`${sessionPrefix}%`)
  })

  it('未登录时上报旅程应返回 401', async () => {
    const response = await app.handle(new Request('http://localhost/api/telemetry/journey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flowType: 'first_success_path',
        source: 'frontend',
        stepCount: 3,
        success: true
      })
    }))
    const payload = await response.json() as any
    expect(response.status).toBe(401)
    expect(payload.success).toBe(false)
  })

  it('stepCount 非法时应返回 400', async () => {
    const session = await createTestSession('journey-step-invalid')
    const response = await app.handle(new Request('http://localhost/api/telemetry/journey', {
      method: 'POST',
      headers: createAuthHeaders(session.accessToken, {
        organizationId: session.organizationId,
        contentTypeJson: true
      }),
      body: JSON.stringify({
        flowType: 'first_success_path',
        source: 'frontend',
        stepCount: 0,
        success: true
      })
    }))
    expect(response.status).toBe(400)
  })

  it('应支持组织成员上报旅程并持久化', async () => {
    const session = await createTestSession('journey-success')
    const journeySessionId = `${sessionPrefix}-ok`

    const response = await app.handle(new Request('http://localhost/api/telemetry/journey', {
      method: 'POST',
      headers: createAuthHeaders(session.accessToken, {
        organizationId: session.organizationId,
        contentTypeJson: true
      }),
      body: JSON.stringify({
        flowType: 'first_success_path',
        source: 'frontend',
        stepCount: 4,
        success: true,
        durationMs: 2100,
        sessionId: journeySessionId
      })
    }))
    const payload = await response.json() as any

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.journey?.flowType).toBe('first_success_path')
    expect(payload.journey?.sessionId).toBe(journeySessionId)
    expect(payload.journey?.stepCount).toBe(4)
    expect(payload.journey?.organizationId).toBe(session.organizationId)

    const row = getLocalDb()
      .prepare(`SELECT organization_id, step_count, success FROM journey_runs WHERE session_id = ? ORDER BY created_at DESC LIMIT 1`)
      .get(journeySessionId) as { organization_id: string; step_count: number; success: number } | null

    expect(row).toBeTruthy()
    expect(row?.organization_id).toBe(session.organizationId)
    expect(row?.step_count).toBe(4)
    expect(row?.success).toBe(1)
  })

  it('非工作区成员上报携带 workspaceId 时应返回 403', async () => {
    const owner = await createTestSession('journey-owner')
    const outsider = await createTestSession('journey-outsider')

    const createWorkspaceResp = await app.handle(new Request('http://localhost/api/workspaces', {
      method: 'POST',
      headers: createAuthHeaders(owner.accessToken, {
        organizationId: owner.organizationId,
        contentTypeJson: true
      }),
      body: JSON.stringify({
        name: 'Journey Workspace',
        ownerName: 'Owner'
      })
    }))
    const createWorkspaceData = await createWorkspaceResp.json() as any
    expect(createWorkspaceResp.status).toBe(200)
    const workspaceId = createWorkspaceData.workspace?.id as string
    expect(typeof workspaceId).toBe('string')

    const response = await app.handle(new Request('http://localhost/api/telemetry/journey', {
      method: 'POST',
      headers: createAuthHeaders(outsider.accessToken, {
        organizationId: outsider.organizationId,
        contentTypeJson: true
      }),
      body: JSON.stringify({
        flowType: 'first_success_path',
        source: 'frontend',
        stepCount: 3,
        success: false,
        workspaceId,
        sessionId: `${sessionPrefix}-forbidden`
      })
    }))
    const payload = await response.json() as any

    expect(response.status).toBe(403)
    expect(payload.success).toBe(false)
    expect(String(payload.error || '')).toContain('workspace membership required')
  })
})
