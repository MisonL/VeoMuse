import { useState, memo } from 'react'
import { useEditorStore } from './store/editorStore'
import VideoEditor from './components/Editor/VideoEditor'
import MultiVideoPlayer from './components/Editor/MultiVideoPlayer'
import PropertyInspector from './components/Editor/PropertyInspector'
import AssetPanel from './components/Editor/AssetPanel'
import ToastContainer from './components/Editor/ToastContainer'

function App() {
  const { tracks } = useEditorStore()

  return (
    <div className="veomuse-pro-os">
      <style>{`
        :root {
          --os-bg: #000000;
          --os-accent: #007AFF;
          --os-accent-glow: rgba(0, 122, 255, 0.5);
          --os-surface: rgba(22, 22, 23, 0.8);
          --os-border: rgba(255, 255, 255, 0.1);
          --os-text: #F5F5F7;
          --os-text-dim: #86868B;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        
        body { 
          background: var(--os-bg); 
          color: var(--os-text); 
          font-family: -apple-system, "SF Pro Display", sans-serif;
          height: 100vh;
          overflow: hidden;
        }

        .veomuse-pro-os {
          display: flex;
          flex-direction: column;
          height: 100vh;
          width: 100vw;
          padding: 12px;
          gap: 12px;
          background: radial-gradient(circle at 50% -20%, #1a1a1a 0%, #000 100%);
        }

        .os-header {
          height: 52px;
          background: var(--os-surface);
          backdrop-filter: blur(30px) saturate(180%);
          border: 1px solid var(--os-border);
          border-radius: 14px;
          display: flex;
          align-items: center;
          padding: 0 24px;
          justify-content: space-between;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }

        .os-logo { font-size: 16px; font-weight: 800; letter-spacing: -0.5px; }
        .os-logo span { color: var(--os-accent); }

        .os-nav { display: flex; gap: 32px; }
        .os-nav-item { color: var(--os-text-dim); font-size: 13px; font-weight: 600; cursor: pointer; border: none; background: none; transition: 0.2s; }
        .os-nav-item.active { color: #fff; }

        .os-btn-primary {
          background: var(--os-accent);
          color: #fff;
          border: none;
          padding: 6px 20px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 12px var(--os-accent-glow);
        }

        .os-workspace {
          flex: 1;
          display: grid;
          grid-template-columns: 320px 1fr 340px;
          gap: 12px;
          min-height: 0;
        }

        .os-card {
          background: var(--os-surface);
          backdrop-filter: blur(30px) saturate(180%);
          border: 1px solid var(--os-border);
          border-radius: 18px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }

        .os-card-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--os-border);
          font-size: 11px;
          font-weight: 800;
          color: var(--os-text-dim);
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .os-monitor {
          position: relative;
          padding: 24px;
          background: radial-gradient(circle at center, #111 0%, #000 100%);
        }
        .os-monitor-view {
          flex: 1;
          background: #000;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 30px 80px rgba(0,0,0,0.8);
          border: 1px solid #222;
        }
        .os-monitor-controls {
          display: flex;
          justify-content: center;
          gap: 32px;
          margin-top: 20px;
        }
        .os-icon-btn { font-size: 20px; color: #fff; background: none; border: none; cursor: pointer; opacity: 0.6; }
        .os-icon-btn.active { color: var(--os-accent); opacity: 1; }

        .os-footer {
          height: 360px;
          background: var(--os-surface);
          backdrop-filter: blur(30px);
          border: 1px solid var(--os-border);
          border-radius: 18px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .os-timeline-toolbar {
          height: 44px;
          padding: 0 20px;
          border-bottom: 1px solid var(--os-border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .os-tool-btn { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 6px; border: none; background: transparent; cursor: pointer; color: var(--os-text-dim); }
        .os-tool-btn.active { background: rgba(255,255,255,0.05); color: #fff; }
      `}</style>

      <ToastContainer />
      
      <header className="os-header">
        <div className="os-logo">VEOMUSE <span>PRO</span></div>
        <nav className="os-nav">
          <button className="os-nav-item active">编辑器</button>
          <button className="os-nav-item">实验室</button>
          <button className="os-nav-item">音频</button>
        </nav>
        <button className="os-btn-primary">导出</button>
      </header>

      <div className="os-workspace">
        <aside className="os-card">
          <div className="os-card-header">资源</div>
          <div style={{ flex: 1, padding: '16px' }}>
            <AssetPanel />
          </div>
        </aside>

        <section className="os-card os-monitor">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'flex-end' }}>
            <div style={{ color: '#FF3B30', fontSize: '10px', fontWeight: 900 }}>● LIVE</div>
            <div style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--os-accent)' }}>00:00:00:00</div>
            <div style={{ fontSize: '10px', color: 'var(--os-text-dim)', fontWeight: 700 }}>PRORes 4444</div>
          </div>
          <div className="os-monitor-view">
            <MultiVideoPlayer />
          </div>
          <div className="os-monitor-controls">
            <button className="os-icon-btn">⏮</button>
            <button className="os-icon-btn active" style={{ fontSize: '32px' }}>▶</button>
            <button className="os-icon-btn">⏭</button>
          </div>
        </section>

        <aside className="os-card">
          <div className="os-card-header">属性</div>
          <div style={{ flex: 1, padding: '16px' }}>
            <PropertyInspector />
          </div>
        </aside>
      </div>

      <footer className="os-footer">
        <div className="os-timeline-toolbar">
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="os-tool-btn active">↖</button>
            <button className="os-tool-btn">✂</button>
            <button className="os-tool-btn">✋</button>
          </div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--os-text-dim)' }}>
            FPS: 60 | 自动吸附: ON | 引擎: ROL DOWN 8.0
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <VideoEditor />
        </div>
      </footer>
    </div>
  )
}

export default memo(App)
