import React from 'react'
import type { CreativeRun } from '../../types'

export interface CreativeVersionChainSectionProps {
  creativeRun: CreativeRun | null
  creativeVersions: CreativeRun[]
  onSwitchCreativeRunVersion: (run: CreativeRun) => void
}

const CreativeVersionChainSection: React.FC<CreativeVersionChainSectionProps> = ({
  creativeRun,
  creativeVersions,
  onSwitchCreativeRunVersion
}) => {
  return (
    <section className="creative-card">
      <h4>版本链</h4>
      <div className="creative-version-list">
        {creativeVersions.map((version) => (
          <button
            key={version.id}
            className={`creative-version-item ${creativeRun?.id === version.id ? 'active' : ''}`}
            onClick={() => onSwitchCreativeRunVersion(version)}
          >
            <span>
              v{version.version || 1} · {version.status}
            </span>
            <span>{new Date(version.updatedAt).toLocaleString()}</span>
          </button>
        ))}
        {creativeVersions.length === 0 ? <div className="api-empty">暂无版本链记录</div> : null}
      </div>
    </section>
  )
}

export default CreativeVersionChainSection
