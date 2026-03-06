import React from 'react'
import TelemetryOverviewSection from './telemetry-dashboard/TelemetryOverviewSection'
import ProviderHealthPanel from './telemetry-dashboard/ProviderHealthPanel'
import DbOpsPanel from './telemetry-dashboard/DbOpsPanel'
import ProjectGovernancePanel from './telemetry-dashboard/ProjectGovernancePanel'
import SloSection from './telemetry-dashboard/SloSection'
import { useTelemetryDashboardController } from './telemetry-dashboard/hooks/useTelemetryDashboardController'
import './TelemetryDashboard.css'

const TelemetryDashboard: React.FC = () => {
  const {
    overviewSectionProps,
    sloSectionProps,
    providerHealthPanelProps,
    projectGovernancePanelProps,
    dbOpsPanelProps
  } = useTelemetryDashboardController()

  return (
    <div className="telemetry-dashboard">
      <TelemetryOverviewSection {...overviewSectionProps} />

      <SloSection {...sloSectionProps} />

      <ProviderHealthPanel {...providerHealthPanelProps} />

      <ProjectGovernancePanel {...projectGovernancePanelProps} />

      <DbOpsPanel {...dbOpsPanelProps} />
    </div>
  )
}

export default TelemetryDashboard
