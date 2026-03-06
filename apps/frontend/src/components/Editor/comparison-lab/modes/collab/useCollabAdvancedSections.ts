import React from 'react'

export interface CollabAdvancedSectionsState {
  showAdvancedSections: boolean
  showAdvancedGovernance: boolean
  showAdvancedPermissionMerge: boolean
  showAdvancedOps: boolean
  showAdvancedStorage: boolean
}

export interface CollabAdvancedSectionsControls extends CollabAdvancedSectionsState {
  toggleAdvancedSections: () => void
  toggleAdvancedGovernance: () => void
  toggleAdvancedPermissionMerge: () => void
  toggleAdvancedOps: () => void
  toggleAdvancedStorage: () => void
}

export const useCollabAdvancedSections = (): CollabAdvancedSectionsControls => {
  const [showAdvancedSections, setShowAdvancedSections] = React.useState(false)
  const [showAdvancedGovernance, setShowAdvancedGovernance] = React.useState(true)
  const [showAdvancedPermissionMerge, setShowAdvancedPermissionMerge] = React.useState(true)
  const [showAdvancedOps, setShowAdvancedOps] = React.useState(true)
  const [showAdvancedStorage, setShowAdvancedStorage] = React.useState(true)

  return {
    showAdvancedSections,
    showAdvancedGovernance,
    showAdvancedPermissionMerge,
    showAdvancedOps,
    showAdvancedStorage,
    toggleAdvancedSections: () => setShowAdvancedSections((prev) => !prev),
    toggleAdvancedGovernance: () => setShowAdvancedGovernance((prev) => !prev),
    toggleAdvancedPermissionMerge: () => setShowAdvancedPermissionMerge((prev) => !prev),
    toggleAdvancedOps: () => setShowAdvancedOps((prev) => !prev),
    toggleAdvancedStorage: () => setShowAdvancedStorage((prev) => !prev)
  }
}
