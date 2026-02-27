import { useState, memo, useEffect, useMemo } from 'react'
import { useEditorStore } from './store/editorStore'
import { useToastStore } from './store/toastStore'
import { useThemeSync } from './hooks/useThemeSync'
import VideoEditor from './components/Editor/VideoEditor'
import MultiVideoPlayer from './components/Editor/MultiVideoPlayer'
import PropertyInspector from './components/Editor/PropertyInspector'
import AssetPanel from './components/Editor/AssetPanel'
import ToastContainer from './components/Editor/ToastContainer'
import ThemeSwitcher from './components/Common/ThemeSwitcher'

function App() {
  useThemeSync(); 
  const { showToast } = useToastStore()
  const [activeMode, setActiveMode] = useState('edit')
  const [activeTool, setActiveTool] = useState('select')
  const [activeSidebar, setActiveSidebar] = useState('assets')

  const systemStatus = useMemo(() => ({
    gpu: Math.floor(Math.random() * 20 + 5),
    ram: '4.8GB / 32GB',
    engine: 'VEO MASTER 3.1'
  }), [activeMode]);

  return (
    <div className="veomuse-industrial-shell" onContextMenu={e => e.preventDefault()}>
      <style>{`
        :root {
          --ap-bg: #000000;
          --ap-surface: #161617;
          --ap-card: #1D1D1F;
          --ap-border: rgba(255, 255, 255, 0.1);
          --ap-accent: #007AFF;
          --ap-accent-glow: rgba(0, 122, 255, 0.4);
          --ap-text: #F5F5F7;
          --ap-text-dim: #8E8E93;
          --ap-radius: 14px;
          --ap-gap: 10px;
        }

        [data-theme='light'] {
          --ap-bg: #E5E5EA;
          --ap-surface: #FFFFFF;
          --ap-card: #FBFBFD;
          --ap-border: rgba(0, 0, 0, 0.08);
          --ap-text: #1C1C1E;
          --ap-text-dim: #8E8E93;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        body { background: var(--ap-bg); color: var(--ap-text); font-family: -apple-system, system-ui, sans-serif; overflow: hidden; }

        .veomuse-industrial-shell {
          height: 100vh; width: 100vw; display: flex; flex-direction: column; background: var(--ap-bg); padding: var(--ap-gap); gap: var(--ap-gap);
        }

        /* 统一工业级卡片 */
        .pro-panel {
          background: var(--ap-surface);
          border: 1px solid var(--ap-border);
          border-radius: var(--ap-radius);
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        /* 顶部导航 */
        .header-bar {
          height: 56px; padding: 0 20px; display: flex; align-items: center; justify-content: space-between;
        }
        .brand-zone { display: flex; align-items: center; gap: 14px; }
        .brand-logo { width: 28px; height: 28px; background: var(--ap-accent); border-radius: 7px; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #fff; font-size: 16px; box-shadow: 0 2px 10px var(--ap-accent-glow); }
        .brand-name { font-weight: 800; font-size: 15px; letter-spacing: -0.5px; }

        .mode-selector { display: flex; background: rgba(128,128,128,0.08); padding: 3px; border-radius: 10px; gap: 2px; }
        .mode-tab { border: none; background: none; padding: 6px 18px; border-radius: 8px; font-size: 12px; font-weight: 700; color: var(--ap-text-dim); cursor: pointer; transition: 0.2s; }
        .mode-tab.active { background: var(--ap-surface); color: var(--ap-text); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }

        /* 工作区矩阵 */
        .main-layout { flex: 1; display: grid; grid-template-columns: 320px 1fr 340px; gap: var(--ap-gap); min-height: 0; }
        .panel-title-bar { height: 44px; padding: 0 16px; border-bottom: 1px solid var(--ap-border); display: flex; align-items: center; justify-content: space-between; }
        .panel-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--ap-text-dim); }

        /* 监视器区 */
        .monitor-core { background: #000 !important; border: 1px solid #222 !important; position: relative; }
        [data-theme='light'] .monitor-core { border-color: #ddd !important; }
        
        .monitor-overlay { position: absolute; top: 20px; left: 24px; right: 24px; display: flex; justify-content: space-between; pointer-events: none; z-index: 5; }
        .timecode-display { font-family: "SF Mono", monospace; color: var(--ap-accent); font-size: 24px; font-weight: 600; letter-spacing: -1px; }
        
        .transport-controls { height: 70px; display: flex; justify-content: center; gap: 40px; align-items: center; border-top: 1px solid rgba(255,255,255,0.03); }
        .transport-btn { background: none; border: none; color: #fff; cursor: pointer; opacity: 0.6; transition: 0.2s; font-size: 20px; }
        .transport-btn.play { color: var(--ap-accent); font-size: 36px; opacity: 1; }

        /* 底部时间轴 */
        .timeline-container { height: 380px; }
        .timeline-actions { height: 48px; padding: 0 16px; border-bottom: 1px solid var(--ap-border); display: flex; align-items: center; justify-content: space-between; }
        
        .tool-bar { display: flex; gap: 8px; }
        .tool-icon { 
          width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; 
          border-radius: 7px; border: 1px solid transparent; cursor: pointer; color: var(--ap-text-dim); font-size: 18px;
        }
        .tool-icon.active { background: var(--ap-accent); color: #fff; box-shadow: 0 0 12px var(--ap-accent-glow); }

        .system-meta { display: flex; gap: 20px; font-size: 10px; font-weight: 800; color: var(--ap-text-dim); text-transform: uppercase; }
        .system-meta span { color: #34C759; margin-left: 2px; }

        /* 属性面板强制大一统 */
        .pro-inspector-outer div, .pro-inspector-outer section { background-color: transparent !important; color: inherit !important; border-color: var(--ap-border) !important; }
      `}</style>

      <ToastContainer />
      
      <header className="pro-panel header-bar">
        <div className="brand-zone">
          <div className="brand-logo">V</div>
          <div className="brand-name">VEOMUSE<span>PRO</span></div>
        </div>
        
        <div className="mode-selector">
          {['edit', 'color', 'audio'].map(m => (
            <button key={m} className={`mode-tab ${activeMode === m ? 'active' : ''}`} onClick={() => setActiveMode(m)}>
              {m === 'edit' ? '剪辑' : m === 'color' ? '调色' : '音频'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <ThemeSwitcher />
          <button style={{ background: 'var(--ap-accent)', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '9px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px var(--ap-accent-glow)' }}>导出</button>
        </div>
      </header>

      <div className="main-layout">
        <aside className="pro-panel">
          <div className="panel-title-bar">
            <div style={{ display: 'flex', gap: '16px' }}>
              <button style={{ background: 'none', border: 'none', color: activeSidebar === 'assets' ? 'var(--ap-accent)' : 'var(--ap-text-dim)', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }} onClick={() => setActiveSidebar('assets')}>媒体资源</button>
              <button style={{ background: 'none', border: 'none', color: activeSidebar === 'director' ? 'var(--ap-accent)' : 'var(--ap-text-dim)', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }} onClick={() => setActiveSidebar('director')}>AI 导演</button>
            </div>
          </div>
          <div style={{ flex: 1, padding: '20px', overflow: 'hidden' }}>
            {activeSidebar === 'assets' ? <AssetPanel /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
                <textarea placeholder="输入电影脚本..." style={{ flex: 1, background: 'rgba(128,128,128,0.05)', border: '1px solid var(--ap-border)', borderRadius: '10px', padding: '16px', color: 'var(--ap-text)', resize: 'none', outline: 'none', fontSize: '14px' }} />
                <button style={{ background: 'var(--ap-accent)', color: '#fff', border: 'none', height: '44px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}>生成分镜</button>
              </div>
            )}
          </div>
        </aside>

        <section className="pro-panel monitor-core">
          {activeMode === 'edit' ? (
            <>
              <div className="monitor-overlay">
                <div style={{ color: '#FF3B30', fontSize: '10px', fontWeight: 900 }}>● 实时</div>
                <div className="timecode-display">00:00:00:00</div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--ap-text-dim)' }}>4K | REC.709</div>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}><MultiVideoPlayer /></div>
              <div className="transport-controls">
                <button className="transport-btn">⏮</button>
                <button className="transport-btn play">▶</button>
                <button className="transport-btn">⏭</button>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ap-text-dim)', fontSize: '14px', fontWeight: 600 }}>{activeMode.toUpperCase()} 模块已加载</div>
          )}
        </section>

        <aside className="pro-panel pro-inspector-outer">
          <div className="panel-title-bar"><span className="panel-label">属性</span></div>
          <PropertyInspector />
        </aside>
      </div>

      <footer className="pro-panel timeline-container">
        <div className="timeline-actions">
          <div className="tool-bar">
            <button className={`tool-icon ${activeTool === 'select' ? 'active' : ''}`} onClick={() => setActiveTool('select')}>↖</button>
            <button className={`tool-icon ${activeTool === 'cut' ? 'active' : ''}`} onClick={() => setActiveTool('cut')}>✂</button>
            <button className={`tool-icon ${activeTool === 'hand' ? 'active' : ''}`} onClick={() => setActiveTool('hand')}>✋</button>
          </div>
          <div className="system-meta">
            <div className="meta-item">GPU: <span>{systemStatus.gpu}%</span></div>
            <div className="meta-item">CACHE: <span>92%</span></div>
            <div className="meta-item">ENGINE: <span>ROL DOWN 8.0</span></div>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', padding: '12px' }}>
          <VideoEditor activeTool={activeTool as any} />
        </div>
      </footer>
    </div>
  )
}

export default App
