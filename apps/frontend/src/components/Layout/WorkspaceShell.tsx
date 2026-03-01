import type { CSSProperties, ReactNode } from 'react'

interface WorkspaceShellProps {
  style?: CSSProperties
  shellRef?: React.Ref<HTMLDivElement>
  layoutMode?: string
  topBarDensity?: string
  children: ReactNode
}

const WorkspaceShell = ({ style, shellRef, layoutMode, topBarDensity, children }: WorkspaceShellProps) => (
  <div
    className="pro-master-shell"
    ref={shellRef}
    style={style}
    data-testid="area-workspace-shell"
    data-layout-mode={layoutMode}
    data-topbar-density={topBarDensity}
  >
    {children}
  </div>
)

export default WorkspaceShell
