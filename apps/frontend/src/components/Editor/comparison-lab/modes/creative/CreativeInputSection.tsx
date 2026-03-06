import React from 'react'

export interface CreativeInputSectionProps {
  creativeScript: string
  creativeStyle: string
  commitScore: number
  isCreativeBusy: boolean
  hasCreativeRun: boolean
  onCreativeScriptChange: (value: string) => void
  onCreativeStyleChange: (value: string) => void
  onCommitScoreChange: (value: number) => void
  onCreateCreativeRun: () => void
  onApplyCreativeFeedback: () => void
  onCommitCreativeRun: () => void
  onRefreshCreativeVersions: () => void
}

const CreativeInputSection: React.FC<CreativeInputSectionProps> = ({
  creativeScript,
  creativeStyle,
  commitScore,
  isCreativeBusy,
  hasCreativeRun,
  onCreativeScriptChange,
  onCreativeStyleChange,
  onCommitScoreChange,
  onCreateCreativeRun,
  onApplyCreativeFeedback,
  onCommitCreativeRun,
  onRefreshCreativeVersions
}) => {
  return (
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
          <select
            name="creativeStyle"
            value={creativeStyle}
            onChange={(event) => onCreativeStyleChange(event.target.value)}
          >
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
            onChange={(event) =>
              onCommitScoreChange(Math.max(0, Math.min(1, Number(event.target.value || 0))))
            }
          />
        </label>
      </div>
      <div className="lab-inline-actions">
        <button disabled={isCreativeBusy} onClick={onCreateCreativeRun}>
          {isCreativeBusy ? '处理中...' : '创建 Run'}
        </button>
        <button disabled={!hasCreativeRun || isCreativeBusy} onClick={onApplyCreativeFeedback}>
          应用反馈
        </button>
        <button disabled={!hasCreativeRun || isCreativeBusy} onClick={onCommitCreativeRun}>
          提交完成
        </button>
        <button disabled={!hasCreativeRun || isCreativeBusy} onClick={onRefreshCreativeVersions}>
          刷新版本链
        </button>
      </div>
    </section>
  )
}

export default CreativeInputSection
