import { describe, expect, it } from 'bun:test'
import { app } from '../apps/backend/src/index'

describe('工作区协作 API 回归', () => {
  it('应支持创建工作区、成员管理与项目审计查询', async () => {
    const createResp = await app.handle(
      new Request('http://localhost/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'VeoMuse 团队空间',
          ownerName: 'Owner A'
        })
      })
    )
    const createData = await createResp.json() as any
    expect(createResp.status).toBe(200)
    expect(createData.success).toBe(true)
    expect(createData.workspace?.id).toContain('ws_')
    expect(createData.defaultProject?.id).toContain('prj_')
    expect(createData.owner?.role).toBe('owner')

    const workspaceId = createData.workspace.id as string
    const projectId = createData.defaultProject.id as string

    const membersResp = await app.handle(new Request(`http://localhost/api/workspaces/${workspaceId}/members`))
    const membersData = await membersResp.json() as any
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
    expect(forbiddenResp.status).toBe(403)

    const addResp = await app.handle(
      new Request(`http://localhost/api/workspaces/${workspaceId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-actor': 'Owner A'
        },
        body: JSON.stringify({
          name: 'Editor B',
          role: 'editor'
        })
      })
    )
    const addData = await addResp.json() as any
    expect(addResp.status).toBe(200)
    expect(addData.success).toBe(true)
    expect(addData.members.some((member: any) => member.name === 'Editor B' && member.role === 'editor')).toBe(true)

    const projectsResp = await app.handle(new Request(`http://localhost/api/workspaces/${workspaceId}/projects`))
    const projectsData = await projectsResp.json() as any
    expect(projectsResp.status).toBe(200)
    expect(projectsData.success).toBe(true)
    expect(projectsData.projects.some((project: any) => project.id === projectId)).toBe(true)

    const auditResp = await app.handle(new Request(`http://localhost/api/projects/${projectId}/audit`))
    const auditData = await auditResp.json() as any
    expect(auditResp.status).toBe(200)
    expect(auditData.success).toBe(true)
    expect(auditData.logs.some((log: any) => log.action === 'workspace.created')).toBe(true)
  })
})
