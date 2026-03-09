import React from 'react'
import type { LabAssetOption, ModelOption } from '../types'

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
    <div className="lab-split-engine">
      <div className="model-pane">
        <div className="pane-head">
          <div className="pane-overlay">
            <span className="model-name">
              {availableModels.find((m) => m.id === leftModel)?.name || leftModel}
            </span>
            <div className="metric-chip">A 通道</div>
          </div>
          <div className="pane-controls">
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
            <button aria-label="推荐 A 通道" onClick={() => onRequestRecommendation('left')}>
              推荐
            </button>
          </div>
        </div>
        <div className="pane-viewport">
          {leftAsset?.src ? (
            <video ref={leftVideoRef} src={leftAsset.src} controls playsInline />
          ) : (
            <div className="empty-pane">
              <span className="empty-pane-kicker">A 通道待装载</span>
              <strong>先放入素材，马上开始双通道对照。</strong>
              <p>从左侧素材库拖入片段，或直接打开媒体资源面板快速选片。</p>
              {onOpenAssets ? (
                <button type="button" className="empty-pane-cta" onClick={onOpenAssets}>
                  打开媒体资源
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
            <span className="model-name">
              {availableModels.find((m) => m.id === rightModel)?.name || rightModel}
            </span>
            <div className="metric-chip secondary">B 通道</div>
          </div>
          <div className="pane-controls">
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
            <button aria-label="推荐 B 通道" onClick={() => onRequestRecommendation('right')}>
              推荐
            </button>
          </div>
        </div>
        <div className="pane-viewport">
          {rightAsset?.src ? (
            <video ref={rightVideoRef} src={rightAsset.src} controls playsInline />
          ) : (
            <div className="empty-pane">
              <span className="empty-pane-kicker">B 通道待装载</span>
              <strong>右侧画面还空着，补齐后才能看出模型差异。</strong>
              <p>建议使用同一批素材做双路对照，判断速度会更稳定。</p>
              {onOpenAssets ? (
                <button type="button" className="empty-pane-cta" onClick={onOpenAssets}>
                  打开媒体资源
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CompareModePanel
