import React from 'react'
import type { V4AssetReuseRecord, V4AssetReuseResult } from '../../types'

export interface AssetReuseSectionProps {
  assetReuseSourceId: string
  assetReuseTargetId: string
  assetReuseNote: string
  assetReuseResult: V4AssetReuseResult | null
  assetReuseHistoryAssetId: string
  assetReuseHistorySourceProjectId: string
  assetReuseHistoryTargetProjectId: string
  assetReuseHistoryLimit: string
  assetReuseHistoryOffset: string
  assetReuseHistoryRecords: V4AssetReuseRecord[]
  isV4Busy: boolean
  onAssetReuseSourceIdChange: (value: string) => void
  onAssetReuseTargetIdChange: (value: string) => void
  onAssetReuseNoteChange: (value: string) => void
  onCallAssetReuse: () => void
  onAssetReuseHistoryAssetIdChange: (value: string) => void
  onAssetReuseHistorySourceProjectIdChange: (value: string) => void
  onAssetReuseHistoryTargetProjectIdChange: (value: string) => void
  onAssetReuseHistoryLimitChange: (value: string) => void
  onAssetReuseHistoryOffsetChange: (value: string) => void
  onQueryAssetReuseHistory: () => void
}

const AssetReuseSection: React.FC<AssetReuseSectionProps> = ({
  assetReuseSourceId,
  assetReuseTargetId,
  assetReuseNote,
  assetReuseResult,
  assetReuseHistoryAssetId,
  assetReuseHistorySourceProjectId,
  assetReuseHistoryTargetProjectId,
  assetReuseHistoryLimit,
  assetReuseHistoryOffset,
  assetReuseHistoryRecords,
  isV4Busy,
  onAssetReuseSourceIdChange,
  onAssetReuseTargetIdChange,
  onAssetReuseNoteChange,
  onCallAssetReuse,
  onAssetReuseHistoryAssetIdChange,
  onAssetReuseHistorySourceProjectIdChange,
  onAssetReuseHistoryTargetProjectIdChange,
  onAssetReuseHistoryLimitChange,
  onAssetReuseHistoryOffsetChange,
  onQueryAssetReuseHistory
}) => {
  return (
    <>
      <section className="creative-card">
        <h4>v4 Asset Reuse</h4>
        <div className="lab-inline-fields">
          <label className="lab-field">
            <span>来源 Asset</span>
            <input
              name="v4AssetReuseSourceId"
              value={assetReuseSourceId}
              onChange={(event) => onAssetReuseSourceIdChange(event.target.value)}
              placeholder="asset_xxx"
            />
          </label>
          <label className="lab-field">
            <span>目标项目 ID</span>
            <input
              name="v4AssetReuseTargetId"
              value={assetReuseTargetId}
              onChange={(event) => onAssetReuseTargetIdChange(event.target.value)}
              placeholder="project_xxx"
            />
          </label>
        </div>
        <label className="lab-field">
          <span>说明</span>
          <input
            name="v4AssetReuseNote"
            value={assetReuseNote}
            onChange={(event) => onAssetReuseNoteChange(event.target.value)}
            placeholder="reuse for style consistency"
          />
        </label>
        <div className="lab-inline-actions">
          <button
            disabled={!assetReuseSourceId.trim() || !assetReuseTargetId.trim() || isV4Busy}
            onClick={onCallAssetReuse}
          >
            调用 Asset Reuse
          </button>
        </div>
        <div className="creative-summary">
          <div>记录: {assetReuseResult?.id || '-'}</div>
          <div>Asset: {assetReuseResult?.assetId || '-'}</div>
          <div>目标项目: {assetReuseResult?.targetProjectId || '-'}</div>
        </div>
      </section>

      <section className="creative-card">
        <h4>v4 资产复用历史</h4>
        <div className="lab-inline-fields">
          <label className="lab-field">
            <span>资产 ID</span>
            <input
              name="v4AssetReuseHistoryAssetId"
              value={assetReuseHistoryAssetId}
              onChange={(event) => onAssetReuseHistoryAssetIdChange(event.target.value)}
              placeholder="为空则查询全部"
            />
          </label>
          <label className="lab-field">
            <span>来源项目 ID</span>
            <input
              name="v4AssetReuseHistorySourceProjectId"
              value={assetReuseHistorySourceProjectId}
              onChange={(event) => onAssetReuseHistorySourceProjectIdChange(event.target.value)}
              placeholder="可选"
            />
          </label>
          <label className="lab-field">
            <span>目标项目 ID</span>
            <input
              name="v4AssetReuseHistoryTargetProjectId"
              value={assetReuseHistoryTargetProjectId}
              onChange={(event) => onAssetReuseHistoryTargetProjectIdChange(event.target.value)}
              placeholder="可选"
            />
          </label>
        </div>
        <div className="lab-inline-fields">
          <label className="lab-field">
            <span>查询数量</span>
            <input
              type="number"
              min={1}
              name="v4AssetReuseHistoryLimit"
              value={assetReuseHistoryLimit}
              onChange={(event) => onAssetReuseHistoryLimitChange(event.target.value)}
              placeholder="20"
            />
          </label>
          <label className="lab-field">
            <span>偏移量</span>
            <input
              type="number"
              min={0}
              name="v4AssetReuseHistoryOffset"
              value={assetReuseHistoryOffset}
              onChange={(event) => onAssetReuseHistoryOffsetChange(event.target.value)}
              placeholder="0"
            />
          </label>
        </div>
        <div className="lab-inline-actions">
          <button disabled={isV4Busy} onClick={onQueryAssetReuseHistory}>
            查询历史
          </button>
        </div>
        <div className="creative-scene-list">
          {assetReuseHistoryRecords.map((item) => (
            <div key={item.id} className="creative-scene-item">
              <div className="scene-headline">
                <strong>{item.assetId}</strong>
                <span>{new Date(item.createdAt).toLocaleString()}</span>
              </div>
              <div className="scene-meta-line">
                <span>来源项目：{item.sourceProjectId || '-'}</span>
                <span>目标项目：{item.targetProjectId || '-'}</span>
              </div>
              <div className="scene-meta-line">
                <span>复用人：{item.reusedBy || '-'}</span>
                <span>记录 ID：{item.id}</span>
              </div>
            </div>
          ))}
          {assetReuseHistoryRecords.length === 0 ? (
            <div className="api-empty">暂无资产复用历史</div>
          ) : null}
        </div>
      </section>
    </>
  )
}

export default AssetReuseSection
