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

        /* 亮色模式物理覆盖 */
        [data-theme='light'] {
          --pro-bg: #F5F5F7;
          --pro-surface: #FFFFFF;
          --pro-panel: #F5F5F7;
          --pro-border: rgba(0, 0, 0, 0.1);
          --pro-text: #1D1D1F;
          --pro-text-dim: #86868B;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        body { background: var(--pro-bg); color: var(--pro-text); font-family: -apple-system, "SF Pro Display", sans-serif; overflow: hidden; transition: background 0.3s ease; }

        .pro-master-shell {
          height: 100vh; width: 100vw; display: grid; grid-template-rows: 52px 1fr 380px; gap: 4px; background: var(--pro-bg); padding: 4px;
        }

        .os-header { background: var(--pro-surface); display: flex; align-items: center; padding: 0 24px; justify-content: space-between; border-radius: 12px; border: 1px solid var(--pro-border); box-shadow: 0 4px 20px rgba(0,0,0,0.2); }
        .os-logo { font-weight: 900; font-size: 16px; letter-spacing: 1px; color: var(--pro-text); }
        .os-logo span { color: var(--pro-accent); }
        
        .os-nav-tab { color: var(--pro-text-dim); font-size: 13px; font-weight: 700; cursor: pointer; border: none; background: none; padding: 6px 16px; border-radius: 8px; transition: 0.2s; }
        .os-nav-tab.active { color: var(--pro-text); background: rgba(255,255,255,0.05); }
        [data-theme='light'] .os-nav-tab.active { background: rgba(0,0,0,0.05); }

        .os-main { display: grid; grid-template-columns: 320px 1fr 340px; gap: 4px; min-height: 0; }
        .os-panel { background: var(--pro-surface); display: flex; flex-direction: column; overflow: hidden; border-radius: 12px; border: 1px solid var(--pro-border); }
        
        .os-monitor { background: #000 !important; padding: 32px; display: flex; flex-direction: column; border: 1px solid #222; }
        .monitor-stage-box { flex: 1; background: #000; border-radius: 12px; overflow: hidden; box-shadow: 0 40px 100px rgba(0,0,0,0.8); border: 1px solid #333; }

        /* 属性面板强制大一统：物理穿透所有层级 */
        .pro-inspector-outer, .pro-inspector-outer div, .pro-inspector-outer section { 
          background-color: transparent !important; 
          border-color: var(--pro-border) !important;
          color: inherit !important;
        }
        .pro-inspector-outer { background-color: var(--pro-surface) !important; }
        .inspector-body { padding: 20px !important; }
        .inspector-section label { color: var(--pro-text-dim) !important; font-weight: 700 !important; text-transform: uppercase; font-size: 10px; }

        .os-footer { background: var(--pro-surface); display: flex; flex-direction: column; border-radius: 12px; border: 1px solid var(--pro-border); }
        .footer-tools { height: 48px; border-bottom: 1px solid var(--pro-border); display: flex; align-items: center; padding: 0 20px; justify-content: space-between; }
        
        .tool-icon-btn { 
          width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; 
          border-radius: 8px; border: 1px solid transparent; background: transparent; cursor: pointer; color: var(--pro-text-dim); font-size: 20px; 
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .tool-icon-btn.active-tool { 
          background: var(--pro-accent) !important; 
          color: #fff !important; 
          box-shadow: 0 0 15px var(--pro-accent-glow) !important;
          transform: scale(1.1);
        }
      `}</style>

      <ToastContainer />
      
      <header className="os-header">
        <div className="os-logo">VEOMUSE <span>PRO</span></div>
        <nav style={{ display: 'flex', gap: '20px' }}>
          <button className={`os-nav-tab ${activeMode === 'edit' ? 'active' : ''}`} onClick={() => setActiveMode('edit')}>编辑器</button>
          <button className={`os-nav-tab ${activeMode === 'color' ? 'active' : ''}`} onClick={() => setActiveMode('color')}>调色</button>
          <button className={`os-nav-tab ${activeMode === 'audio' ? 'active' : ''}`} onClick={() => setActiveMode('audio')}>音频</button>
        </nav>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <ThemeSwitcher />
          <button style={{ background: 'var(--pro-accent)', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '10px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px var(--pro-accent-glow)' }}>导出作品</button>
        </div>
      </header>

      <main className="os-main">
        <aside className="os-panel">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--pro-border)', display: 'flex', gap: '20px' }}>
            <button style={{ background: 'none', border: 'none', color: activeSidebar === 'assets' ? 'var(--pro-accent)' : 'var(--pro-text-dim)', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }} onClick={() => setActiveSidebar('assets')}>项目资产</button>
            <button style={{ background: 'none', border: 'none', color: activeSidebar === 'director' ? 'var(--pro-accent)' : 'var(--pro-text-dim)', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }} onClick={() => setActiveSidebar('director')}>AI 导演</button>
          </div>
          <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {activeSidebar === 'assets' ? <AssetPanel /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--pro-text-dim)', textTransform: 'uppercase' }}>创意分镜提示词</label>
                <textarea 
                  placeholder="描述你脑海中的画面..." 
                  style={{ flex: 1, background: 'rgba(0,0,0,0.1)', border: '1px solid var(--pro-border)', borderRadius: '10px', padding: '16px', color: 'var(--pro-text)', resize: 'none', fontSize: '14px', outline: 'none' }} 
                />
                <button style={{ background: 'var(--pro-accent)', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}>启动一键导演</button>
              </div>
            )}
          </div>
        </aside>

        <section className="os-panel os-monitor">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'flex-end' }}>
            <div style={{ color: '#FF3B30', fontSize: '11px', fontWeight: 900, background: 'rgba(255,59,48,0.1)', padding: '3px 8px', borderRadius: '4px' }}>● LIVE</div>
            <div style={{ fontFamily: 'monospace', color: 'var(--pro-accent)', fontSize: '28px', fontWeight: 700, letterSpacing: '-1px' }}>00:00:00:00</div>
            <div style={{ fontSize: '11px', color: 'var(--pro-text-dim)', fontWeight: 700 }}>4K HDR | 60 FPS</div>
          </div>
          <div className="monitor-stage-box"><MultiVideoPlayer /></div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', paddingTop: '24px' }}>
            <button style={{ background: 'none', border: 'none', color: 'var(--pro-text)', fontSize: '24px', cursor: 'pointer', opacity: 0.8 }}>⏮</button>
            <button style={{ background: 'none', border: 'none', color: 'var(--pro-accent)', fontSize: '48px', cursor: 'pointer' }}>▶</button>
            <button style={{ background: 'none', border: 'none', color: 'var(--pro-text)', fontSize: '24px', cursor: 'pointer', opacity: 0.8 }}>⏭</button>
          </div>
        </section>

        <aside className="os-panel pro-inspector-outer">
          <PropertyInspector />
        </aside>
      </main>

      <footer className="os-footer">
        <div className="footer-tools">
          <div style={{ display: 'flex', gap: '16px' }}>
            <button id="tool-select" className={`tool-icon-btn ${activeTool === 'select' ? 'active-tool' : ''}`} onClick={() => setActiveTool('select')}>↖</button>
            <button id="tool-cut" className={`tool-icon-btn ${activeTool === 'cut' ? 'active-tool' : ''}`} onClick={() => setActiveTool('cut')}>✂</button>
            <button id="tool-hand" className={`tool-icon-btn ${activeTool === 'hand' ? 'active-tool' : ''}`} onClick={() => setActiveTool('hand')}>✋</button>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--pro-text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
            Engine: Rol Down 8.0 | Snap: On | Buffer: 100%
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
