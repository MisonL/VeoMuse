import { describe, expect, it } from 'bun:test'
import { CollaborationV4Service } from '../apps/backend/src/services/CollaborationV4Service'
import { CreativeWorkflowService } from '../apps/backend/src/services/CreativeWorkflowService'
import { getLocalDb } from '../apps/backend/src/services/LocalDatabaseService'
import { WorkspaceService } from '../apps/backend/src/services/WorkspaceService'

const makeCaseId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

describe('V4 分页游标稳定性（服务层）', () => {
  it('评论线程分页应返回复合游标并兼容旧时间戳游标', () => {
    const workspace = WorkspaceService.createWorkspace(makeCaseId('cursor-collab'), 'Owner Cursor')
    const projectId = String(workspace.defaultProject?.id || '')
    expect(projectId.startsWith('prj_')).toBe(true)

    const threadA = CollaborationV4Service.createCommentThread(projectId, 'Owner Cursor', {
      content: 'thread-a'
    })
    const threadB = CollaborationV4Service.createCommentThread(projectId, 'Owner Cursor', {
      content: 'thread-b'
    })

    const sameTimestamp = new Date().toISOString()
    getLocalDb()
      .prepare(`UPDATE project_comments SET created_at = ?, updated_at = ? WHERE id IN (?, ?)`)
      .run(sameTimestamp, sameTimestamp, threadA.id, threadB.id)

    const page1 = CollaborationV4Service.listCommentThreadsPage(projectId, undefined, 1)
    expect(page1.threads.length).toBe(1)
    expect(page1.page.hasMore).toBe(true)
    expect(typeof page1.page.nextCursor).toBe('string')

    const cursor = String(page1.page.nextCursor || '')
    expect(cursor.includes('|')).toBe(true)

    const legacyCursor = cursor.split('|')[0] || cursor
    const legacyPage = CollaborationV4Service.listCommentThreadsPage(projectId, legacyCursor, 1)
    expect(Array.isArray(legacyPage.threads)).toBe(true)

    const page2 = CollaborationV4Service.listCommentThreadsPage(projectId, cursor, 1)
    expect(page2.threads.length).toBe(1)

    const ids = new Set([page1.threads[0]?.id, page2.threads[0]?.id].filter(Boolean))
    expect(ids.size).toBe(2)
    expect(ids.has(threadA.id)).toBe(true)
    expect(ids.has(threadB.id)).toBe(true)
  })

  it('工作流运行分页应返回复合游标并兼容旧时间戳游标', () => {
    const workflow = CreativeWorkflowService.createPromptWorkflow({
      organizationId: 'org_default',
      name: makeCaseId('cursor-workflow'),
      description: 'cursor stability check',
      definition: { template: 'hello {{target}}' },
      createdBy: 'cursor-test'
    })

    const runA = CreativeWorkflowService.runPromptWorkflow(workflow.id, {
      organizationId: 'org_default',
      triggerType: 'manual',
      input: { target: 'A' },
      createdBy: 'cursor-test'
    })
    const runB = CreativeWorkflowService.runPromptWorkflow(workflow.id, {
      organizationId: 'org_default',
      triggerType: 'manual',
      input: { target: 'B' },
      createdBy: 'cursor-test'
    })

    const sameTimestamp = new Date().toISOString()
    getLocalDb()
      .prepare(`UPDATE prompt_workflow_runs SET created_at = ? WHERE id IN (?, ?)`)
      .run(sameTimestamp, runA.id, runB.id)

    const page1 = CreativeWorkflowService.listPromptWorkflowRuns({
      organizationId: 'org_default',
      workflowId: workflow.id,
      limit: 1
    })
    expect(page1.runs.length).toBe(1)
    expect(page1.page.hasMore).toBe(true)
    expect(typeof page1.page.nextCursor).toBe('string')

    const cursor = String(page1.page.nextCursor || '')
    expect(cursor.includes('|')).toBe(true)

    const legacyCursor = cursor.split('|')[0] || cursor
    const legacyPage = CreativeWorkflowService.listPromptWorkflowRuns({
      organizationId: 'org_default',
      workflowId: workflow.id,
      limit: 1,
      cursor: legacyCursor
    })
    expect(Array.isArray(legacyPage.runs)).toBe(true)

    const page2 = CreativeWorkflowService.listPromptWorkflowRuns({
      organizationId: 'org_default',
      workflowId: workflow.id,
      limit: 1,
      cursor
    })
    expect(page2.runs.length).toBe(1)

    const ids = new Set([page1.runs[0]?.id, page2.runs[0]?.id].filter(Boolean))
    expect(ids.size).toBe(2)
    expect(ids.has(runA.id)).toBe(true)
    expect(ids.has(runB.id)).toBe(true)
  })
})
