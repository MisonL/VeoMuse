import { describe, expect, it } from 'bun:test'
import type { ProjectGovernanceComment } from '../apps/frontend/src/components/Editor/comparison-lab/types'
import {
  SLO_MIN_JOURNEY_SAMPLES,
  SLO_MIN_NON_AI_SAMPLES,
  buildGovernanceCommentListArgs,
  buildRepairQueryParams,
  computePollBackoff,
  formatApiAverageMs,
  formatApiSuccessRate,
  mapSloDecisionStatusToText,
  mergeUniqueComments,
  normalizeClipBatchOperations,
  normalizeJourneyFailCount,
  normalizeRepairHistoryPage,
  normalizeSloSummary,
  parseGovernanceReviewScore,
  parseJsonArray,
  parseJsonObject,
  parseMentions,
  resolveMetricsOverview,
  resolveSelectedCommentId,
  resolveSloDecision
} from '../apps/frontend/src/components/Editor/telemetryDashboard.logic'

describe('TelemetryDashboard 纯逻辑', () => {
  it('resolveSloDecision 应覆盖样本不足/达标/未达标三分支', () => {
    const insufficient = resolveSloDecision({
      targets: { primaryFlowSuccessRate: 0.9, nonAiApiP95Ms: 1200, firstSuccessAvgSteps: 2.5 },
      current: { primaryFlowSuccessRate: 0.95, nonAiApiP95Ms: 800, firstSuccessAvgSteps: 1.8 },
      passFlags: { primaryFlowSuccessRate: true, nonAiApiP95Ms: true, firstSuccessAvgSteps: true },
      window: { minutes: 1440, from: '', to: '' },
      counts: { totalJourneys: SLO_MIN_JOURNEY_SAMPLES - 1, successJourneys: 1, nonAiSamples: 99 },
      sourceBreakdown: {},
      updatedAt: ''
    })
    expect(insufficient.status).toBe('sample_insufficient')
    expect(insufficient.reasonText).toBe('样本不足')

    const passed = resolveSloDecision({
      targets: { primaryFlowSuccessRate: 0.9, nonAiApiP95Ms: 1200, firstSuccessAvgSteps: 2.5 },
      current: { primaryFlowSuccessRate: 0.95, nonAiApiP95Ms: 800, firstSuccessAvgSteps: 1.8 },
      passFlags: { primaryFlowSuccessRate: true, nonAiApiP95Ms: true, firstSuccessAvgSteps: true },
      window: { minutes: 1440, from: '', to: '' },
      counts: {
        totalJourneys: SLO_MIN_JOURNEY_SAMPLES,
        successJourneys: 10,
        nonAiSamples: SLO_MIN_NON_AI_SAMPLES
      },
      sourceBreakdown: {},
      updatedAt: ''
    })
    expect(passed.status).toBe('pass')
    expect(passed.reasonText).toBe('已达标')

    const missed = resolveSloDecision({
      targets: { primaryFlowSuccessRate: 0.9, nonAiApiP95Ms: 1200, firstSuccessAvgSteps: 2.5 },
      current: { primaryFlowSuccessRate: 0.95, nonAiApiP95Ms: 800, firstSuccessAvgSteps: 1.8 },
      passFlags: { primaryFlowSuccessRate: true, nonAiApiP95Ms: false, firstSuccessAvgSteps: true },
      window: { minutes: 1440, from: '', to: '' },
      counts: {
        totalJourneys: SLO_MIN_JOURNEY_SAMPLES,
        successJourneys: 10,
        nonAiSamples: SLO_MIN_NON_AI_SAMPLES
      },
      sourceBreakdown: {},
      updatedAt: ''
    })
    expect(missed.status).toBe('target_missed')
    expect(missed.reasonText).toBe('目标未达标')
  })

  it('mapSloDecisionStatusToText 应返回稳定文案', () => {
    expect(mapSloDecisionStatusToText('sample_insufficient')).toBe('样本不足')
    expect(mapSloDecisionStatusToText('target_missed')).toBe('目标未达标')
    expect(mapSloDecisionStatusToText('pass')).toBe('已达标')
  })

  it('buildRepairQueryParams 应组装范围/状态/原因/offset', () => {
    const query = buildRepairQueryParams({
      offset: -3,
      range: '24h',
      status: 'failed',
      reason: '  sqlite ',
      pageSize: 20,
      nowMs: Date.UTC(2026, 0, 2, 0, 0, 0)
    })
    expect(query.get('offset')).toBe('0')
    expect(query.get('limit')).toBe('20')
    expect(query.get('status')).toBe('failed')
    expect(query.get('reason')).toBe('sqlite')
    expect(query.get('from')).toBe('2026-01-01T00:00:00.000Z')
  })

  it('normalizeRepairHistoryPage 应支持 append 与分页回退', () => {
    const page1 = normalizeRepairHistoryPage({
      payload: { repairs: [{ id: 'r1' }], page: { hasMore: true, total: 3 } },
      prevRows: [],
      append: false,
      pageSize: 20
    })
    expect(page1.rows).toEqual([{ id: 'r1' }])
    expect(page1.total).toBe(3)
    expect(page1.hasMore).toBe(true)

    const page2 = normalizeRepairHistoryPage({
      payload: { repairs: [{ id: 'r2' }] },
      prevRows: page1.rows,
      append: true,
      pageSize: 1
    })
    expect(page2.rows).toEqual([{ id: 'r1' }, { id: 'r2' }])
    expect(page2.total).toBeNull()
    expect(page2.hasMore).toBe(true)
  })

  it('评论分页参数与去重合并应稳定', () => {
    const args = buildGovernanceCommentListArgs({
      append: true,
      cursor: '   ',
      limitInput: '15',
      defaultLimit: 20
    })
    expect(args.limit).toBe(15)
    expect(args.shouldStop).toBe(true)

    const prev: ProjectGovernanceComment[] = [
      {
        id: 'c1',
        projectId: 'p1',
        workspaceId: 'w1',
        anchor: null,
        content: 'a',
        mentions: [],
        status: 'open',
        createdBy: 'u1',
        createdAt: '2026-01-01T00:00:00.000Z',
        resolvedAt: null,
        resolvedBy: null
      }
    ]
    const incoming: ProjectGovernanceComment[] = [
      { ...prev[0] },
      { ...prev[0], id: 'c2', content: 'b' }
    ]
    const merged = mergeUniqueComments(prev, incoming, true)
    expect(merged.map((item) => item.id)).toEqual(['c1', 'c2'])
    expect(resolveSelectedCommentId('missing', merged)).toBe('c1')
    expect(resolveSelectedCommentId('c2', merged)).toBe('c2')
  })

  it('输入解析与批量 operations 归一化应覆盖边界', () => {
    expect(parseMentions('owner, editor,owner , ')).toEqual(['owner', 'editor'])
    expect(parseJsonObject('{"a":1}', 'obj')).toEqual({ a: 1 })
    expect(() => parseJsonObject('[]', 'obj')).toThrow('obj 必须是 JSON 对象')
    expect(parseJsonArray('[1,2]', 'arr')).toEqual([1, 2])
    expect(() => parseJsonArray('{}', 'arr')).toThrow('arr 必须是 JSON 数组')

    const ops = normalizeClipBatchOperations([
      { clipId: ' clip-a ', patch: { start: 1 } },
      { clipId: '', patch: { start: 2 } },
      { clipId: 'clip-b', patch: [] }
    ])
    expect(ops).toEqual([{ clipId: 'clip-a', patch: { start: 1 } }])
  })

  it('轮询退避、旅程计数与分数解析应符合预期', () => {
    expect(
      computePollBackoff({
        healthOk: false,
        runtimeOk: true,
        sloOk: true,
        failureStreak: 2
      })
    ).toEqual({
      nextFailureStreak: 3,
      nextDelayMs: 40000
    })
    expect(
      computePollBackoff({
        healthOk: true,
        runtimeOk: true,
        sloOk: true,
        failureStreak: 5
      })
    ).toEqual({
      nextFailureStreak: 0,
      nextDelayMs: 5000
    })

    expect(normalizeJourneyFailCount('3')).toBe(3)
    expect(normalizeJourneyFailCount('NaN')).toBe(0)
    expect(normalizeJourneyFailCount(-2)).toBe(0)

    expect(parseGovernanceReviewScore(' 8.5 ')).toEqual({ score: 8.5, error: null })
    expect(parseGovernanceReviewScore('12abc')).toEqual({
      score: undefined,
      error: '评分必须为数字'
    })
  })

  it('指标概览与格式化应在异常结构下兜底', () => {
    const overview = resolveMetricsOverview({
      system: { memory: { usage: 0.347 }, load: [1.234] },
      api: {
        a: { count: 10, success: 9, totalMs: 210 }
      }
    })
    expect(overview.memoryUsageText).toBe('34.7%')
    expect(overview.systemLoadText).toBe('1.23')
    expect(overview.apiEntries).toHaveLength(1)
    expect(formatApiSuccessRate(overview.apiEntries[0][1])).toBe('90%')
    expect(formatApiAverageMs(overview.apiEntries[0][1])).toBe('21ms')
    expect(formatApiSuccessRate({ count: 0, success: 0 })).toBe('--')
    expect(formatApiAverageMs({ count: 0, totalMs: 0 })).toBe('--')
  })

  it('normalizeSloSummary 应过滤非法结构并归一化数字', () => {
    const normalized = normalizeSloSummary({
      targets: {
        primaryFlowSuccessRate: 2,
        nonAiApiP95Ms: '1200',
        firstSuccessAvgSteps: '2.5'
      },
      current: {
        primaryFlowSuccessRate: -1,
        nonAiApiP95Ms: 'bad',
        firstSuccessAvgSteps: 1.2
      },
      passFlags: {
        primaryFlowSuccessRate: 1,
        nonAiApiP95Ms: 0,
        firstSuccessAvgSteps: true
      },
      counts: {
        totalJourneys: '12',
        successJourneys: '9',
        nonAiSamples: '20'
      },
      window: {
        minutes: '60',
        from: 'from',
        to: 'to'
      },
      sourceBreakdown: {},
      updatedAt: 'now'
    })
    expect(normalized?.targets.primaryFlowSuccessRate).toBe(1)
    expect(normalized?.current.primaryFlowSuccessRate).toBe(0)
    expect(normalized?.current.nonAiApiP95Ms).toBeNull()
    expect(normalized?.passFlags.nonAiApiP95Ms).toBe(false)
    expect(normalized?.counts.totalJourneys).toBe(12)
    expect(normalized?.window.minutes).toBe(60)
    expect(normalizeSloSummary({})).toBeNull()
  })
})
