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
  const providerAlertCount = providerHealthPanelProps.rows.filter((row) => {
    const normalized = row.status.toLowerCase()
    return (
      !normalized.includes('ok') &&
      !normalized.includes('healthy') &&
      !normalized.includes('pass')
    )
  }).length
  const incidentCount =
    Number(Boolean(overviewSectionProps.metricsError)) +
    Number(Boolean(sloSectionProps.sloError)) +
    providerAlertCount
  const telemetryTone = incidentCount > 0 ? 'degraded' : 'stable'
  const telemetryHeadline =
    telemetryTone === 'stable' ? '总控链路稳定' : '总控链路存在异常待复核'
  const telemetrySubtitle =
    telemetryTone === 'stable'
      ? '关键指标、Provider 链路与 SLO 判定处于可播出状态。'
      : `当前已捕获 ${incidentCount} 处异常信号，建议先查看告警与 Provider 健康状态。`

  return (
    <div className="telemetry-dashboard" data-tone={telemetryTone}>
      <header className={`telemetry-command-bar ${telemetryTone}`}>
        <div className="telemetry-command-copy">
          <span className="telemetry-command-kicker">ops room / live audit</span>
          <strong>{telemetryHeadline}</strong>
          <p>{telemetrySubtitle}</p>
        </div>
        <div className="telemetry-command-stats">
          <div className="telemetry-command-stat">
            <span>异常信号</span>
            <strong>{incidentCount}</strong>
          </div>
          <div className="telemetry-command-stat">
            <span>Provider</span>
            <strong>{providerHealthPanelProps.rows.length}</strong>
          </div>
          <div className="telemetry-command-stat">
            <span>SLO</span>
            <strong>{sloSectionProps.sloSummary ? 'Ready' : 'Pending'}</strong>
          </div>
        </div>
      </header>

      <TelemetryOverviewSection {...overviewSectionProps} />

      <SloSection {...sloSectionProps} />

      <ProviderHealthPanel {...providerHealthPanelProps} />

      <ProjectGovernancePanel {...projectGovernancePanelProps} />

      <DbOpsPanel {...dbOpsPanelProps} />
    </div>
  )
}

export default TelemetryDashboard
