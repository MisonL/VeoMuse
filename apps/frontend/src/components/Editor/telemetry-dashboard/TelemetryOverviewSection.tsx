import React from 'react'

interface ApiMetricRow {
  name: string
  successText: string
  avgText: string
}

interface TelemetryOverviewSectionProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  fpsSummary: string
  metricsError: string
  showOverview: boolean
  memoryUsageText: string
  systemLoadText: string
  apiRows: ApiMetricRow[]
}

const TelemetryOverviewSection: React.FC<TelemetryOverviewSectionProps> = ({
  canvasRef,
  fpsSummary,
  metricsError,
  showOverview,
  memoryUsageText,
  systemLoadText,
  apiRows
}) => (
  <>
    <section className="metrics-section">
      <h3 className="telemetry-section-title">播放 FPS 稳定性</h3>
      <canvas
        ref={canvasRef}
        width={260}
        height={60}
        className="fps-chart"
        aria-label="播放 FPS 趋势图"
      />
      <p className="sr-only" aria-live="polite">
        {fpsSummary}
      </p>
    </section>

    {metricsError ? (
      <div className="metric-card">
        <span className="label">监控状态</span>
        <span className="value value-error">{metricsError}</span>
      </div>
    ) : null}

    {showOverview ? (
      <section className="metrics-grid">
        <div className="metric-card">
          <span className="label">内存占用</span>
          <span className="value">{memoryUsageText}</span>
        </div>
        <div className="metric-card">
          <span className="label">系统负载</span>
          <span className="value">{systemLoadText}</span>
        </div>
      </section>
    ) : null}

    <section className="api-metrics">
      <h3 className="telemetry-section-title">AI 服务运行状态</h3>
      {apiRows.length > 0 ? (
        apiRows.map((item) => (
          <div key={item.name} className="api-stat-row">
            <span className="api-name">{item.name}</span>
            <span className="api-success">{item.successText}</span>
            <span className="api-avg">{item.avgText}</span>
          </div>
        ))
      ) : (
        <div className="api-empty">暂无指标</div>
      )}
    </section>
  </>
)

export default TelemetryOverviewSection
