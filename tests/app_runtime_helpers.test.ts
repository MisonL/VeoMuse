import { describe, expect, it } from 'bun:test'
import {
  compactExportMessage,
  formatTimecode,
  getExportButtonLabel,
  resolveExportStageByProgress
} from '../apps/frontend/src/utils/appHelpers'

describe('App 导出与时间码辅助函数', () => {
  it('formatTimecode 应处理负值与小时级时间', () => {
    expect(formatTimecode(-1)).toBe('00:00:00:00')
    expect(formatTimecode(3661.5)).toBe('01:01:01:15')
  })

  it('resolveExportStageByProgress 应按进度映射阶段', () => {
    expect(resolveExportStageByProgress(0)).toBe('validating')
    expect(resolveExportStageByProgress(29)).toBe('validating')
    expect(resolveExportStageByProgress(30)).toBe('composing')
    expect(resolveExportStageByProgress(77)).toBe('composing')
    expect(resolveExportStageByProgress(78)).toBe('packaging')
    expect(resolveExportStageByProgress(120)).toBe('packaging')
  })

  it('compactExportMessage 应压缩空白并按阈值截断', () => {
    expect(compactExportMessage('  导出    成功  ')).toBe('导出 成功')
    expect(compactExportMessage('abcdefghij', 5)).toBe('abcde...')
  })

  it('getExportButtonLabel 应按状态与进度返回文案', () => {
    expect(getExportButtonLabel(true, 'idle', 0)).toBe('导出中...')
    expect(getExportButtonLabel(false, 'pending', 38)).toBe('导出中 38%')
    expect(getExportButtonLabel(false, 'pending', 100)).toBe('导出中 99%')
    expect(getExportButtonLabel(false, 'done')).toBe('导出')
  })
})
