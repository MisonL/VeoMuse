import { useState, memo, useEffect } from 'react'
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

  return (
    <>
      <style>{`
        :root {
          --pro-bg: #000000;
          --pro-surface: #121212;
          --pro-panel: #1A1A1B;
          --pro-border: rgba(255, 255, 255, 0.08);
          --pro-accent: #007AFF;
          --pro-accent-glow: rgba(0, 122, 255, 0.4);
          --pro-text: #E5E5E5;
          --pro-text-dim: #888888;
        }

        [data-theme='light'] {
          --pro-bg: #F2F2F7;
          --pro-surface: #FFFFFF;
          --pro-border: rgba(0, 0, 0, 0.1);
          --pro-text: #1D1D1F;
          --pro-text-dim: #86868B;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        body { background: var(--pro-bg); color: var(--pro-text); font-family: -apple-system, sans-serif; overflow: hidden; transition: background 0.3s ease; }

        .pro-master-shell {
          height: 100vh; width: 100vw; display: grid; grid-template-rows: 52px 1fr 380px; gap: 4px; background: var(--pro-bg); padding: 4px;
        }

        /* 核心面板：强制背景同步 */
        .os-header, .os-panel, .os-footer {
          background-color: var(--pro-surface) !important; 
          border: 1px solid var(--pro-border) !important;
          border-radius: 12px !important;
          overflow: hidden;
        }

        .os-header { display: flex; align-items: center; padding: 0 24px; justify-content: space-between; }
        .os-logo { font-weight: 900; font-size: 16px; letter-spacing: 1px; color: var(--pro-text); }
        .os-logo span { color: var(--pro-accent); }
        
        .os-nav-tab { color: var(--pro-text-dim); font-size: 13px; font-weight: 700; cursor: pointer; border: none; background: none; padding: 6px 16px; border-radius: 8px; }
        .os-nav-tab.active { color: var(--pro-text); background: rgba(128,128,128,0.1); }

        .os-main { display: grid; grid-template-columns: 320px 1fr 340px; gap: 4px; min-height: 0; }
        
        /* 监视器：强制保持沉浸式背景 */
        .os-monitor { background: #000 !important; border: 1px solid #222 !important; padding: 24px; display: flex; flex-direction: column; }
        [data-theme='light'] .os-monitor { border-color: var(--pro-border) !important; background: var(--pro-surface) !important; }
        
        .monitor-stage-box { flex: 1; background: #000; border-radius: 12px; overflow: hidden; box-shadow: 0 40px 100px rgba(0,0,0,0.5); }

        .tool-icon-btn { 
          width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; 
          border-radius: 8px; border: 1px solid transparent; background: transparent; cursor: pointer; color: var(--pro-text-dim); font-size: 20px; 
        }
        .tool-icon-btn.active-tool { background: var(--pro-accent) !important; color: #fff !important; }

        /* 强制穿透：属性面板层级 */
        .pro-inspector-outer, .pro-inspector-outer * { background-color: transparent !important; border-color: var(--pro-border) !important; color: inherit !important; }
        .pro-inspector-outer { background-color: var(--pro-surface) !important; }

        .os-footer { display: flex; flex-direction: column; }
        .footer-tools { height: 44px; border-bottom: 1px solid var(--pro-border); display: flex; align-items: center; padding: 0 16px; justify-content: space-between; }
      `}</style>

      <ToastContainer />
      
      <div className="pro-master-shell" onContextMenu={e => e.preventDefault()}>
        <header className="os-header">
          <div className="os-logo">VEOMUSE <span>PRO</span></div>
          <nav style={{ display: 'flex', gap: '16px' }}>
            <button className={`os-nav-tab ${activeMode === 'edit' ? 'active' : ''}`} onClick={() => setActiveMode('edit')}>编辑器</button>
            <button className={`os-nav-tab ${activeMode === 'color' ? 'active' : ''}`} onClick={() => setActiveMode('color')}>调色</button>
            <button className={`os-nav-tab ${activeMode === 'audio' ? 'active' : ''}`} onClick={() => setActiveMode('audio')}>音频</button>
          </nav>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <ThemeSwitcher />
            <button style={{ background: 'var(--pro-accent)', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>导出作品</button>
          </div>
        </header>

        <main className="os-main">
          <aside className="os-panel">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--pro-border)', display: 'flex', gap: '16px' }}>
              <button style={{ background: 'none', border: 'none', color: activeSidebar === 'assets' ? 'var(--pro-accent)' : '#888', fontWeight: 800, fontSize: '11px', cursor: 'pointer' }} onClick={() => setActiveSidebar('assets')}>资产</button>
              <button style={{ background: 'none', border: 'none', color: activeSidebar === 'director' ? 'var(--pro-accent)' : '#888', fontWeight: 800, fontSize: '11px', cursor: 'pointer' }} onClick={() => setActiveSidebar('director')}>导演</button>
            </div>
            <div style={{ flex: 1, padding: '12px', overflow: 'hidden' }}>
              {activeSidebar === 'assets' ? <AssetPanel /> : (
                <div style={{ padding: '8px' }}>
                  <textarea placeholder="描述你的电影梦..." style={{ width: '100%', height: '120px', background: 'rgba(128,128,128,0.05)', border: '1px solid var(--pro-border)', borderRadius: '8px', padding: '12px', color: 'var(--pro-text)', resize: 'none', outline: 'none' }} />
                  <button style={{ width: '100%', marginTop: '12px', background: 'var(--pro-accent)', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: 800, cursor: 'pointer' }}>生成分镜</button>
                </div>
              )}
            </div>
          </aside>

          <section className="os-panel os-monitor">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
              <div style={{ color: '#FF3B30', fontSize: '10px', fontWeight: 900 }}>● LIVE</div>
              <div style={{ fontFamily: 'monospace', color: 'var(--pro-accent)', fontSize: '22px', fontWeight: 700 }}>00:00:00:00</div>
              <div style={{ fontSize: '10px', color: 'var(--pro-text-dim)' }}>4K HDR</div>
            </div>
            <div className="monitor-stage-box"><MultiVideoPlayer /></div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', paddingTop: '16px' }}>
              <button style={{ background: 'none', border: 'none', color: 'var(--pro-text)', fontSize: '18px', cursor: 'pointer' }}>⏮</button>
              <button style={{ background: 'none', border: 'none', color: 'var(--pro-accent)', fontSize: '28px', cursor: 'pointer' }}>▶</button>
              <button style={{ background: 'none', border: 'none', color: 'var(--pro-text)', fontSize: '18px', cursor: 'pointer' }}>⏭</button>
            </div>
          </section>

          <aside className="os-panel pro-inspector-outer">
            <PropertyInspector />
          </aside>
        </main>

        <footer className="os-footer">
          <div className="footer-tools">
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className={`tool-icon-btn ${activeTool === 'select' ? 'active-tool' : ''}`} onClick={() => setActiveTool('select')}>↖</button>
              <button className={`tool-icon-btn ${activeTool === 'cut' ? 'active-tool' : ''}`} onClick={() => setActiveTool('cut')}>✂</button>
              <button className={`tool-icon-btn ${activeTool === 'hand' ? 'active-tool' : ''}`} onClick={() => setActiveTool('hand')}>✋</button>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--pro-text-dim)', fontWeight: 700 }}>FPS: 60 | ENGINE: ROL DOWN 8.0</div>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <VideoEditor activeTool={activeTool as any} />
          </div>
        </footer>
      </div>
    </>
  )
}

export default App
