import { describe, expect, it } from 'bun:test'
import {
  formatCursor,
  formatLocalDateTime,
  formatLocalTime,
  formatMentions,
  formatRatioPercent,
  formatShortId,
  getAckLabel,
  getBusyStatusText,
  getConnectionStatusText,
  isAlertAckDisabled,
  isCreateInviteDisabled,
  isLoadMoreDisabled,
  isPermissionUpdateDisabled,
  isProjectActionDisabled,
  takePreviewItems
} from '../apps/frontend/src/components/Editor/comparison-lab/modes/collabModePanel.logic'

describe('CollabModePanel 纯逻辑', () => {
  it('格式化函数应返回稳定文本', () => {
    expect(formatShortId('thread-123456789', 8)).toBe('thread-1')
    expect(formatShortId(' ', 8)).toBe('-')
    expect(formatMentions(['alice', 'bob'])).toBe('@alice,bob')
    expect(formatMentions([])).toBe('-')
    expect(formatCursor('cursor-1')).toBe('cursor-1')
    expect(formatCursor(' ')).toBe('-')
    expect(formatRatioPercent(0.923)).toBe('92%')
    expect(formatRatioPercent(undefined)).toBe('-')
  })

  it('时间格式化在非法输入时应兜底', () => {
    expect(formatLocalTime('')).toBe('-')
    expect(formatLocalDateTime('invalid-date')).toBe('-')
    expect(formatLocalTime('2026-03-03T10:00:00.000Z')).not.toBe('-')
    expect(formatLocalDateTime('2026-03-03T10:00:00.000Z')).not.toBe('-')
  })

  it('列表预览应按 limit 截断且不改原数组', () => {
    const source = [1, 2, 3, 4, 5]
    const next = takePreviewItems(source, 3)
    expect(next).toEqual([1, 2, 3])
    expect(source).toEqual([1, 2, 3, 4, 5])
    expect(takePreviewItems(source, 0)).toEqual([])
  })

  it('状态文本与 ACK 文案应稳定', () => {
    expect(getConnectionStatusText(true)).toBe('已连接')
    expect(getConnectionStatusText(false)).toBe('未连接')
    expect(getBusyStatusText(true)).toBe('处理中...')
    expect(getBusyStatusText(false)).toBe('空闲')
    expect(getAckLabel('open')).toBe('ACK')
    expect(getAckLabel('acknowledged')).toBe('已 ACK')
  })

  it('按钮禁用判定应覆盖协作关键边界', () => {
    expect(isProjectActionDisabled('', false)).toBe(true)
    expect(isProjectActionDisabled('project-1', false)).toBe(false)
    expect(isLoadMoreDisabled('project-1', true, false)).toBe(false)
    expect(isLoadMoreDisabled('project-1', false, false)).toBe(true)
    expect(isCreateInviteDisabled('workspace-1', 'owner')).toBe(false)
    expect(isCreateInviteDisabled('workspace-1', 'editor')).toBe(true)
    expect(isPermissionUpdateDisabled('workspace-1', 'timeline.merge=true', false)).toBe(false)
    expect(isPermissionUpdateDisabled('workspace-1', ' ', false)).toBe(true)
    expect(isAlertAckDisabled(false, 'open')).toBe(false)
    expect(isAlertAckDisabled(false, 'acknowledged')).toBe(true)
  })
})
