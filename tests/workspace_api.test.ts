import { describe, expect, it } from 'bun:test'
import { app } from '../apps/backend/src/index'
import { createAuthHeaders, createTestSession } from './helpers/auth'

describe('工作区协作 API 回归', () => {
  it('应支持创建工作区、成员管理与项目审计查询', async () => {
    const owner = await createTestSession('workspace-owner')
    const createIdempotencyKey = `workspace-create-${Date.now()}`
    const createResp = await app.handle(
      new Request('http://localhost/api/workspaces', {
        method: 'POST',
        headers: createAuthHeaders(owner.accessToken, {
          organizationId: owner.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          name: 'VeoMuse 团队空间',
          ownerName: 'Owner A',
          idempotencyKey: createIdempotencyKey
        })
      })
    )
    const createData = (await createResp.json()) as any
    expect(createResp.status).toBe(200)
    expect(createData.success).toBe(true)
    expect(createData.workspace?.id).toContain('ws_')
    expect(createData.defaultProject?.id).toContain('prj_')
    expect(createData.owner?.role).toBe('owner')

    const duplicateCreateResp = await app.handle(
      new Request('http://localhost/api/workspaces', {
        method: 'POST',
        headers: createAuthHeaders(owner.accessToken, {
          organizationId: owner.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          name: 'VeoMuse 团队空间',
          ownerName: 'Owner A',
          idempotencyKey: createIdempotencyKey
        })
      })
    )
    const duplicateCreateData = (await duplicateCreateResp.json()) as any
    expect(duplicateCreateResp.status).toBe(200)
    expect(duplicateCreateData.success).toBe(true)
    expect(duplicateCreateData.workspace?.id).toBe(createData.workspace?.id)
    expect(duplicateCreateData.defaultProject?.id).toBe(createData.defaultProject?.id)

    const workspaceId = createData.workspace.id as string
    const projectId = createData.defaultProject.id as string

    const createProjectResp = await app.handle(
      new Request('http://localhost/api/projects', {
        method: 'POST',
        headers: createAuthHeaders(owner.accessToken, {
          organizationId: owner.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          workspaceId,
          name: 'VeoMuse 子项目 A'
        })
      })
    )
    const createProjectData = (await createProjectResp.json()) as any
    expect(createProjectResp.status).toBe(200)
    expect(createProjectData.success).toBe(true)
    expect(createProjectData.project?.id).toContain('prj_')
    expect(createProjectData.project?.workspaceId).toBe(workspaceId)
    expect(createProjectData.project?.name).toBe('VeoMuse 子项目 A')

    const createdProjectId = createProjectData.project.id as string

    const membersUnauthorizedResp = await app.handle(
      new Request(`http://localhost/api/workspaces/${workspaceId}/members`)
    )
    expect(membersUnauthorizedResp.status).toBe(401)

    const membersResp = await app.handle(
      new Request(`http://localhost/api/workspaces/${workspaceId}/members`, {
        headers: createAuthHeaders(owner.accessToken, { organizationId: owner.organizationId })
      })
    )
    const membersData = (await membersResp.json()) as any
    expect(membersResp.status).toBe(200)
    expect(membersData.success).toBe(true)
    expect(membersData.members.length).toBeGreaterThanOrEqual(1)

    const forbiddenResp = await app.handle(
      new Request(`http://localhost/api/workspaces/${workspaceId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Editor B',
          role: 'editor'
        })
      })
    )
    expect(forbiddenResp.status).toBe(401)

    const addResp = await app.handle(
      new Request(`http://localhost/api/workspaces/${workspaceId}/members`, {
        method: 'POST',
        headers: createAuthHeaders(owner.accessToken, {
          organizationId: owner.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          name: 'Editor B',
          role: 'editor'
        })
      })
    )
    const addData = (await addResp.json()) as any
    expect(addResp.status).toBe(200)
    expect(addData.success).toBe(true)
    expect(
      addData.members.some((member: any) => member.name === 'Editor B' && member.role === 'editor')
    ).toBe(true)

    const projectsResp = await app.handle(
      new Request(`http://localhost/api/workspaces/${workspaceId}/projects`, {
        headers: createAuthHeaders(owner.accessToken, { organizationId: owner.organizationId })
      })
    )
    const projectsData = (await projectsResp.json()) as any
    expect(projectsResp.status).toBe(200)
    expect(projectsData.success).toBe(true)
    expect(projectsData.projects.some((project: any) => project.id === projectId)).toBe(true)
    expect(projectsData.projects.some((project: any) => project.id === createdProjectId)).toBe(true)

    const auditResp = await app.handle(
      new Request(`http://localhost/api/projects/${projectId}/audit`, {
        headers: createAuthHeaders(owner.accessToken, { organizationId: owner.organizationId })
      })
    )
    const auditData = (await auditResp.json()) as any
    expect(auditResp.status).toBe(200)
    expect(auditData.success).toBe(true)
    expect(auditData.logs.some((log: any) => log.action === 'workspace.created')).toBe(true)

    const createdProjectAuditResp = await app.handle(
      new Request(`http://localhost/api/projects/${createdProjectId}/audit`, {
        headers: createAuthHeaders(owner.accessToken, { organizationId: owner.organizationId })
      })
    )
    const createdProjectAuditData = (await createdProjectAuditResp.json()) as any
    expect(createdProjectAuditResp.status).toBe(200)
    expect(createdProjectAuditData.success).toBe(true)
    expect(createdProjectAuditData.logs.some((log: any) => log.action === 'project.created')).toBe(
      true
    )
  }, 30_000)
})
