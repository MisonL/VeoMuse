import React from 'react'
import {
  formatLocalTime,
  getConnectionStatusText,
  takePreviewItems
} from '../collabModePanel.logic'
import type { CollabEvent, CollabPresence } from '../../types'

export interface RealtimeChannelSectionProps {
  workspaceId: string
  isWsConnected: boolean
  isWsConnecting: boolean
  presence: CollabPresence[]
  collabEvents: CollabEvent[]
  onConnectWs: () => void
  onDisconnectWs: () => void
  onSendCollabEvent: (type: 'timeline.patch' | 'project.patch' | 'cursor.update') => void
}

const RealtimeChannelSection: React.FC<RealtimeChannelSectionProps> = ({
  workspaceId,
  isWsConnected,
  isWsConnecting,
  presence,
  collabEvents,
  onConnectWs,
  onDisconnectWs,
  onSendCollabEvent
}) => {
  const previewEvents = takePreviewItems(collabEvents, 20)
  const connectionTone = !workspaceId ? 'neutral' : isWsConnected ? 'success' : 'warning'
  const presenceTone = !workspaceId ? 'neutral' : isWsConnected ? 'success' : 'warning'
  const eventTone = previewEvents.length > 0 ? 'accent' : 'neutral'

  return (
    <section
      className={`collab-card realtime-channel-hero realtime-channel-hero--${connectionTone}`}
      data-testid="area-realtime-channel-hero"
    >
      <div className="realtime-channel-head">
        <div className="collab-section-copy">
          <span className="collab-section-kicker">live relay</span>
          <h4>多人协同通道</h4>
        </div>
        <div
          className={`realtime-channel-status-band realtime-channel-status-band--${connectionTone}`}
        >
          <span
            className={`realtime-channel-status-pill realtime-channel-status-pill--${connectionTone}`}
          >
            连接状态：{getConnectionStatusText(isWsConnected, isWsConnecting)}
          </span>
          <span>在线人数：{presence.length}</span>
          <span>Workspace：{workspaceId || '-'}</span>
        </div>
      </div>
      <div className="lab-inline-actions collab-live-actions">
        <button
          disabled={isWsConnected || isWsConnecting || !workspaceId}
          onClick={onConnectWs}
          aria-busy={isWsConnecting}
        >
          {isWsConnecting ? '连接中...' : '连接 WS'}
        </button>
        <button disabled={!isWsConnected && !isWsConnecting} onClick={onDisconnectWs}>
          断开 WS
        </button>
        <button disabled={!isWsConnected} onClick={() => onSendCollabEvent('timeline.patch')}>
          发送 Timeline Patch
        </button>
        <button disabled={!isWsConnected} onClick={() => onSendCollabEvent('cursor.update')}>
          发送 Cursor 更新
        </button>
      </div>
      <div className="collab-command-summary">
        <div className={`collab-command-summary-card collab-command-summary-card--${presenceTone}`}>
          <span>presence rail</span>
          <strong>{presence.length}</strong>
          <small>
            {isWsConnected
              ? '实时在线成员'
              : isWsConnecting
                ? '通道握手中，在线态即将刷新'
                : '通道未连接，在线态待刷新'}
          </small>
        </div>
        <div className={`collab-command-summary-card collab-command-summary-card--${eventTone}`}>
          <span>event spine</span>
          <strong>{previewEvents.length}</strong>
          <small>{previewEvents.length > 0 ? '已载入协作事件' : '等待协作事件写入'}</small>
        </div>
      </div>
      <div className="collab-split collab-split--live">
        <div className="collab-column presence-rail">
          <h5>在线成员</h5>
          <div className="collab-list">
            {presence.map((item) => (
              <div key={`${item.workspaceId}-${item.sessionId}`} className="collab-list-item">
                <span>{item.memberName}</span>
                <span>{item.role}</span>
                <span>{item.status}</span>
              </div>
            ))}
            {presence.length === 0 ? <div className="api-empty">暂无在线成员</div> : null}
          </div>
        </div>
        <div className="collab-column event-spine">
          <h5>协作事件</h5>
          <div className="collab-list">
            {previewEvents.map((item) => (
              <div key={item.id} className="collab-list-item">
                <span>{item.eventType}</span>
                <span>{item.actorName}</span>
                <span>{formatLocalTime(item.createdAt)}</span>
              </div>
            ))}
            {collabEvents.length === 0 ? <div className="api-empty">暂无协作事件</div> : null}
          </div>
        </div>
      </div>
    </section>
  )
}

export default RealtimeChannelSection
