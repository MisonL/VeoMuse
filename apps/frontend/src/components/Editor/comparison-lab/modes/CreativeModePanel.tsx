import React from 'react'
import type { CreativeRun } from '../types'

interface CreativeModePanelProps {
  creativeScript: string
  creativeStyle: string
  commitScore: number
  isCreativeBusy: boolean
  creativeRun: CreativeRun | null
  creativeRunFeedback: string
  sceneFeedbackMap: Record<string, string>
  creativeVersions: CreativeRun[]
  onCreativeScriptChange: (value: string) => void
  onCreativeStyleChange: (value: string) => void
  onCommitScoreChange: (value: number) => void
  onCreateCreativeRun: () => void
  onApplyCreativeFeedback: () => void
  onCommitCreativeRun: () => void
  onRefreshCreativeVersions: () => void
  onCreativeRunFeedbackChange: (value: string) => void
  onSceneFeedbackChange: (sceneId: string, value: string) => void
  onSwitchCreativeRunVersion: (run: CreativeRun) => void
}

const CreativeModePanel: React.FC<CreativeModePanelProps> = ({
  creativeScript,
  creativeStyle,
  commitScore,
  isCreativeBusy,
  creativeRun,
  creativeRunFeedback,
  sceneFeedbackMap,
  creativeVersions,
  onCreativeScriptChange,
  onCreativeStyleChange,
  onCommitScoreChange,
  onCreateCreativeRun,
  onApplyCreativeFeedback,
  onCommitCreativeRun,
  onRefreshCreativeVersions,
  onCreativeRunFeedbackChange,
  onSceneFeedbackChange,
  onSwitchCreativeRunVersion
}) => {
  return (
    <div className="creative-shell">
      <section className="creative-card">
        <h4>创意闭环引擎</h4>
        <label className="lab-field">
          <span>脚本</span>
          <textarea
            name="creativeScript"
            value={creativeScript}
            onChange={(event) => onCreativeScriptChange(event.target.value)}
            placeholder="输入剧情脚本，系统将自动拆解分镜并支持版本闭环反馈"
          />
        </label>
        <div className="lab-inline-fields">
          <label className="lab-field">
            <span>风格</span>
            <select name="creativeStyle" value={creativeStyle} onChange={(event) => onCreativeStyleChange(event.target.value)}>
              <option value="cinematic">cinematic</option>
              <option value="realistic">realistic</option>
              <option value="anime">anime</option>
              <option value="commercial">commercial</option>
            </select>
          </label>
          <label className="lab-field">
            <span>质量分</span>
            <input
              type="number"
              name="commitScore"
              min={0}
              max={1}
              step={0.05}
              value={commitScore}
              onChange={(event) => onCommitScoreChange(Math.max(0, Math.min(1, Number(event.target.value || 0))))}
            />
          </label>
        </div>
        <div className="lab-inline-actions">
          <button disabled={isCreativeBusy} onClick={onCreateCreativeRun}>
            {isCreativeBusy ? '处理中...' : '创建 Run'}
          </button>
          <button disabled={!creativeRun?.id || isCreativeBusy} onClick={onApplyCreativeFeedback}>应用反馈</button>
          <button disabled={!creativeRun?.id || isCreativeBusy} onClick={onCommitCreativeRun}>提交完成</button>
          <button disabled={!creativeRun?.id || isCreativeBusy} onClick={onRefreshCreativeVersions}>刷新版本链</button>
        </div>
      </section>

      <section className="creative-card">
        <h4>运行详情</h4>
        {creativeRun ? (
          <>
            <div className="creative-summary">
              <div>ID: {creativeRun.id}</div>
              <div>状态: {creativeRun.status}</div>
              <div>版本: v{creativeRun.version || 1}</div>
              <div>父版本: {creativeRun.parentRunId || '-'}</div>
            </div>
            <label className="lab-field">
              <span>整片反馈</span>
              <textarea
                name="creativeRunFeedback"
                value={creativeRunFeedback}
                onChange={(event) => onCreativeRunFeedbackChange(event.target.value)}
                placeholder="例如：节奏更紧凑，镜头 2 需要更强反差"
              />
            </label>
            <div className="creative-scene-list">
              {creativeRun.scenes.map(scene => (
                <div key={scene.id} className="creative-scene-item">
                  <div className="scene-headline">
                    <strong>{scene.order + 1}. {scene.title}</strong>
                    <span>rev {scene.revision || 1} · {scene.status}</span>
                  </div>
                  <div className="scene-meta-line">
                    <span>{scene.duration}s</span>
                    <span>{scene.lastFeedback || '暂无反馈'}</span>
                  </div>
                  <input
                    type="text"
                    name={`sceneFeedback-${scene.id}`}
                    value={sceneFeedbackMap[scene.id] || ''}
                    onChange={(event) => onSceneFeedbackChange(scene.id, event.target.value)}
                    placeholder="该分镜反馈"
                  />
                </div>
              ))}
            </div>
          </>
        ) : <div className="api-empty">尚未创建创意 run</div>}
      </section>

      <section className="creative-card">
        <h4>版本链</h4>
        <div className="creative-version-list">
          {creativeVersions.map(version => (
            <button
              key={version.id}
              className={`creative-version-item ${creativeRun?.id === version.id ? 'active' : ''}`}
              onClick={() => onSwitchCreativeRunVersion(version)}
            >
              <span>v{version.version || 1} · {version.status}</span>
              <span>{new Date(version.updatedAt).toLocaleString()}</span>
            </button>
          ))}
          {creativeVersions.length === 0 ? <div className="api-empty">暂无版本链记录</div> : null}
        </div>
      </section>
    </div>
  )
}

export default CreativeModePanel
