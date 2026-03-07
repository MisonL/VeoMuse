import React, { useMemo } from 'react'
import type { V4AssetReuseRecord, V4AssetReuseResult } from '../../types'

const FALLBACK_TEXT = '-'

const formatLocalDateTime = (value: string | null | undefined) => {
  const text = String(value || '').trim()
  if (!text) return FALLBACK_TEXT
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? FALLBACK_TEXT : date.toLocaleString()
}

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
  const orderedHistoryRecords = useMemo(() => {
    return [...assetReuseHistoryRecords].sort((left, right) => {
      return Date.parse(right.createdAt) - Date.parse(left.createdAt)
    })
  }, [assetReuseHistoryRecords])
  const latestHistoryRecord = orderedHistoryRecords[0] || null
  const sourceProjectCount = new Set(
    orderedHistoryRecords.map((item) => String(item.sourceProjectId || '').trim()).filter(Boolean)
  ).size
  const targetProjectCount = new Set(
    orderedHistoryRecords.map((item) => String(item.targetProjectId || '').trim()).filter(Boolean)
  ).size
  const operatorCount = new Set(
    orderedHistoryRecords.map((item) => String(item.reusedBy || '').trim()).filter(Boolean)
  ).size

  return (
    <section className="creative-card creative-card--archive">
      <div className="creative-section-head">
        <div className="creative-section-copy">
          <span className="creative-section-kicker">asset archive</span>
          <h4>v4 Asset Reuse</h4>
        </div>
        <div className="creative-section-chip">资源回路</div>
      </div>
      <div
        className="lab-metric-grid asset-reuse-summary-grid"
        data-testid="asset-reuse-summary-grid"
      >
        <div className="lab-metric-card lab-metric-card--accent">
          <span>历史记录</span>
          <strong>{orderedHistoryRecords.length}</strong>
          <small>最近复用：{formatLocalDateTime(latestHistoryRecord?.createdAt)}</small>
        </div>
        <div className="lab-metric-card lab-metric-card--neutral">
          <span>来源项目</span>
          <strong>{sourceProjectCount}</strong>
          <small>目标项目 {targetProjectCount} 个</small>
        </div>
        <div className="lab-metric-card lab-metric-card--success">
          <span>复用人</span>
          <strong>{operatorCount}</strong>
          <small>最新操作人：{latestHistoryRecord?.reusedBy || FALLBACK_TEXT}</small>
        </div>
      </div>
      <div className="asset-reuse-panels">
        <div className="asset-reuse-panel">
          <div className="creative-subhead">
            <strong>发起复用</strong>
            <span>把关键资产转运到目标项目，保持风格与制作链路一致。</span>
          </div>
          <div className="asset-reuse-route-spotlight">
            <span className="creative-section-kicker">route preview</span>
            <strong>
              {(assetReuseSourceId || 'asset_xxx').trim() || 'asset_xxx'} →{' '}
              {(assetReuseTargetId || 'project_xxx').trim() || 'project_xxx'}
            </strong>
            <span>{assetReuseNote || '补充说明后，复用动机会和结果一起沉淀到历史轨迹。'}</span>
          </div>
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
        </div>

        <div className="asset-reuse-panel">
          <div className="creative-subhead">
            <strong>复用历史</strong>
            <span>用资产、来源项目和目标项目回看整个复用轨迹。</span>
          </div>
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
          <div className="creative-summary">
            <div>最新记录：{latestHistoryRecord?.id || FALLBACK_TEXT}</div>
            <div>来源项目：{latestHistoryRecord?.sourceProjectId || FALLBACK_TEXT}</div>
            <div>目标项目：{latestHistoryRecord?.targetProjectId || FALLBACK_TEXT}</div>
            <div>最新复用人：{latestHistoryRecord?.reusedBy || FALLBACK_TEXT}</div>
          </div>
          <div className="creative-scene-list">
            {orderedHistoryRecords.map((item) => (
              <div key={item.id} className="creative-scene-item creative-scene-item--rich">
                <div className="scene-headline">
                  <strong>{item.assetId}</strong>
                  <span>{formatLocalDateTime(item.createdAt)}</span>
                </div>
                <div className="scene-meta-line">
                  <span>来源项目：{item.sourceProjectId || '-'}</span>
                  <span>目标项目：{item.targetProjectId || '-'}</span>
                </div>
                <div className="scene-meta-line">
                  <span>复用人：{item.reusedBy || '-'}</span>
                  <span>记录 ID：{item.id}</span>
                  <span>上下文字段：{Object.keys(item.context || {}).length}</span>
                </div>
              </div>
            ))}
            {assetReuseHistoryRecords.length === 0 ? (
              <div className="api-empty">暂无资产复用历史</div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

export default AssetReuseSection
