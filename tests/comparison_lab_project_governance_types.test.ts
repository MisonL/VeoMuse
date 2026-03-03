import { afterEach, describe, expect, it, mock } from 'bun:test'
import {
  applyProjectGovernanceTemplate,
  batchUpdateProjectGovernanceClips,
  createProjectGovernanceComment,
  createProjectGovernanceReview,
  listProjectGovernanceComments,
  listProjectGovernanceReviews,
  listProjectGovernanceTemplates,
  normalizeProjectGovernanceLimit,
  resolveProjectGovernanceComment
} from '../apps/frontend/src/components/Editor/comparison-lab/types'

const originalFetch = globalThis.fetch

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

const getFirstFetchCall = () => {
  const calls = (globalThis.fetch as any).mock.calls as Array<[string, RequestInit]>
  expect(calls.length).toBe(1)
  return calls[0]
}

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('comparison-lab/types 项目治理函数', () => {
  it('normalizeProjectGovernanceLimit: 应处理默认值、非法值和最大值裁剪', () => {
    expect(normalizeProjectGovernanceLimit(' 18 ')).toBe(18)
    expect(normalizeProjectGovernanceLimit('0')).toBe(20)
    expect(normalizeProjectGovernanceLimit('foo', 7)).toBe(7)
    expect(normalizeProjectGovernanceLimit(4.8)).toBe(4)
    expect(normalizeProjectGovernanceLimit(999)).toBe(100)
  })

  it('comments list: 成功时应返回分页结构并携带 cursor/limit 参数', async () => {
    const comments = [
      { id: 'pc_1', createdAt: '2026-03-01T10:00:00.000Z' },
      { id: 'pc_2', createdAt: '2026-03-02T10:00:00.000Z' }
    ]
    globalThis.fetch = mock(() => Promise.resolve(jsonResponse({ success: true, comments }))) as any

    const result = await listProjectGovernanceComments(' prj_demo ', {
      limit: '2',
      cursor: ' cursor-1 '
    })

    expect(result.comments).toEqual(comments as any)
    expect(result.page).toEqual({
      limit: 2,
      hasMore: true,
      nextCursor: '2026-03-02T10:00:00.000Z'
    })

    const [url] = getFirstFetchCall()
    expect(url).toBe(
      'http://localhost:33117/api/projects/prj_demo/comments?limit=2&cursor=cursor-1'
    )
  })

  it('comments list: 接口失败时应抛出后端错误', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(jsonResponse({ success: false, error: '评论读取失败' }, 200))
    ) as any

    await expect(listProjectGovernanceComments('prj_demo')).rejects.toThrow('评论读取失败')
  })

  it('comments create: 成功时应使用 POST JSON 并返回 comment', async () => {
    const comment = { id: 'pc_100', content: 'ok' }
    globalThis.fetch = mock(() => Promise.resolve(jsonResponse({ success: true, comment }))) as any

    const input = {
      anchor: 'timeline:track-v1:clip-1',
      content: '请确认色彩匹配',
      mentions: ['owner']
    }
    const result = await createProjectGovernanceComment('prj_create', input)
    expect(result).toEqual(comment as any)

    const [url, init] = getFirstFetchCall()
    expect(url).toBe('http://localhost:33117/api/projects/prj_create/comments')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual(input)
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })

  it('comments create: 非 2xx 且无法解析 JSON 时应回退 HTTP 状态错误', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('server exploded', { status: 500 }))
    ) as any

    await expect(
      createProjectGovernanceComment('prj_create', {
        content: 'x'
      })
    ).rejects.toThrow('HTTP 500')
  })

  it('comments resolve: 成功时应编码 commentId 并返回更新后的 comment', async () => {
    const comment = { id: 'pc/slash', status: 'resolved' }
    globalThis.fetch = mock(() => Promise.resolve(jsonResponse({ success: true, comment }))) as any

    const result = await resolveProjectGovernanceComment('prj_resolve', ' pc/slash ')
    expect(result).toEqual(comment as any)

    const [url, init] = getFirstFetchCall()
    expect(url).toBe('http://localhost:33117/api/projects/prj_resolve/comments/pc%2Fslash/resolve')
    expect(init.method).toBe('POST')
  })

  it('comments resolve: 接口失败时应抛出后端错误', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(jsonResponse({ success: false, error: '评论已被锁定' }))
    ) as any

    await expect(resolveProjectGovernanceComment('prj_resolve', 'pc_1')).rejects.toThrow(
      '评论已被锁定'
    )
  })

  it('comments resolve: 未提供 commentId 时应直接报错且不发请求', async () => {
    globalThis.fetch = mock(() => Promise.resolve(jsonResponse({ success: true }))) as any

    await expect(resolveProjectGovernanceComment('prj_resolve', '   ')).rejects.toThrow(
      '请先选择评论'
    )
    expect((globalThis.fetch as any).mock.calls.length).toBe(0)
  })

  it('reviews list: 成功时应归一化 limit 并返回 reviews', async () => {
    const reviews = [{ id: 'rv_1' }, { id: 'rv_2' }]
    globalThis.fetch = mock(() => Promise.resolve(jsonResponse({ success: true, reviews }))) as any

    const result = await listProjectGovernanceReviews('prj_review', { limit: 999 })
    expect(result).toEqual(reviews as any)

    const [url] = getFirstFetchCall()
    expect(url).toBe('http://localhost:33117/api/projects/prj_review/reviews?limit=100')
  })

  it('reviews list: 接口失败时应抛出错误', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(jsonResponse({ error: '读取评审失败' }, 503))
    ) as any

    await expect(listProjectGovernanceReviews('prj_review')).rejects.toThrow('读取评审失败')
  })

  it('reviews create: 成功时应提交评审内容并返回 review', async () => {
    const review = { id: 'rv_100', decision: 'approved' }
    globalThis.fetch = mock(() => Promise.resolve(jsonResponse({ success: true, review }))) as any

    const input = {
      decision: 'approved' as const,
      summary: '镜头衔接稳定',
      score: 9.2
    }
    const result = await createProjectGovernanceReview('prj_review', input)
    expect(result).toEqual(review as any)

    const [url, init] = getFirstFetchCall()
    expect(url).toBe('http://localhost:33117/api/projects/prj_review/reviews')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual(input)
  })

  it('reviews create: success=false 时应抛出业务错误', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(jsonResponse({ success: false, error: '评审写入失败' }))
    ) as any

    await expect(
      createProjectGovernanceReview('prj_review', {
        decision: 'changes_requested',
        summary: '请缩短片头'
      })
    ).rejects.toThrow('评审写入失败')
  })

  it('templates list: 成功时应返回模板数组', async () => {
    const templates = [{ id: 'tpl_1' }, { id: 'tpl_2' }]
    globalThis.fetch = mock(() =>
      Promise.resolve(jsonResponse({ success: true, templates }))
    ) as any

    const result = await listProjectGovernanceTemplates('prj_tpl')
    expect(result).toEqual(templates as any)

    const [url] = getFirstFetchCall()
    expect(url).toBe('http://localhost:33117/api/projects/prj_tpl/templates')
  })

  it('templates list: 接口失败时应抛出错误', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(jsonResponse({ success: false, error: '模板读取失败' }))
    ) as any

    await expect(listProjectGovernanceTemplates('prj_tpl')).rejects.toThrow('模板读取失败')
  })

  it('templates apply: 成功时应提交 options 并返回 result', async () => {
    const resultPayload = { projectId: 'prj_tpl', templateId: 'tpl_1', traceId: 'trace_1' }
    globalThis.fetch = mock(() =>
      Promise.resolve(jsonResponse({ success: true, result: resultPayload }))
    ) as any

    const result = await applyProjectGovernanceTemplate('prj_tpl', {
      templateId: 'tpl_1',
      options: { blendMode: 'replace' }
    })
    expect(result).toEqual(resultPayload as any)

    const [url, init] = getFirstFetchCall()
    expect(url).toBe('http://localhost:33117/api/projects/prj_tpl/templates/apply')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({
      templateId: 'tpl_1',
      options: { blendMode: 'replace' }
    })
  })

  it('templates apply: 接口错误时应抛出错误', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(jsonResponse({ error: '模板应用失败' }, 500))
    ) as any

    await expect(
      applyProjectGovernanceTemplate('prj_tpl', {
        templateId: 'tpl_1'
      })
    ).rejects.toThrow('模板应用失败')
  })

  it('clips batchUpdate: 成功时应提交 operations 并返回统计结果', async () => {
    const resultPayload = { projectId: 'prj_batch', requested: 2, updated: 1 }
    globalThis.fetch = mock(() =>
      Promise.resolve(jsonResponse({ success: true, result: resultPayload }))
    ) as any

    const operations = [
      { clipId: 'clip_a', patch: { start: 1 } },
      { clipId: 'clip_b', patch: { end: 5 } }
    ]
    const result = await batchUpdateProjectGovernanceClips('prj_batch', operations)
    expect(result).toEqual(resultPayload as any)

    const [url, init] = getFirstFetchCall()
    expect(url).toBe('http://localhost:33117/api/projects/prj_batch/clips/batch-update')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ operations })
  })

  it('clips batchUpdate: 接口失败时应抛出错误', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(jsonResponse({ success: false, error: '批量更新失败' }))
    ) as any

    await expect(
      batchUpdateProjectGovernanceClips('prj_batch', [{ clipId: 'clip_a', patch: {} }])
    ).rejects.toThrow('批量更新失败')
  })
})
