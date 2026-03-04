import { describe, expect, it } from 'bun:test'
import { getLocalDb } from '../apps/backend/src/services/LocalDatabaseService'
import { VideoGenerationService } from '../apps/backend/src/services/VideoGenerationService'

const makeId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

describe('视频生成任务分页游标稳定性（服务层）', () => {
  it('同时间戳下应通过复合游标稳定翻页，并兼容旧时间戳游标', () => {
    const db = getLocalDb()
    const organizationId = makeId('org_vg_cursor')
    const createdAt = new Date().toISOString()
    const jobA = makeId('vgj')
    const jobB = makeId('vgj')

    const insert = db.prepare(`
      INSERT INTO video_generation_jobs (
        id, organization_id, workspace_id, model_id, generation_mode, request_json,
        status, provider_status, operation_name, result_json, error_message,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    insert.run(
      jobA,
      organizationId,
      null,
      'luma-dream',
      'text_to_video',
      JSON.stringify({ prompt: 'A' }),
      'submitted',
      'ok',
      `op_${jobA}`,
      JSON.stringify({ ok: true }),
      null,
      'cursor-test',
      createdAt,
      createdAt
    )
    insert.run(
      jobB,
      organizationId,
      null,
      'luma-dream',
      'text_to_video',
      JSON.stringify({ prompt: 'B' }),
      'submitted',
      'ok',
      `op_${jobB}`,
      JSON.stringify({ ok: true }),
      null,
      'cursor-test',
      createdAt,
      createdAt
    )

    const page1 = VideoGenerationService.list({
      organizationId,
      limit: 1
    })
    expect(page1.jobs.length).toBe(1)
    expect(page1.page.hasMore).toBe(true)
    expect(typeof page1.page.nextCursor).toBe('string')

    const cursor = String(page1.page.nextCursor || '')
    expect(cursor.includes('|')).toBe(true)

    const legacyCursor = cursor.split('|')[0] || cursor
    const legacyPage = VideoGenerationService.list({
      organizationId,
      limit: 1,
      cursor: legacyCursor
    })
    expect(Array.isArray(legacyPage.jobs)).toBe(true)

    const page2 = VideoGenerationService.list({
      organizationId,
      limit: 1,
      cursor
    })
    expect(page2.jobs.length).toBe(1)

    const ids = new Set([page1.jobs[0]?.id, page2.jobs[0]?.id].filter(Boolean))
    expect(ids.size).toBe(2)
    expect(ids.has(jobA)).toBe(true)
    expect(ids.has(jobB)).toBe(true)
  })
})
