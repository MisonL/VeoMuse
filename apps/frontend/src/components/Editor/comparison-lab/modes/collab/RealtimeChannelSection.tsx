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
  presence: CollabPresence[]
  collabEvents: CollabEvent[]
  onConnectWs: () => void
  onDisconnectWs: () => void
  onSendCollabEvent: (type: 'timeline.patch' | 'project.patch' | 'cursor.update') => void
}

const RealtimeChannelSection: React.FC<RealtimeChannelSectionProps> = ({
  workspaceId,
  isWsConnected,
  presence,
  collabEvents,
  onConnectWs,
  onDisconnectWs,
  onSendCollabEvent
}) => {
  return (
    <section className="collab-card">
      <h4>多人协同通道</h4>
      <div className="lab-inline-actions">
        <button
          aria-label="连接协作通道"
          disabled={isWsConnected || !workspaceId}
          onClick={onConnectWs}
        >
          连接 WS
        </button>
        <button aria-label="断开协作通道" disabled={!isWsConnected} onClick={onDisconnectWs}>
          断开 WS
        </button>
        <button
          aria-label="发送时间轴补丁"
          disabled={!isWsConnected}
          onClick={() => onSendCollabEvent('timeline.patch')}
        >
          发送 Timeline Patch
        </button>
        <button
          aria-label="发送光标更新"
          disabled={!isWsConnected}
          onClick={() => onSendCollabEvent('cursor.update')}
        >
          发送 Cursor 更新
        </button>
      </div>
      <div className="collab-meta">
        <span>连接状态：{getConnectionStatusText(isWsConnected)}</span>
        <span>在线人数：{presence.length}</span>
      </div>
      <div className="collab-split">
        <div className="collab-column">
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
        <div className="collab-column">
          <h5>协作事件</h5>
          <div className="collab-list">
            {takePreviewItems(collabEvents, 20).map((item) => (
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
