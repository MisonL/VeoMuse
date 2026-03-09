import ThemeSwitcher from '../Common/ThemeSwitcher'
import type { ExportQuality, ExportUiStatus, PreviewAspect } from '../../utils/appHelpers'
import type { CenterPanelMode, TopBarDensity } from '../../types/layout'

type AppMode = 'edit' | 'color' | 'audio'

interface AppHeaderProps {
  activeMode: AppMode
  centerMode: CenterPanelMode
  topBarDensity: TopBarDensity
  exportQuality: ExportQuality
  previewAspect: PreviewAspect
  exportUiStatus: ExportUiStatus
  exportButtonLabel: string
  exportFeedbackTitle: string
  exportFeedbackSubtitle: string
  exportProgress: number
  lastExportOutput: string
  isProcessing: boolean
  isExportPending: boolean
  onModeHover: (mode: AppMode) => void
  onModeChange: (mode: AppMode) => void
  onCenterModeChange: (mode: CenterPanelMode) => void
  onTopBarDensityChange: (density: TopBarDensity) => void
  onOpenChannelAccess: () => void
  onOpenGuide: () => void
  onResetLayout: () => void
  onExportQualityChange: (quality: ExportQuality) => void
  onPreviewAspectChange: (aspect: PreviewAspect) => void
  onExport: () => void
}

const MODE_OPTIONS: Array<{ value: AppMode; label: string }> = [
  { value: 'edit', label: '剪辑' },
  { value: 'color', label: '实验室' },
  { value: 'audio', label: '音频大师' }
]

const MODE_RUNTIME_COPY: Record<AppMode, string> = {
  edit: '主编排链路在线，节目单已锁定到剪辑总线',
  color: '实验导播台在线，右席摘要可随时展开中央总控',
  audio: '音频母带链路待命，旁白与节奏引擎可立即接入'
}

const AppHeader = ({
  activeMode,
  centerMode,
  topBarDensity,
  exportQuality,
  previewAspect,
  exportUiStatus,
  exportButtonLabel,
  exportFeedbackTitle,
  exportFeedbackSubtitle,
  exportProgress,
  lastExportOutput,
  isProcessing,
  isExportPending,
  onModeHover,
  onModeChange,
  onCenterModeChange,
  onTopBarDensityChange,
  onOpenChannelAccess,
  onOpenGuide,
  onResetLayout,
  onExportQualityChange,
  onPreviewAspectChange,
  onExport
}: AppHeaderProps) => (
  <header className="pro-panel os-header" data-testid="area-top-header">
    <div className="os-header-bridge">
      <div className="brand-zone">
        <div className="brand-mark">
          <div className="brand-logo">V</div>
          <span className="brand-beacon">直播</span>
        </div>
        <div className="brand-copy">
          <span className="brand-kicker">旗舰 AI 视频总线</span>
          <span className="brand-title">VEOMUSE PRO</span>
        </div>
      </div>

      <div className="header-bridge-status">
        <div className="brand-status-ribbon">
          <span className="brand-status-pill">播出中</span>
          <span className="brand-status-copy">导播总线稳定 / 三路节目待播</span>
        </div>
        <div className="mode-runtime">
          <span className="mode-runtime-label">当前工位</span>
          <span className="mode-runtime-copy">{MODE_RUNTIME_COPY[activeMode]}</span>
        </div>
      </div>
    </div>

    <div className="os-header-deck">
      <div className="header-center-stack">
        <div
          className="mode-selector"
          data-guide="mode-selector"
          data-testid="area-mode-selector"
          role="group"
          aria-label="主工作模式"
        >
          {MODE_OPTIONS.map((mode) => (
            <button
              key={mode.value}
              type="button"
              className={`mode-tab ${activeMode === mode.value ? 'active' : ''}`}
              onMouseEnter={() => onModeHover(mode.value)}
              onClick={() => onModeChange(mode.value)}
              data-testid={`btn-mode-${mode.value}`}
              aria-pressed={activeMode === mode.value}
              aria-current={activeMode === mode.value ? 'page' : undefined}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      <div className="header-actions" data-testid="area-header-actions">
        <div
          className="header-actions-group header-actions-group--quiet header-actions-layout"
          data-testid="group-header-layout"
        >
          <div className="header-segment" data-testid="group-center-mode">
            <button
              type="button"
              className={`header-segment-btn ${centerMode === 'fit' ? 'active' : ''}`}
              onClick={() => onCenterModeChange('fit')}
              data-testid="btn-center-mode-fit"
              aria-pressed={centerMode === 'fit'}
            >
              均衡
            </button>
            <button
              type="button"
              className={`header-segment-btn ${centerMode === 'focus' ? 'active' : ''}`}
              onClick={() => onCenterModeChange('focus')}
              data-testid="btn-center-mode-focus"
              aria-pressed={centerMode === 'focus'}
            >
              聚焦
            </button>
          </div>
          <div className="header-segment" data-testid="group-topbar-density">
            <button
              type="button"
              className={`header-segment-btn ${topBarDensity === 'comfortable' ? 'active' : ''}`}
              onClick={() => onTopBarDensityChange('comfortable')}
              data-testid="btn-density-comfortable"
              aria-pressed={topBarDensity === 'comfortable'}
            >
              舒展
            </button>
            <button
              type="button"
              className={`header-segment-btn ${topBarDensity === 'compact' ? 'active' : ''}`}
              onClick={() => onTopBarDensityChange('compact')}
              data-testid="btn-density-compact"
              aria-pressed={topBarDensity === 'compact'}
            >
              紧凑
            </button>
          </div>
        </div>
        <div
          className="header-actions-group header-actions-group--quiet header-actions-quick"
          data-testid="group-header-quick-actions"
        >
          <button
            id="btn-open-channel-access"
            className="channel-entry-btn"
            onClick={onOpenChannelAccess}
            data-testid="btn-open-channel-access"
            type="button"
          >
            AI接入
          </button>
          <button
            id="btn-open-guide"
            className="guide-toggle-btn"
            onClick={onOpenGuide}
            data-testid="btn-open-guide"
            type="button"
          >
            使用引导
          </button>
          <ThemeSwitcher />
          <button
            id="btn-reset-layout"
            className="layout-reset-btn"
            onClick={onResetLayout}
            data-testid="btn-reset-layout"
            type="button"
          >
            重置布局
          </button>
        </div>
        <div
          className="header-actions-group header-actions-export"
          data-testid="group-header-export"
        >
          <select
            id="export-quality"
            name="exportQuality"
            aria-label="导出规格"
            value={exportQuality}
            onChange={(event) => onExportQualityChange(event.target.value as ExportQuality)}
            className="header-select"
            data-testid="select-export-quality"
          >
            <option value="standard">标准导出</option>
            <option value="4k-hdr">4K HDR</option>
            <option value="spatial-vr">空间视频</option>
          </select>
          <select
            id="preview-aspect"
            name="previewAspect"
            aria-label="预览宽高比"
            value={previewAspect}
            onChange={(event) => onPreviewAspectChange(event.target.value as PreviewAspect)}
            className="header-select preview-aspect-select"
            data-testid="select-preview-aspect"
          >
            <option value="16:9">预览 16:9</option>
            <option value="21:9">预览 21:9</option>
          </select>
          <div className="export-action-wrap">
            <button
              id="btn-export"
              className={`export-btn ${exportUiStatus === 'pending' ? 'is-pending' : ''} ${exportUiStatus === 'done' ? 'is-done' : ''} ${exportUiStatus === 'error' ? 'is-error' : ''}`}
              onClick={onExport}
              disabled={isProcessing || isExportPending}
              data-testid="btn-export"
              type="button"
            >
              {exportButtonLabel}
            </button>
            {exportUiStatus !== 'idle' ? (
              <div
                className={`export-feedback-pop ${exportUiStatus}`}
                role="status"
                aria-live="polite"
              >
                <div className="export-feedback-top">
                  <span className="export-feedback-title">{exportFeedbackTitle}</span>
                  {exportUiStatus === 'pending' ? (
                    <span className="export-feedback-percent">{Math.round(exportProgress)}%</span>
                  ) : null}
                </div>
                <div className="export-feedback-subtitle">{exportFeedbackSubtitle}</div>
                {exportUiStatus === 'pending' ? (
                  <div className="export-progress-track">
                    <span
                      className="export-progress-fill"
                      style={{ width: `${Math.max(6, Math.min(100, exportProgress))}%` }}
                    />
                  </div>
                ) : null}
                {exportUiStatus === 'done' && lastExportOutput ? (
                  <div className="export-feedback-path" title={lastExportOutput}>
                    {lastExportOutput}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  </header>
)

export default AppHeader
