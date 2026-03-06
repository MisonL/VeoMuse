import React from 'react'
import type { CreativeRun } from '../../types'

export interface CreativeRunDetailsSectionProps {
  creativeRun: CreativeRun | null
  creativeRunFeedback: string
  sceneFeedbackMap: Record<string, string>
  onCreativeRunFeedbackChange: (value: string) => void
  onSceneFeedbackChange: (sceneId: string, value: string) => void
}

const CreativeRunDetailsSection: React.FC<CreativeRunDetailsSectionProps> = ({
  creativeRun,
  creativeRunFeedback,
  sceneFeedbackMap,
  onCreativeRunFeedbackChange,
  onSceneFeedbackChange
}) => {
  return (
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
            {creativeRun.scenes.map((scene) => (
              <div key={scene.id} className="creative-scene-item">
                <div className="scene-headline">
                  <strong>
                    {scene.order + 1}. {scene.title}
                  </strong>
                  <span>
                    rev {scene.revision || 1} · {scene.status}
                  </span>
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
      ) : (
        <div className="api-empty">尚未创建创意 run</div>
      )}
    </section>
  )
}

export default CreativeRunDetailsSection
