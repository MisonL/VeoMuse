import React from 'react'
import {
  getWorkspaceRoleLabel,
  isCreateInviteDisabled,
  takePreviewItems
} from '../collabModePanel.logic'
import type { WorkspaceInvite, WorkspaceRole } from '../../types'

export interface InviteJoinSectionProps {
  workspaceId: string
  inviteRole: WorkspaceRole
  memberName: string
  collabRole: WorkspaceRole
  inviteCode: string
  invites: WorkspaceInvite[]
  onInviteRoleChange: (value: WorkspaceRole) => void
  onMemberNameChange: (value: string) => void
  onCollabRoleChange: (value: WorkspaceRole) => void
  onInviteCodeChange: (value: string) => void
  onCreateInvite: () => void
  onAcceptInvite: () => void
}

const InviteJoinSection: React.FC<InviteJoinSectionProps> = ({
  workspaceId,
  inviteRole,
  memberName,
  collabRole,
  inviteCode,
  invites,
  onInviteRoleChange,
  onMemberNameChange,
  onCollabRoleChange,
  onInviteCodeChange,
  onCreateInvite,
  onAcceptInvite
}) => {
  return (
    <section className="collab-card" data-testid="area-collab-invite-card">
      <h4>邀请与加入</h4>
      <div className="lab-inline-fields">
        <label className="lab-field">
          <span>邀请角色</span>
          <select
            name="inviteRole"
            value={inviteRole}
            onChange={(event) => onInviteRoleChange(event.target.value as WorkspaceRole)}
          >
            <option value="editor">编辑者</option>
            <option value="viewer">查看者</option>
            <option value="owner">管理员</option>
          </select>
        </label>
        <label className="lab-field">
          <span>成员名</span>
          <input
            name="memberName"
            value={memberName}
            onChange={(event) => onMemberNameChange(event.target.value)}
          />
        </label>
        <label className="lab-field">
          <span>协作角色</span>
          <select
            name="collabRole"
            value={collabRole}
            onChange={(event) => onCollabRoleChange(event.target.value as WorkspaceRole)}
          >
            <option value="editor">编辑者</option>
            <option value="viewer">查看者</option>
            <option value="owner">管理员</option>
          </select>
        </label>
      </div>
      <div className="lab-inline-fields">
        <label className="lab-field">
          <span>邀请码</span>
          <input
            name="inviteCode"
            value={inviteCode}
            onChange={(event) => onInviteCodeChange(event.target.value)}
            data-testid="input-invite-code"
          />
        </label>
      </div>
      <div className="lab-inline-actions">
        <button
          disabled={isCreateInviteDisabled(workspaceId, collabRole)}
          onClick={onCreateInvite}
          data-testid="btn-create-invite"
        >
          生成邀请
        </button>
        <button onClick={onAcceptInvite} data-testid="btn-accept-invite">
          接受邀请
        </button>
      </div>
      <div className="collab-list">
        {takePreviewItems(invites, 6).map((item) => (
          <div key={item.id} className="collab-list-item">
            <span>{item.code}</span>
            <span>{getWorkspaceRoleLabel(item.role)}</span>
            <span>
              {item.status === 'accepted'
                ? '已接受'
                : item.status === 'revoked'
                  ? '已失效'
                  : '待处理'}
            </span>
          </div>
        ))}
        {invites.length === 0 ? <div className="api-empty">暂无邀请记录</div> : null}
      </div>
    </section>
  )
}

export default InviteJoinSection
