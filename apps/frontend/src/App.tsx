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
    <div className="pro-master-shell" onContextMenu={e => e.preventDefault()}>
      <style>{`
        :root {
          --pro-bg: #000000;
          --pro-surface: #121212;
          --pro-panel: #1A1A1B;
          --pro-accent: #007AFF;
          --pro-accent-glow: rgba(0, 122, 255, 0.4);
          --pro-border: rgba(255, 255, 255, 0.08);
          --pro-text: #E5E5E5;
          --pro-text-dim: #888888;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        body { background: #000; color: var(--pro-text); font-family: -apple-system, sans-serif; overflow: hidden; }

        .pro-master-shell {
          height: 100vh; width: 100vw; display: grid; grid-template-rows: 48px 1fr 380px; gap: 2px; background: #000; padding: 2px;
        }

        .os-header { background: var(--pro-surface); display: flex; align-items: center; padding: 0 20px; justify-content: space-between; border-bottom: 1px solid var(--pro-border); }
        .os-logo { font-weight: 900; font-size: 14px; letter-spacing: 1px; color: #fff; }
        .os-logo span { color: var(--pro-accent); }
        
        .os-nav-tab { color: var(--pro-text-dim); font-size: 12px; font-weight: 700; cursor: pointer; border: none; background: none; padding: 4px 12px; border-radius: 4px; }
        .os-nav-tab.active { color: #fff; background: rgba(255,255,255,0.05); }

        .os-main { display: grid; grid-template-columns: 320px 1fr 340px; gap: 2px; min-height: 0; }
        .os-panel { background: var(--pro-surface); display: flex; flex-direction: column; overflow: hidden; }
        
        .os-monitor { background: #080808 !important; padding: 20px; display: flex; flex-direction: column; }
        .monitor-stage-box { flex: 1; background: #000; border-radius: 8px; border: 1px solid var(--pro-border); box-shadow: 0 30px 80px rgba(0,0,0,0.8); overflow: hidden; }

        /* 属性面板物理覆盖 */
        .pro-inspector-outer { background: var(--pro-surface) !important; }
        .inspector-panel.glass-panel { background: transparent !important; border: none !important; }

        .os-footer { background: var(--pro-surface); display: flex; flex-direction: column; }
        .footer-tools { height: 40px; border-bottom: 1px solid var(--pro-border); display: flex; align-items: center; padding: 0 16px; justify-content: space-between; }
        
        .tool-icon-btn { 
          width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; 
          border-radius: 6px; border: 1px solid transparent; background: transparent; cursor: pointer; color: var(--pro-text-dim); font-size: 18px; 
          transition: all 0.2s;
        }
        /* 强制激活态样式 */
        .tool-icon-btn.active-tool { 
          background: rgba(0, 122, 255, 0.3) !important; 
          color: #fff !important; 
          border-color: var(--pro-accent) !important;
          box-shadow: 0 0 12px var(--pro-accent-glow) !important;
        }
      `}</style>

      <ToastContainer />
      
      <header className="os-header">
        <div className="os-logo">VEOMUSE <span>PRO</span></div>
        <nav style={{ display: 'flex', gap: '32px' }}>
          <button className={`os-nav-tab ${activeMode === 'edit' ? 'active' : ''}`} onClick={() => setActiveMode('edit')}>编辑器</button>
          <button className={`os-nav-tab ${activeMode === 'color' ? 'active' : ''}`} onClick={() => setActiveMode('color')}>调色</button>
          <button className={`os-nav-tab ${activeMode === 'audio' ? 'active' : ''}`} onClick={() => setActiveMode('audio')}>音频</button>
        </nav>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <ThemeSwitcher />
          <button className="os-btn-export" style={{ background: 'var(--pro-accent)', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>导出</button>
        </div>
      </header>

      <main className="os-main">
        <aside className="os-panel">
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--pro-border)', display: 'flex', gap: '16px' }}>
            <button style={{ background: 'none', border: 'none', color: activeSidebar === 'assets' ? 'var(--pro-accent)' : '#888', fontWeight: 800, fontSize: '11px' }} onClick={() => setActiveSidebar('assets')}>资产</button>
            <button style={{ background: 'none', border: 'none', color: activeSidebar === 'director' ? 'var(--pro-accent)' : '#888', fontWeight: 800, fontSize: '11px' }} onClick={() => setActiveSidebar('director')}>导演</button>
          </div>
          <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {activeSidebar === 'assets' ? <AssetPanel /> : (
              <>
                <textarea placeholder="描述你的电影梦..." style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--pro-border)', borderRadius: '8px', padding: '12px', color: '#fff', resize: 'none' }} />
                <button style={{ background: 'var(--pro-accent)', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 800 }}>一键导演</button>
              </>
            )}
          </div>
        </aside>

        <section className="os-panel os-monitor">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ color: '#FF3B30', fontSize: '10px', fontWeight: 900 }}>● LIVE</div>
            <div style={{ fontFamily: 'monospace', color: 'var(--pro-accent)', fontSize: '22px', fontWeight: 700 }}>00:00:00:00</div>
            <div style={{ fontSize: '10px', color: '#888' }}>4K HDR</div>
          </div>
          <div className="monitor-stage-box"><MultiVideoPlayer /></div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', paddingTop: '16px' }}>
            <button style={{ background: 'none', border: 'none', color: '#fff', fontSize: '18px' }}>⏮</button>
            <button style={{ background: 'none', border: 'none', color: 'var(--pro-accent)', fontSize: '28px' }}>▶</button>
            <button style={{ background: 'none', border: 'none', color: '#fff', fontSize: '18px' }}>⏭</button>
          </div>
        </section>

        <aside className="os-panel pro-inspector-outer">
          <PropertyInspector />
        </aside>
      </main>

      <footer className="os-footer">
        <div className="footer-tools">
          <div style={{ display: 'flex', gap: '12px' }}>
            <button id="tool-select" className={`tool-icon-btn ${activeTool === 'select' ? 'active-tool' : ''}`} onClick={() => setActiveTool('select')}>↖</button>
            <button id="tool-cut" className={`tool-icon-btn ${activeTool === 'cut' ? 'active-tool' : ''}`} onClick={() => setActiveTool('cut')}>✂</button>
            <button id="tool-hand" className={`tool-icon-btn ${activeTool === 'hand' ? 'active-tool' : ''}`} onClick={() => setActiveTool('hand')}>✋</button>
          </div>
          <div style={{ fontSize: '10px', color: '#888', fontWeight: 700 }}>FPS: 60 | ENGINE: ROL DOWN 8.0</div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}><VideoEditor activeTool={activeTool as any} /></div>
      </footer>
    </div>
  )
}

export default App
