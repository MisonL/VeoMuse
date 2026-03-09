import type { V4ReliabilityAlert, WorkspaceRole } from '../types'

const FALLBACK_TEXT = '-'

const toTrimmed = (value: string | null | undefined) => String(value || '').trim()

export const formatShortId = (value: string, length: number) => {
  const text = toTrimmed(value)
  if (!text) return FALLBACK_TEXT
  if (!Number.isFinite(length) || length <= 0) return text
  return text.slice(0, length)
}

export const formatMentions = (mentions: string[]) => {
  if (!Array.isArray(mentions) || mentions.length === 0) return FALLBACK_TEXT
  return `@${mentions.join(',')}`
}

const toSafeDate = (value: string | null | undefined) => {
  const text = toTrimmed(value)
  if (!text) return null
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return null
  return date
}

export const formatLocalTime = (value: string | null | undefined) => {
  const date = toSafeDate(value)
  return date ? date.toLocaleTimeString() : FALLBACK_TEXT
}

export const formatLocalDateTime = (value: string | null | undefined) => {
  const date = toSafeDate(value)
  return date ? date.toLocaleString() : FALLBACK_TEXT
}

export const formatRatioPercent = (value: number | null | undefined) => {
  if (!Number.isFinite(value as number)) return FALLBACK_TEXT
  return `${Math.round((value as number) * 100)}%`
}

export const formatCursor = (cursor: string) => {
  return toTrimmed(cursor) || FALLBACK_TEXT
}

export const takePreviewItems = <T>(items: T[], limit: number) => {
  if (!Array.isArray(items) || items.length === 0) return [] as T[]
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0
  return items.slice(0, safeLimit)
}

export const getConnectionStatusText = (connected: boolean, connecting = false) => {
  if (connecting) return '连接中'
  return connected ? '已连接' : '未连接'
}

export const getBusyStatusText = (busy: boolean) => {
  return busy ? '处理中...' : '空闲'
}

export const getWorkspaceRoleLabel = (role: WorkspaceRole) => {
  if (role === 'owner') return '管理员'
  if (role === 'editor') return '编辑者'
  return '查看者'
}

export const getAckLabel = (status: V4ReliabilityAlert['status']) => {
  return status === 'open' ? 'ACK' : '已 ACK'
}

export const isProjectActionDisabled = (projectId: string, busy: boolean) => {
  return !toTrimmed(projectId) || busy
}

export const isLoadMoreDisabled = (projectId: string, hasMore: boolean, busy: boolean) => {
  return isProjectActionDisabled(projectId, busy) || !hasMore
}

export const isCreateInviteDisabled = (workspaceId: string, role: WorkspaceRole) => {
  return !toTrimmed(workspaceId) || role !== 'owner'
}

export const isPermissionUpdateDisabled = (
  workspaceId: string,
  subjectId: string,
  busy: boolean
) => {
  return !toTrimmed(workspaceId) || !toTrimmed(subjectId) || busy
}

export const isAlertAckDisabled = (isOpsBusy: boolean, status: V4ReliabilityAlert['status']) => {
  return isOpsBusy || status !== 'open'
}
