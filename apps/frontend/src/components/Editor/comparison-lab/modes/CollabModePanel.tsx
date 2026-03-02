import React from 'react'
import type { CollabEvent, CollabPresence, WorkspaceInvite, WorkspaceRole } from '../types'

interface CollabModePanelProps {
  workspaceName: string
  workspaceOwner: string
  workspaceId: string
  projectId: string
  inviteRole: WorkspaceRole
  memberName: string
  collabRole: WorkspaceRole
  inviteCode: string
  invites: WorkspaceInvite[]
  isWsConnected: boolean
  presence: CollabPresence[]
  collabEvents: CollabEvent[]
  snapshots: Array<{ id: string; actorName: string; createdAt: string }>
  uploadFileName: string
  uploadToken: string
  onWorkspaceNameChange: (value: string) => void
  onWorkspaceOwnerChange: (value: string) => void
  onCreateWorkspace: () => void
  onRefreshWorkspaceState: () => void
  onInviteRoleChange: (value: WorkspaceRole) => void
  onMemberNameChange: (value: string) => void
  onCollabRoleChange: (value: WorkspaceRole) => void
  onInviteCodeChange: (value: string) => void
  onCreateInvite: () => void
  onAcceptInvite: () => void
  onConnectWs: () => void
  onDisconnectWs: () => void
  onSendCollabEvent: (type: 'timeline.patch' | 'project.patch' | 'cursor.update') => void
  onCreateSnapshot: () => void
  onUploadFileNameChange: (value: string) => void
  onRequestUploadToken: () => void
}

const CollabModePanel: React.FC<CollabModePanelProps> = ({
  workspaceName,
  workspaceOwner,
  workspaceId,
  projectId,
  inviteRole,
  memberName,
  collabRole,
  inviteCode,
  invites,
  isWsConnected,
  presence,
  collabEvents,
  snapshots,
  uploadFileName,
  uploadToken,
  onWorkspaceNameChange,
  onWorkspaceOwnerChange,
  onCreateWorkspace,
  onRefreshWorkspaceState,
  onInviteRoleChange,
  onMemberNameChange,
  onCollabRoleChange,
  onInviteCodeChange,
  onCreateInvite,
  onAcceptInvite,
  onConnectWs,
  onDisconnectWs,
  onSendCollabEvent,
  onCreateSnapshot,
  onUploadFileNameChange,
  onRequestUploadToken
}) => {
  return (
    <div className="collab-shell" data-testid="area-collab-shell">
      <section className="collab-card" data-testid="area-collab-workspace-card">
        <h4>团队空间</h4>
        <div className="lab-inline-fields">
          <label className="lab-field">
            <span>空间名</span>
            <input name="workspaceName" value={workspaceName} onChange={(event) => onWorkspaceNameChange(event.target.value)} data-testid="input-workspace-name" />
          </label>
          <label className="lab-field">
            <span>Owner</span>
            <input name="workspaceOwner" value={workspaceOwner} onChange={(event) => onWorkspaceOwnerChange(event.target.value)} data-testid="input-workspace-owner" />
          </label>
        </div>
        <div className="lab-inline-actions">
          <button onClick={onCreateWorkspace} data-testid="btn-create-workspace">创建工作区</button>
          <button disabled={!workspaceId} onClick={onRefreshWorkspaceState} data-testid="btn-refresh-workspace-state">刷新状态</button>
        </div>
        <div className="collab-meta">
          <span data-testid="text-workspace-id">workspace: {workspaceId || '-'}</span>
          <span>project: {projectId || '-'}</span>
        </div>
      </section>

      <section className="collab-card" data-testid="area-collab-invite-card">
        <h4>邀请与加入</h4>
        <div className="lab-inline-fields">
          <label className="lab-field">
            <span>邀请角色</span>
            <select name="inviteRole" value={inviteRole} onChange={(event) => onInviteRoleChange(event.target.value as WorkspaceRole)}>
              <option value="editor">editor</option>
              <option value="viewer">viewer</option>
              <option value="owner">owner</option>
            </select>
          </label>
          <label className="lab-field">
            <span>成员名</span>
            <input name="memberName" value={memberName} onChange={(event) => onMemberNameChange(event.target.value)} />
          </label>
          <label className="lab-field">
            <span>协作角色</span>
            <select name="collabRole" value={collabRole} onChange={(event) => onCollabRoleChange(event.target.value as WorkspaceRole)}>
              <option value="editor">editor</option>
              <option value="viewer">viewer</option>
              <option value="owner">owner</option>
            </select>
          </label>
        </div>
        <div className="lab-inline-fields">
          <label className="lab-field">
            <span>邀请码</span>
            <input name="inviteCode" value={inviteCode} onChange={(event) => onInviteCodeChange(event.target.value)} data-testid="input-invite-code" />
          </label>
        </div>
        <div className="lab-inline-actions">
          <button disabled={!workspaceId || collabRole !== 'owner'} onClick={onCreateInvite} data-testid="btn-create-invite">生成邀请</button>
          <button onClick={onAcceptInvite} data-testid="btn-accept-invite">接受邀请</button>
        </div>
        <div className="collab-list">
          {invites.slice(0, 6).map(item => (
            <div key={item.id} className="collab-list-item">
              <span>{item.code}</span>
              <span>{item.role}</span>
              <span>{item.status}</span>
            </div>
          ))}
          {invites.length === 0 ? <div className="api-empty">暂无邀请记录</div> : null}
        </div>
      </section>

      <section className="collab-card">
        <h4>多人协同通道</h4>
        <div className="lab-inline-actions">
          <button aria-label="连接协作通道" disabled={isWsConnected || !workspaceId} onClick={onConnectWs}>连接 WS</button>
          <button aria-label="断开协作通道" disabled={!isWsConnected} onClick={onDisconnectWs}>断开 WS</button>
          <button aria-label="发送时间轴补丁" disabled={!isWsConnected} onClick={() => onSendCollabEvent('timeline.patch')}>发送 Timeline Patch</button>
          <button aria-label="发送光标更新" disabled={!isWsConnected} onClick={() => onSendCollabEvent('cursor.update')}>发送 Cursor 更新</button>
        </div>
        <div className="collab-meta">
          <span>连接状态：{isWsConnected ? '已连接' : '未连接'}</span>
          <span>在线人数：{presence.length}</span>
        </div>
        <div className="collab-split">
          <div className="collab-column">
            <h5>在线成员</h5>
            <div className="collab-list">
              {presence.map(item => (
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
              {collabEvents.slice(0, 20).map(item => (
                <div key={item.id} className="collab-list-item">
                  <span>{item.eventType}</span>
                  <span>{item.actorName}</span>
                  <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
                </div>
              ))}
              {collabEvents.length === 0 ? <div className="api-empty">暂无协作事件</div> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="collab-card">
        <h4>云存储与快照</h4>
        <div className="lab-inline-actions">
          <button disabled={!projectId} onClick={onCreateSnapshot}>创建快照</button>
          <button disabled={!workspaceId} onClick={onRefreshWorkspaceState}>刷新列表</button>
        </div>
        <div className="lab-inline-fields">
          <label className="lab-field">
            <span>文件名</span>
            <input name="uploadFileName" value={uploadFileName} onChange={(event) => onUploadFileNameChange(event.target.value)} />
          </label>
          <button className="inline-fill-btn" onClick={onRequestUploadToken}>生成上传令牌</button>
        </div>
        <div className="collab-meta">
          <span>令牌对象：{uploadToken || '-'}</span>
        </div>
        <div className="collab-list">
          {snapshots.map(item => (
            <div key={item.id} className="collab-list-item">
              <span>{item.id.slice(0, 12)}</span>
              <span>{item.actorName}</span>
              <span>{new Date(item.createdAt).toLocaleString()}</span>
            </div>
          ))}
          {snapshots.length === 0 ? <div className="api-empty">暂无项目快照</div> : null}
        </div>
      </section>
    </div>
  )
}

export default CollabModePanel
