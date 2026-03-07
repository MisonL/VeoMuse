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
    commandBarModel,
    overviewModel,
    sloModel,
    providerHealthModel,
    projectGovernancePanelProps,
    dbOpsPanelProps
  } = useTelemetryDashboardController()

  return (
    <div className="telemetry-dashboard" data-tone={commandBarModel.tone}>
      <header className={`telemetry-command-bar ${commandBarModel.tone}`}>
        <div className="telemetry-command-copy">
          <span className="telemetry-command-kicker">ops room / live audit</span>
          <strong>{commandBarModel.headline}</strong>
          <p>{commandBarModel.subtitle}</p>
        </div>
        <div className="telemetry-command-stats">
          <div className="telemetry-command-stat">
            <span>异常信号</span>
            <strong>{commandBarModel.stats.incidentCount}</strong>
          </div>
          <div className="telemetry-command-stat">
            <span>Provider</span>
            <strong>{commandBarModel.stats.providerCount}</strong>
          </div>
          <div className="telemetry-command-stat">
            <span>SLO</span>
            <strong>{commandBarModel.stats.sloStatusText}</strong>
          </div>
        </div>
      </header>

      <TelemetryOverviewSection {...overviewModel.sectionProps} />

      <SloSection {...sloModel.sectionProps} />

      <ProviderHealthPanel {...providerHealthModel.panelProps} />

      <ProjectGovernancePanel {...projectGovernancePanelProps} />

      <DbOpsPanel {...dbOpsPanelProps} />
    </div>
  )
}

export default TelemetryDashboard
