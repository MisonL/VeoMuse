import { describe, expect, it } from 'bun:test'
import { CollaborationV4Service } from '../apps/backend/src/services/CollaborationV4Service'
import { CreativeWorkflowService } from '../apps/backend/src/services/CreativeWorkflowService'
import { getLocalDb } from '../apps/backend/src/services/LocalDatabaseService'
import { WorkspaceService } from '../apps/backend/src/services/WorkspaceService'

const makeCaseId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

describe('V4 列表查询性能优化语义回归（服务层）', () => {
  it('评论线程列表应保持分页语义并正确回填 replyCount', () => {
    const workspace = WorkspaceService.createWorkspace(
      makeCaseId('v4-perf-comment'),
      'Perf Comment Owner'
    )
    const projectId = String(workspace.defaultProject?.id || '')
    expect(projectId.startsWith('prj_')).toBe(true)

    const threadA = CollaborationV4Service.createCommentThread(projectId, 'Perf Comment Owner', {
      content: 'thread-a'
    })
    const threadB = CollaborationV4Service.createCommentThread(projectId, 'Perf Comment Owner', {
      content: 'thread-b'
    })
    const threadC = CollaborationV4Service.createCommentThread(projectId, 'Perf Comment Owner', {
      content: 'thread-c'
    })

    CollaborationV4Service.createCommentReply(projectId, threadA.id, 'Perf Comment Owner', {
      content: 'a-1'
    })
    CollaborationV4Service.createCommentReply(projectId, threadA.id, 'Perf Comment Owner', {
      content: 'a-2'
    })
    CollaborationV4Service.createCommentReply(projectId, threadB.id, 'Perf Comment Owner', {
      content: 'b-1'
    })

    const forcedTimestamp = new Date().toISOString()
    getLocalDb()
      .prepare(`UPDATE project_comments SET created_at = ?, updated_at = ? WHERE id IN (?, ?, ?)`)
      .run(forcedTimestamp, forcedTimestamp, threadA.id, threadB.id, threadC.id)

    const page1 = CollaborationV4Service.listCommentThreadsPage(projectId, undefined, 1)
    expect(page1.threads.length).toBe(1)
    expect(page1.page.hasMore).toBe(true)
    expect(typeof page1.page.nextCursor).toBe('string')
    const cursor1 = String(page1.page.nextCursor || '')
    expect(cursor1.includes('|')).toBe(true)

    const legacyCursor = cursor1.split('|')[0] || cursor1
    const legacyPage = CollaborationV4Service.listCommentThreadsPage(projectId, legacyCursor, 1)
    expect(Array.isArray(legacyPage.threads)).toBe(true)

    const page2 = CollaborationV4Service.listCommentThreadsPage(projectId, cursor1, 1)
    expect(page2.threads.length).toBe(1)
    expect(page2.page.hasMore).toBe(true)
    expect(typeof page2.page.nextCursor).toBe('string')
    const cursor2 = String(page2.page.nextCursor || '')
    expect(cursor2.includes('|')).toBe(true)

    const page3 = CollaborationV4Service.listCommentThreadsPage(projectId, cursor2, 1)
    expect(page3.threads.length).toBe(1)
    expect(page3.page.hasMore).toBe(false)
    expect(page3.page.nextCursor).toBe(null)

    const combinedThreads = [...page1.threads, ...page2.threads, ...page3.threads]
    const combinedIds = combinedThreads.map((thread) => thread.id)
    expect(new Set(combinedIds).size).toBe(3)

    const expectedOrder = getLocalDb()
      .prepare(
        `
      SELECT id
      FROM project_comments
      WHERE project_id = ?
      ORDER BY created_at DESC, id DESC
    `
      )
      .all(projectId)
      .map((row: any) => String(row.id))
    expect(combinedIds).toEqual(expectedOrder)

    const replyCountByThreadId = new Map(
      combinedThreads.map((thread) => [thread.id, thread.replyCount] as const)
    )
    expect(replyCountByThreadId.get(threadA.id)).toBe(2)
    expect(replyCountByThreadId.get(threadB.id)).toBe(1)
    expect(replyCountByThreadId.get(threadC.id)).toBe(0)
  })

  it('批处理任务列表应保持分页语义并正确聚合 items', () => {
    const organizationId = makeCaseId('v4-perf-org')
    const jobType = 'creative.render'

    const jobA = CreativeWorkflowService.createBatchJob({
      organizationId,
      jobType,
      createdBy: 'perf-batch-owner',
      items: [
        { itemKey: 'shot-a-1', input: { durationSec: 8 } },
        { itemKey: 'shot-a-2', input: { durationSec: 6 } }
      ]
    })
    const jobB = CreativeWorkflowService.createBatchJob({
      organizationId,
      jobType,
      createdBy: 'perf-batch-owner',
      items: [{ itemKey: 'shot-b-1', input: { durationSec: 4 } }]
    })
    const jobC = CreativeWorkflowService.createBatchJob({
      organizationId,
      jobType,
      createdBy: 'perf-batch-owner',
      items: []
    })

    const forcedJobTimestamp = new Date().toISOString()
    getLocalDb()
      .prepare(`UPDATE batch_jobs SET created_at = ?, updated_at = ? WHERE id IN (?, ?, ?)`)
      .run(forcedJobTimestamp, forcedJobTimestamp, jobA.id, jobB.id, jobC.id)

    const itemTs1 = new Date(Date.now() - 5_000).toISOString()
    const itemTs2 = new Date(Date.now() - 3_000).toISOString()
    const itemTs3 = new Date(Date.now() - 1_000).toISOString()
    getLocalDb()
      .prepare(
        `
      UPDATE batch_job_items
      SET created_at = ?, updated_at = ?
      WHERE job_id = ? AND item_key = ?
    `
      )
      .run(itemTs1, itemTs1, jobA.id, 'shot-a-1')
    getLocalDb()
      .prepare(
        `
      UPDATE batch_job_items
      SET created_at = ?, updated_at = ?
      WHERE job_id = ? AND item_key = ?
    `
      )
      .run(itemTs2, itemTs2, jobA.id, 'shot-a-2')
    getLocalDb()
      .prepare(
        `
      UPDATE batch_job_items
      SET created_at = ?, updated_at = ?
      WHERE job_id = ? AND item_key = ?
    `
      )
      .run(itemTs3, itemTs3, jobB.id, 'shot-b-1')

    const page1 = CreativeWorkflowService.listBatchJobs({
      organizationId,
      jobType,
      limit: 1
    })
    expect(page1.jobs.length).toBe(1)
    expect(page1.page.hasMore).toBe(true)
    expect(typeof page1.page.nextCursor).toBe('string')
    const cursor1 = String(page1.page.nextCursor || '')
    expect(cursor1.includes('|')).toBe(true)

    const legacyCursor = cursor1.split('|')[0] || cursor1
    const legacyPage = CreativeWorkflowService.listBatchJobs({
      organizationId,
      jobType,
      limit: 1,
      cursor: legacyCursor
    })
    expect(Array.isArray(legacyPage.jobs)).toBe(true)

    const page2 = CreativeWorkflowService.listBatchJobs({
      organizationId,
      jobType,
      limit: 1,
      cursor: cursor1
    })
    expect(page2.jobs.length).toBe(1)
    expect(page2.page.hasMore).toBe(true)
    expect(typeof page2.page.nextCursor).toBe('string')
    const cursor2 = String(page2.page.nextCursor || '')
    expect(cursor2.includes('|')).toBe(true)

    const page3 = CreativeWorkflowService.listBatchJobs({
      organizationId,
      jobType,
      limit: 1,
      cursor: cursor2
    })
    expect(page3.jobs.length).toBe(1)
    expect(page3.page.hasMore).toBe(false)
    expect(page3.page.nextCursor).toBe(null)

    const combinedJobs = [...page1.jobs, ...page2.jobs, ...page3.jobs]
    const combinedJobIds = combinedJobs.map((job) => job.id)
    expect(new Set(combinedJobIds).size).toBe(3)

    const expectedJobOrder = getLocalDb()
      .prepare(
        `
      SELECT id
      FROM batch_jobs
      WHERE organization_id = ? AND job_type = ?
      ORDER BY created_at DESC, id DESC
    `
      )
      .all(organizationId, jobType)
      .map((row: any) => String(row.id))
    expect(combinedJobIds).toEqual(expectedJobOrder)

    const jobsById = new Map(combinedJobs.map((job) => [job.id, job] as const))
    expect(jobsById.get(jobA.id)?.items.map((item) => item.itemKey)).toEqual([
      'shot-a-1',
      'shot-a-2'
    ])
    expect(jobsById.get(jobB.id)?.items.map((item) => item.itemKey)).toEqual(['shot-b-1'])
    expect(jobsById.get(jobC.id)?.items).toEqual([])
    expect(jobsById.get(jobA.id)?.totalItems).toBe(2)
    expect(jobsById.get(jobB.id)?.totalItems).toBe(1)
    expect(jobsById.get(jobC.id)?.totalItems).toBe(0)
  })
})
