import ThemeSwitcher from '../Common/ThemeSwitcher'
import {
  getExportButtonLabel,
  resolveExportFeedbackSubtitle,
  resolveExportFeedbackTitle,
  resolveExportQualityLabel,
  type ExportProgressStage,
  type ExportQuality,
  type ExportUiStatus,
  type PreviewAspect
} from '../../utils/appHelpers'
import type { CenterPanelMode } from '../../types/layout'

type AppMode = 'edit' | 'color' | 'audio'

interface AppHeaderProps {
  activeMode: AppMode
  centerMode: CenterPanelMode
  previewAspect: PreviewAspect
  exportUiStatus: ExportUiStatus
  exportProgress: number
  exportStage: ExportProgressStage
  exportQuality: ExportQuality
  exportMessage?: string
  lastExportOutput: string
  isProcessing: boolean
  isExportPending: boolean
  onModeHover: (mode: AppMode) => void
  onModeChange: (mode: AppMode) => void
  onCenterModeChange: (mode: CenterPanelMode) => void
  onPreviewAspectChange: (aspect: PreviewAspect) => void
  onExport: () => void
}

const MODE_OPTIONS: Array<{ value: AppMode; label: string }> = [
  { value: 'edit', label: '剪辑' },
  { value: 'color', label: '实验室' },
  { value: 'audio', label: '音频大师' }
]

const DIRECTOR_FLOW_STEPS = ['Prompt', 'Shots', 'Timeline', 'Inspect', 'Render']

const DirectorFlowBus = () => (
  <div
    className="director-flow-bus"
    data-testid="director-flow-bus"
    data-visual-system="nebula-flow"
    aria-label="导演流总线"
  >
    <span className="director-flow-kicker">Director Flow</span>
    <span className="director-flow-steps" aria-hidden="true">
      {DIRECTOR_FLOW_STEPS.map((step) => (
        <span key={step}>{step}</span>
      ))}
    </span>
  </div>
)

const AppHeader = ({
  activeMode,
  centerMode,
  previewAspect,
  exportUiStatus,
  exportProgress,
  exportStage,
  exportQuality,
  exportMessage,
  lastExportOutput,
  isProcessing,
  isExportPending,
  onModeHover,
  onModeChange,
  onCenterModeChange,
  onPreviewAspectChange,
  onExport
}: AppHeaderProps) => (
  <header
    className="pro-panel os-header"
    data-testid="area-top-header"
    data-shell-role="director-flow-command"
  >
    <div className="os-header-left">
      <div className="brand-zone">
        <div className="brand-mark">
          <div className="brand-logo">V</div>
        </div>
        <div className="brand-copy">
          <span className="brand-title">VEOMUSE PRO</span>
        </div>
      </div>
      <div className="header-status-lite">
        <span className="status-indicator live"></span>
        <span className="status-label">
          {MODE_OPTIONS.find((m) => m.value === activeMode)?.label || activeMode}
        </span>
      </div>
    </div>

    <DirectorFlowBus />

    <div className="os-header-center">
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

    <div className="os-header-right" data-testid="area-header-actions">
      <div className="header-actions-group header-actions-layout">
        <div className="header-segment" role="group" aria-label="中心布局模式">
          <button
            type="button"
            className={`header-segment-btn ${centerMode === 'fit' ? 'active' : ''}`}
            data-testid="btn-center-mode-fit"
            aria-pressed={centerMode === 'fit'}
            onClick={() => onCenterModeChange('fit')}
          >
            适配
          </button>
          <button
            type="button"
            className={`header-segment-btn ${centerMode === 'focus' ? 'active' : ''}`}
            data-testid="btn-center-mode-focus"
            aria-pressed={centerMode === 'focus'}
            onClick={() => onCenterModeChange('focus')}
          >
            聚焦
          </button>
        </div>
      </div>

      <div className="header-actions-group">
        <ThemeSwitcher />
      </div>

      <div className="header-actions-divider" />

      <div className="header-actions-group header-actions-export">
        <div className="header-control-item">
          <span className="control-label-mini">画幅</span>
          <select
            id="preview-aspect-select"
            name="previewAspect"
            value={previewAspect}
            onChange={(event) => onPreviewAspectChange(event.target.value as PreviewAspect)}
            className="header-select-compact"
            data-testid="select-preview-aspect"
          >
            <option value="16:9">16:9 (宽屏)</option>
            <option value="21:9">21:9 (宽幅)</option>
          </select>
        </div>
        <div className="export-action-wrap">
          <button
            id="btn-export"
            data-testid="btn-export"
            className={`export-btn-compact ${exportUiStatus === 'pending' ? 'is-pending' : ''} ${exportUiStatus === 'done' ? 'is-done' : ''}`}
            onClick={onExport}
            disabled={isProcessing || isExportPending}
          >
            {getExportButtonLabel(isExportPending, exportUiStatus, exportProgress)}
          </button>
          {exportUiStatus !== 'idle' && (
            <div className={`export-feedback-pop ${exportUiStatus}`}>
              <div className="export-feedback-top">
                <span className="export-feedback-title">
                  {resolveExportFeedbackTitle(exportStage)}
                </span>
                <span className="export-feedback-percent">{exportProgress}%</span>
              </div>
              <div className="export-progress-track" aria-hidden="true">
                <span className="export-progress-fill" style={{ width: `${exportProgress}%` }} />
              </div>
              <span className="export-feedback-subtitle">
                {resolveExportFeedbackSubtitle(
                  exportUiStatus,
                  resolveExportQualityLabel(exportQuality),
                  exportMessage
                )}
              </span>
              {lastExportOutput && <span className="export-feedback-path">{lastExportOutput}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  </header>
)

export default AppHeader
