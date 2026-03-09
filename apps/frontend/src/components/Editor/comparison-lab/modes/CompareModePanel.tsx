import React from 'react'
import type { LabAssetOption, ModelOption } from '../types'

const resolveModelLabel = (models: ModelOption[], modelId: string) =>
  models.find((item) => item.id === modelId)?.name || modelId

const resolveModelVersion = (modelId: string) => modelId.replace(/_/g, '-').toUpperCase()

const resolveAssetSummary = (asset?: LabAssetOption) => asset?.name || '尚未绑定素材'

interface CompareModePanelProps {
  availableModels: ModelOption[]
  assets: LabAssetOption[]
  leftModel: string
  rightModel: string
  leftAssetId: string
  rightAssetId: string
  leftAsset?: LabAssetOption
  rightAsset?: LabAssetOption
  leftVideoRef: React.RefObject<HTMLVideoElement | null>
  rightVideoRef: React.RefObject<HTMLVideoElement | null>
  onLeftModelChange: (value: string) => void
  onRightModelChange: (value: string) => void
  onLeftAssetChange: (value: string) => void
  onRightAssetChange: (value: string) => void
  onRequestRecommendation: (side: 'left' | 'right') => void
  onOpenAssets?: () => void
}

const CompareModePanel: React.FC<CompareModePanelProps> = ({
  availableModels,
  assets,
  leftModel,
  rightModel,
  leftAssetId,
  rightAssetId,
  leftAsset,
  rightAsset,
  leftVideoRef,
  rightVideoRef,
  onLeftModelChange,
  onRightModelChange,
  onLeftAssetChange,
  onRightAssetChange,
  onRequestRecommendation,
  onOpenAssets
}) => {
  return (
    <div className="compare-mode-shell">
      <section className="compare-command-deck">
        <div className="compare-command-copy">
          <span className="compare-command-kicker">A/B 配置台</span>
          <strong>统一设置本轮对比组合</strong>
          <p>先在这里完成模型与素材配对，再在下方直接查看双通道结果。</p>
        </div>

        <div className="compare-command-grid">
          <div className="compare-command-group">
            <span className="compare-command-label">A 通道</span>
            <select
              name="leftModel"
              value={leftModel}
              aria-label="A 通道模型"
              onChange={(e) => onLeftModelChange(e.target.value)}
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <select
              name="leftAssetId"
              value={leftAssetId}
              aria-label="A 通道素材"
              onChange={(e) => onLeftAssetChange(e.target.value)}
            >
              <option value="">选择素材</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label="推荐 A 通道"
              onClick={() => onRequestRecommendation('left')}
            >
              推荐 A
            </button>
          </div>

          <div className="compare-command-group">
            <span className="compare-command-label">B 通道</span>
            <select
              name="rightModel"
              value={rightModel}
              aria-label="B 通道模型"
              onChange={(e) => onRightModelChange(e.target.value)}
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <select
              name="rightAssetId"
              value={rightAssetId}
              aria-label="B 通道素材"
              onChange={(e) => onRightAssetChange(e.target.value)}
            >
              <option value="">选择素材</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label="推荐 B 通道"
              onClick={() => onRequestRecommendation('right')}
            >
              推荐 B
            </button>
          </div>
        </div>

        {onOpenAssets ? (
          <button type="button" className="compare-command-link" onClick={onOpenAssets}>
            打开素材库，补齐对比素材
          </button>
        ) : null}
      </section>

      <div className="lab-split-engine">
        <div className="model-pane">
          <div className="pane-head">
            <div className="pane-overlay">
              <div className="pane-title-stack">
                <span className="model-name">{resolveModelLabel(availableModels, leftModel)}</span>
                <div className="pane-meta-row">
                  <span className="pane-meta-chip">模型 ID · {resolveModelVersion(leftModel)}</span>
                  <span className="pane-meta-copy">素材 · {resolveAssetSummary(leftAsset)}</span>
                </div>
              </div>
              <div className="metric-chip">A 通道</div>
            </div>
          </div>
          <div className="pane-viewport">
            {leftAsset?.src ? (
              <video ref={leftVideoRef} src={leftAsset.src} controls playsInline />
            ) : (
              <div className="empty-pane">
                <span className="empty-pane-kicker">A 通道待装载</span>
                <strong>先放入素材，马上开始双通道对照。</strong>
                <p>从中央控制台补齐素材后，这里会立即进入左侧预览。</p>
                {onOpenAssets ? (
                  <button type="button" className="empty-pane-cta" onClick={onOpenAssets}>
                    打开素材库
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="lab-axis">
          <div className="axis-line" />
          <div className="axis-handle">VS</div>
        </div>

        <div className="model-pane">
          <div className="pane-head">
            <div className="pane-overlay">
              <div className="pane-title-stack">
                <span className="model-name">{resolveModelLabel(availableModels, rightModel)}</span>
                <div className="pane-meta-row">
                  <span className="pane-meta-chip">
                    模型 ID · {resolveModelVersion(rightModel)}
                  </span>
                  <span className="pane-meta-copy">素材 · {resolveAssetSummary(rightAsset)}</span>
                </div>
              </div>
              <div className="metric-chip secondary">B 通道</div>
            </div>
          </div>
          <div className="pane-viewport">
            {rightAsset?.src ? (
              <video ref={rightVideoRef} src={rightAsset.src} controls playsInline />
            ) : (
              <div className="empty-pane">
                <span className="empty-pane-kicker">B 通道待装载</span>
                <strong>右侧画面还空着，补齐后才能看出模型差异。</strong>
                <p>建议为 A/B 选用同一批素材，保证对照判断更稳定。</p>
                {onOpenAssets ? (
                  <button type="button" className="empty-pane-cta" onClick={onOpenAssets}>
                    打开素材库
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CompareModePanel
