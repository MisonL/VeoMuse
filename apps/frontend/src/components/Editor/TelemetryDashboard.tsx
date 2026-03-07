import React from 'react'
import TelemetryOverviewSection from './telemetry-dashboard/TelemetryOverviewSection'
import ProviderHealthPanel from './telemetry-dashboard/ProviderHealthPanel'
import DbOpsPanel from './telemetry-dashboard/DbOpsPanel'
import ProjectGovernancePanel from './telemetry-dashboard/ProjectGovernancePanel'
import SloSection from './telemetry-dashboard/SloSection'
import { useTelemetryDashboardController } from './telemetry-dashboard/hooks/useTelemetryDashboardController'
import './TelemetryDashboard.css'

export interface TelemetryCommandBarModel {
  tone: 'stable' | 'degraded'
  headline: string
  subtitle: string
  stats: {
    incidentCount: number
    providerCount: number
    sloStatusText: 'Ready' | 'Pending'
  }
}

interface BuildTelemetryCommandBarModelOptions {
  metricsError: string
  sloError: string
  providerRows: Array<{ status: string }>
  hasSloSummary: boolean
}

export const buildTelemetryCommandBarModel = ({
  metricsError,
  sloError,
  providerRows,
  hasSloSummary
}: BuildTelemetryCommandBarModelOptions): TelemetryCommandBarModel => {
  const providerAlertCount = providerRows.filter((row) => {
    const normalized = row.status.toLowerCase()
    return (
      !normalized.includes('ok') &&
      !normalized.includes('healthy') &&
      !normalized.includes('pass')
    )
  }).length
  const incidentCount = Number(Boolean(metricsError)) + Number(Boolean(sloError)) + providerAlertCount
  const tone = incidentCount > 0 ? 'degraded' : 'stable'

  return {
    tone,
    headline: tone === 'stable' ? '总控链路稳定' : '总控链路存在异常待复核',
    subtitle:
      tone === 'stable'
        ? '关键指标、Provider 链路与 SLO 判定处于可播出状态。'
        : `当前已捕获 ${incidentCount} 处异常信号，建议先查看告警与 Provider 健康状态。`,
    stats: {
      incidentCount,
      providerCount: providerRows.length,
      sloStatusText: hasSloSummary ? 'Ready' : 'Pending'
    }
  }
}

const TelemetryDashboard: React.FC = () => {
  const {
    overviewSectionProps,
    sloSectionProps,
    providerHealthPanelProps,
    projectGovernancePanelProps,
    dbOpsPanelProps
  } = useTelemetryDashboardController()
  const commandBarModel = buildTelemetryCommandBarModel({
    metricsError: overviewSectionProps.metricsError,
    sloError: sloSectionProps.sloError,
    providerRows: providerHealthPanelProps.rows,
    hasSloSummary: Boolean(sloSectionProps.sloSummary)
  })

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

      <TelemetryOverviewSection {...overviewSectionProps} />

      <SloSection {...sloSectionProps} />

      <ProviderHealthPanel {...providerHealthPanelProps} />

      <ProjectGovernancePanel {...projectGovernancePanelProps} />

      <DbOpsPanel {...dbOpsPanelProps} />
    </div>
  )
}

export default TelemetryDashboard
