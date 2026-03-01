import type { CSSProperties, ReactNode } from 'react'

interface WorkspaceShellProps {
  style?: CSSProperties
  shellRef?: React.Ref<HTMLDivElement>
  children: ReactNode
}

const WorkspaceShell = ({ style, shellRef, children }: WorkspaceShellProps) => (
  <div className="pro-master-shell" ref={shellRef} style={style} data-testid="area-workspace-shell">
    {children}
  </div>
)

export default WorkspaceShell
