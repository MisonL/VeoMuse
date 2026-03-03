import { describe, expect, it } from 'bun:test'
import { app } from '../apps/backend/src/index'
import { createAuthHeaders, createTestSession } from './helpers/auth'

describe('P2 端到端主路径回归', () => {
  it('应串通策略治理 -> 创意 run -> 协作邀请 -> 本地上传链路', async () => {
    const owner = await createTestSession('p2-owner')
    const editor = await createTestSession('p2-editor')

    const policyResp = await app.handle(
      new Request('http://localhost/api/models/policies', {
        method: 'POST',
        headers: createAuthHeaders(owner.accessToken, {
          organizationId: owner.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          name: 'P2-E2E-Policy',
          priority: 'quality',
          maxBudgetUsd: 1.5,
          allowedModels: ['veo-3.1', 'luma-dream']
        })
      })
    )
    const policyData = (await policyResp.json()) as any
    expect(policyResp.status).toBe(200)
    expect(policyData.success).toBe(true)
    const policyId = policyData.policy.id as string

    const decisionResp = await app.handle(
      new Request(`http://localhost/api/models/policies/${policyId}/simulate`, {
        method: 'POST',
        headers: createAuthHeaders(owner.accessToken, {
          organizationId: owner.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          prompt: '都市夜景追车镜头，8秒',
          budgetUsd: 1.2
        })
      })
    )
    const decisionData = (await decisionResp.json()) as any
    expect(decisionResp.status).toBe(200)
    expect(decisionData.success).toBe(true)
    expect(decisionData.decision.policyId).toBe(policyId)

    const runResp = await app.handle(
      new Request('http://localhost/api/ai/creative/run', {
        method: 'POST',
        headers: createAuthHeaders(owner.accessToken, {
          organizationId: owner.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          script: '城市夜景，主角穿梭人群，最后定格在霓虹招牌前。',
          style: 'cinematic',
          context: {
            routingPolicyId: policyId,
            routingDecision: decisionData.decision
          }
        })
      })
    )
    const runData = (await runResp.json()) as any
    expect(runResp.status).toBe(200)
    expect(runData.success).toBe(true)
    expect(runData.run.notes?.context?.routingPolicyId).toBe(policyId)
    expect(runData.run.notes?.context?.routingDecision?.policyId).toBe(policyId)

    const workspaceResp = await app.handle(
      new Request('http://localhost/api/workspaces', {
        method: 'POST',
        headers: createAuthHeaders(owner.accessToken, {
          organizationId: owner.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          name: 'P2-E2E-Workspace',
          ownerName: 'Owner P2'
        })
      })
    )
    const workspaceData = (await workspaceResp.json()) as any
    expect(workspaceResp.status).toBe(200)
    expect(workspaceData.success).toBe(true)
    const workspaceId = workspaceData.workspace.id as string
    const projectId = workspaceData.defaultProject.id as string

    const inviteResp = await app.handle(
      new Request(`http://localhost/api/workspaces/${workspaceId}/invites`, {
        method: 'POST',
        headers: createAuthHeaders(owner.accessToken, {
          organizationId: owner.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({ role: 'editor' })
      })
    )
    const inviteData = (await inviteResp.json()) as any
    expect(inviteResp.status).toBe(200)
    expect(inviteData.success).toBe(true)

    const acceptResp = await app.handle(
      new Request(`http://localhost/api/workspaces/invites/${inviteData.invite.code}/accept`, {
        method: 'POST',
        headers: createAuthHeaders(editor.accessToken, {
          organizationId: editor.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({ memberName: 'Editor P2' })
      })
    )
    const acceptData = (await acceptResp.json()) as any
    expect(acceptResp.status).toBe(200)
    expect(acceptData.success).toBe(true)
    expect(acceptData.workspace.id).toBe(workspaceId)
    expect(acceptData.defaultProject.id).toBe(projectId)

    const tokenResp = await app.handle(
      new Request('http://localhost/api/storage/upload-token', {
        method: 'POST',
        headers: createAuthHeaders(editor.accessToken, {
          organizationId: editor.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          workspaceId,
          projectId,
          fileName: 'p2-e2e.mp4',
          contentType: 'video/mp4'
        })
      })
    )
    const tokenData = (await tokenResp.json()) as any
    expect(tokenResp.status).toBe(200)
    expect(tokenData.success).toBe(true)

    const uploadResp = await app.handle(
      new Request(`http://localhost${tokenData.token.uploadUrl}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
          Authorization: `Bearer ${editor.accessToken}`
        },
        body: 'p2-e2e-binary'
      })
    )
    const uploadData = (await uploadResp.json()) as any
    expect(uploadResp.status).toBe(201)
    expect(uploadData.success).toBe(true)
    expect(uploadData.uploaded.objectKey).toBe(tokenData.token.objectKey)
  })
})
