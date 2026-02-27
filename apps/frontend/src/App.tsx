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
  const [activeMode, setActiveMode] = useState('edit') // 'edit' | 'color' | 'audio'
  const [activeTool, setActiveTool] = useState('select')
  const [activeSidebar, setActiveSidebar] = useState('assets')

  return (
    <div className="pro-master-shell" onContextMenu={e => e.preventDefault()}>
      <style>{`
        :root {
          --pro-bg: #000000;
          --pro-surface: #121212;
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
        body { background: var(--pro-bg); color: var(--pro-text); font-family: -apple-system, system-ui, sans-serif; overflow: hidden; transition: all 0.3s ease; }

        .pro-master-shell {
          height: 100vh; width: 100vw; display: grid; grid-template-rows: 52px 1fr 380px; gap: 4px; background: var(--pro-bg); padding: 4px;
        }

        /* 统一面板背景 - 物理穿透所有层级 */
        .os-panel, .os-header, .os-footer, .pro-inspector-outer, .panel-container { 
          background-color: var(--pro-surface) !important; 
          border: 1px solid var(--pro-border) !important;
          border-radius: 12px !important;
          transition: all 0.3s ease;
        }

        .os-header { display: flex; align-items: center; padding: 0 24px; justify-content: space-between; }
        .os-logo { font-weight: 900; font-size: 16px; letter-spacing: 1px; }
        .os-logo span { color: var(--pro-accent); }
        
        .os-nav-tab { color: var(--pro-text-dim); font-size: 13px; font-weight: 700; cursor: pointer; border: none; background: none; padding: 6px 16px; border-radius: 8px; transition: 0.2s; }
        .os-nav-tab.active { color: var(--pro-text); background: rgba(128,128,128,0.1); }

        .os-main { display: grid; grid-template-columns: 320px 1fr 340px; gap: 4px; min-height: 0; }
        
        /* 核心监视器：强制保持焦点对比度 */
        .os-monitor { background: #000 !important; border: 1px solid #222 !important; padding: 32px; display: flex; flex-direction: column; }
        [data-theme='light'] .os-monitor { border-color: #ddd !important; }
        
        .monitor-stage-box { flex: 1; background: #000; border-radius: 12px; overflow: hidden; box-shadow: 0 40px 100px rgba(0,0,0,0.5); }

        .tool-icon-btn { 
          width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; 
          border-radius: 8px; border: 1px solid transparent; background: transparent; cursor: pointer; color: var(--pro-text-dim); font-size: 20px; transition: all 0.2s;
        }
        .tool-icon-btn.active-tool { background: var(--pro-accent) !important; color: #fff !important; box-shadow: 0 0 15px var(--pro-accent-glow); }

        /* 覆盖子组件顽固背景 */
        .pro-inspector-outer div, .pro-inspector-outer section { background-color: transparent !important; color: inherit !important; }
      `}</style>

      <ToastContainer />
      
      <header className="os-header">
        <div className="os-logo">VEOMUSE <span>PRO</span></div>
        <nav style={{ display: 'flex', gap: '16px' }}>
          <button className={`os-nav-tab ${activeMode === 'edit' ? 'active' : ''}`} onClick={() => setActiveMode('edit')}>编辑器</button>
          <button className={`os-nav-tab ${activeMode === 'color' ? 'active' : ''}`} onClick={() => setActiveMode('color')}>调色</button>
          <button className={`os-nav-tab ${activeMode === 'audio' ? 'active' : ''}`} onClick={() => setActiveMode('audio')}>音频</button>
        </nav>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <ThemeSwitcher />
          <button style={{ background: 'var(--pro-accent)', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '10px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>导出</button>
        </div>
      </header>

      <main className="os-main">
        <aside className="os-panel">
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--pro-border)', display: 'flex', gap: '16px' }}>
            <button style={{ background: 'none', border: 'none', color: activeSidebar === 'assets' ? 'var(--pro-accent)' : 'var(--pro-text-dim)', fontWeight: 800, fontSize: '11px', cursor: 'pointer' }} onClick={() => setActiveSidebar('assets')}>资产库</button>
            <button style={{ background: 'none', border: 'none', color: activeSidebar === 'director' ? 'var(--pro-accent)' : 'var(--pro-text-dim)', fontWeight: 800, fontSize: '11px', cursor: 'pointer' }} onClick={() => setActiveSidebar('director')}>AI 导演</button>
          </div>
          <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {activeSidebar === 'assets' ? <AssetPanel /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
                <textarea placeholder="输入电影脚本..." style={{ flex: 1, background: 'rgba(128,128,128,0.05)', border: '1px solid var(--pro-border)', borderRadius: '8px', padding: '12px', color: 'var(--pro-text)', resize: 'none', outline: 'none' }} />
                <button style={{ background: 'var(--pro-accent)', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 800, cursor: 'pointer' }}>启动生成</button>
              </div>
            )}
          </div>
        </aside>

        <section className="os-panel os-monitor">
          {activeMode === 'edit' ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ color: '#FF3B30', fontSize: '10px', fontWeight: 900 }}>● LIVE</div>
                <div style={{ fontFamily: 'monospace', color: 'var(--pro-accent)', fontSize: '24px', fontWeight: 700 }}>00:00:00:00</div>
                <div style={{ fontSize: '10px', color: 'var(--pro-text-dim)' }}>4K HDR</div>
              </div>
              <div className="monitor-stage-box"><MultiVideoPlayer /></div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', paddingTop: '20px' }}>
                <button style={{ background: 'none', border: 'none', color: 'var(--pro-text)', fontSize: '20px', cursor: 'pointer' }}>⏮</button>
                <button style={{ background: 'none', border: 'none', color: 'var(--pro-accent)', fontSize: '32px', cursor: 'pointer' }}>▶</button>
                <button style={{ background: 'none', border: 'none', color: 'var(--pro-text)', fontSize: '20px', cursor: 'pointer' }}>⏭</button>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pro-text-dim)', fontSize: '14px', fontWeight: 600 }}>
              {activeMode === 'color' ? '🎨 调色实验室正在初始化引擎...' : '🎚️ 音频大师模块已加载'}
            </div>
          )}
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
          <div style={{ fontSize: '10px', color: 'var(--pro-text-dim)', fontWeight: 700 }}>ENGINE: ROL DOWN 8.0 | SNAP: ON | BUFFER: 100%</div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', padding: '8px' }}>
          <VideoEditor activeTool={activeTool as any} />
        </div>
      </footer>
    </div>
  )
}

export default App
