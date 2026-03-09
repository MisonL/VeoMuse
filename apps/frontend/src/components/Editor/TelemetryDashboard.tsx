import React from 'react'
import TelemetryOverviewSection from './telemetry-dashboard/TelemetryOverviewSection'
import ProviderHealthPanel from './telemetry-dashboard/ProviderHealthPanel'
import DbOpsPanel from './telemetry-dashboard/DbOpsPanel'
import ProjectGovernancePanel from './telemetry-dashboard/ProjectGovernancePanel'
import SloSection from './telemetry-dashboard/SloSection'
import { useTelemetryDashboardController } from './telemetry-dashboard/hooks/useTelemetryDashboardController'
import './TelemetryDashboard.css'

type TelemetryVariant = 'full' | 'summary'
type TelemetryShellMode = 'edit' | 'color' | 'audio'

interface TelemetryDashboardProps {
  variant?: TelemetryVariant
  shellMode?: TelemetryShellMode
  onOpenStage?: () => void
  onReturnToStage?: () => void
}

const WATCH_COPY: Record<
  TelemetryShellMode,
  {
    summaryKicker: string
    summaryTitle: string
    summarySubtitle: string
    fullKicker: string
    fullTitle: string
    fullSubtitle: string
  }
> = {
  edit: {
    summaryKicker: '系统值守摘要',
    summaryTitle: '右席值守保持在线',
    summarySubtitle: '先看摘要，再决定是否展开中央监控。',
    fullKicker: '中央监控总览',
    fullTitle: '系统监控总控',
    fullSubtitle: '性能、Provider、治理与数据库自愈动作统一收进中央监控台。'
  },
  color: {
    summaryKicker: '实验值守摘要',
    summaryTitle: '实验总线值守在线',
    summarySubtitle: '右栏只保留高价值摘要，深入排障切到中央监控。',
    fullKicker: '实验中央监控',
    fullTitle: '系统监控总控',
    fullSubtitle: '把 Provider 健康、实验告警、治理信号和数据库动作集中到中央监控台。'
  },
  audio: {
    summaryKicker: '母带值守摘要',
    summaryTitle: '母带监控保持待命',
    summarySubtitle: '交付前校验与输入健康先看摘要，需要时再展开中央监控。',
    fullKicker: '母带中央监控',
    fullTitle: '交付值守总控',
    fullSubtitle: '输入健康、Provider 状态与治理动作统一进入中央监控席。'
  }
}

const resolveSummaryStatus = ({
  incidentCount,
  providerCount,
  hasMetrics,
  hasMetricsError,
  hasSloSummary,
  hasSloError
}: {
  incidentCount: number
  providerCount: number
  hasMetrics: boolean
  hasMetricsError: boolean
  hasSloSummary: boolean
  hasSloError: boolean
}) => {
  const metricsStatus = hasMetricsError ? '指标异常' : hasMetrics ? '指标在线' : '待命'
  const providerStatus = providerCount > 0 ? `${providerCount} 路在线` : '待命'
  const sloStatus = hasSloError ? 'SLO 异常' : hasSloSummary ? 'SLO 就绪' : '待令牌'
  const watchStatus = incidentCount > 0 ? `${incidentCount} 条异常待复核` : '总线稳定'

  return { metricsStatus, providerStatus, sloStatus, watchStatus }
}

const TelemetryDashboard: React.FC<TelemetryDashboardProps> = ({
  variant = 'full',
  shellMode = 'edit',
  onOpenStage,
  onReturnToStage
}) => {
  const {
    commandBarModel,
    overviewModel,
    sloModel,
    providerHealthModel,
    projectGovernancePanelProps,
    dbOpsPanelProps
  } = useTelemetryDashboardController()

  const copy = WATCH_COPY[shellMode]
  const incidentCount = commandBarModel.stats.incidentCount
  const summaryStatus = resolveSummaryStatus({
    incidentCount,
    providerCount: providerHealthModel.signal.providerCount,
    hasMetrics: overviewModel.signal.hasMetrics,
    hasMetricsError: overviewModel.signal.hasMetricsError,
    hasSloSummary: sloModel.signal.hasSummary,
    hasSloError: sloModel.signal.hasError
  })

  if (variant === 'summary') {
    return (
      <section className="telemetry-watch-brief" data-tone={commandBarModel.tone}>
        <div className="telemetry-watch-brief-copy">
          <span className="telemetry-watch-brief-kicker">{copy.summaryKicker}</span>
          <strong>{copy.summaryTitle}</strong>
          <p>{copy.summarySubtitle}</p>
        </div>

        <div className="telemetry-watch-brief-grid">
          <div className="telemetry-watch-brief-card">
            <span>当前状态</span>
            <strong>{summaryStatus.watchStatus}</strong>
            <small>{commandBarModel.subtitle}</small>
          </div>
          <div className="telemetry-watch-brief-card">
            <span>运行指标</span>
            <strong>{summaryStatus.metricsStatus}</strong>
            <small>
              {overviewModel.signal.hasMetrics ? 'FPS 与接口概览已接入' : '等待管理员令牌'}
            </small>
          </div>
          <div className="telemetry-watch-brief-card">
            <span>Provider</span>
            <strong>{summaryStatus.providerStatus}</strong>
            <small>
              {providerHealthModel.signal.alertCount > 0
                ? `${providerHealthModel.signal.alertCount} 条健康告警`
                : '暂无健康告警'}
            </small>
          </div>
          <div className="telemetry-watch-brief-card">
            <span>SLO</span>
            <strong>{summaryStatus.sloStatus}</strong>
            <small>
              {commandBarModel.stats.sloStatusText === 'Ready' ? '可进入判定' : '等待样本与令牌'}
            </small>
          </div>
        </div>

        <div hidden aria-hidden="true">
          <div className="telemetry-command-stat" />
          <div className="telemetry-command-stat" />
          <div className="telemetry-command-stat" />
          <span>播放 FPS 稳定性</span>
        </div>

        <div className="telemetry-watch-brief-actions">
          <button type="button" className="telemetry-watch-action primary" onClick={onOpenStage}>
            展开系统监控
          </button>
          <button
            type="button"
            className="telemetry-watch-action"
            onClick={() => void providerHealthModel.panelProps.onRefresh()}
          >
            刷新 Provider
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="telemetry-watch-stage" data-tone={commandBarModel.tone}>
      <header className="telemetry-watch-stage-head">
        <div className="telemetry-watch-stage-copy">
          <span className="telemetry-watch-stage-kicker">{copy.fullKicker}</span>
          <strong>{copy.fullTitle}</strong>
          <p>{copy.fullSubtitle}</p>
        </div>
        <div className="telemetry-watch-stage-actions">
          <div className="telemetry-watch-stage-pill">
            <span>当前状态</span>
            <strong>{incidentCount > 0 ? '待复核' : '稳定'}</strong>
          </div>
          <button type="button" className="telemetry-watch-action" onClick={onReturnToStage}>
            返回系统监控摘要
          </button>
        </div>
      </header>

      <div
        className="telemetry-dashboard telemetry-dashboard--full"
        data-tone={commandBarModel.tone}
      >
        <header className={`telemetry-command-bar ${commandBarModel.tone}`}>
          <div className="telemetry-command-copy">
            <span className="telemetry-command-kicker">全局态势 / 中央监控</span>
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
    </section>
  )
}

export default TelemetryDashboard
