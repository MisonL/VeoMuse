import React from 'react'
import CollabAdvancedSections, {
  type CollabAdvancedSectionsProps
} from './collab/CollabAdvancedSections'
import CommentThreadsSection, { type CommentThreadsSectionProps } from './collab/CommentThreadsSection'
import InviteJoinSection, { type InviteJoinSectionProps } from './collab/InviteJoinSection'
import RealtimeChannelSection, {
  type RealtimeChannelSectionProps
} from './collab/RealtimeChannelSection'
import WorkspaceSection, { type WorkspaceSectionProps } from './collab/WorkspaceSection'

export interface CollabModePanelProps {
  workspaceSectionProps: WorkspaceSectionProps
  inviteJoinSectionProps: InviteJoinSectionProps
  realtimeChannelSectionProps: RealtimeChannelSectionProps
  commentThreadsSectionProps: CommentThreadsSectionProps
  advancedSectionsProps: CollabAdvancedSectionsProps
}

const CollabModePanel: React.FC<CollabModePanelProps> = ({
  workspaceSectionProps,
  inviteJoinSectionProps,
  realtimeChannelSectionProps,
  commentThreadsSectionProps,
  advancedSectionsProps
}) => {
  return (
    <div className="collab-shell collab-command-room" data-testid="area-collab-shell">
      <section className="collab-command-stage">
        <div className="collab-command-card collab-command-card--workspace">
          <WorkspaceSection {...workspaceSectionProps} />
        </div>

        <div className="collab-command-card collab-command-card--invite">
          <InviteJoinSection {...inviteJoinSectionProps} />
        </div>
      </section>

      <section className="collab-live-grid" data-testid="area-collab-live-grid">
        <div className="collab-live-primary">
          <RealtimeChannelSection {...realtimeChannelSectionProps} />
        </div>

        <div className="collab-live-secondary">
          <CommentThreadsSection {...commentThreadsSectionProps} />
        </div>
      </section>

      <section className="collab-governance-deck">
        <CollabAdvancedSections {...advancedSectionsProps} />
      </section>
    </div>
  )
}

export default CollabModePanel
