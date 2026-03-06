import React from 'react'
import type {
  JourneyErrorKind,
  JourneyFailedStage,
  JourneyStep
} from '../../../../../store/journeyTelemetryStore'
import type { AuthProfile, LabMode, WorkspaceRole } from '../../types'
import { useCollabModeController } from '../../hooks/useCollabModeController'
import CollabModePanel from '../CollabModePanel'

type ShowToast = (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void

export interface CollabModeContainerProps {
  authProfile: AuthProfile | null
  workspaceName: string
  workspaceOwner: string
  workspaceId: string
  setWorkspaceName: (value: string) => void
  setWorkspaceOwner: (value: string) => void
  setWorkspaceId: (value: string) => void
  projectId: string
  setProjectId: (value: string) => void
  memberName: string
  setMemberName: (value: string) => void
  collabRole: WorkspaceRole
  setCollabRole: (value: WorkspaceRole) => void
  inviteRole: WorkspaceRole
  setInviteRole: (value: WorkspaceRole) => void
  inviteCode: string
  setInviteCode: (value: string) => void
  uploadFileName: string
  setUploadFileName: (value: string) => void
  effectiveOrganizationId: string
  selectOrganization: (organizationId: string) => void
  labMode: LabMode
  openChannelPanel: () => void
  showToast: ShowToast
  markJourneyStep: (
    step: JourneyStep,
    payload?: { organizationId?: string; workspaceId?: string }
  ) => void
  reportJourney: (
    success: boolean,
    payload?: {
      reason?: string
      durationMs?: number
      failedStage?: JourneyFailedStage
      errorKind?: JourneyErrorKind
      httpStatus?: number
    }
  ) => Promise<boolean>
}

const CollabModeContainer: React.FC<CollabModeContainerProps> = (props) => {
  const panelProps = useCollabModeController(props)

  return <CollabModePanel {...panelProps} />
}

export default CollabModeContainer
