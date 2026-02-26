import { useState, useEffect, useCallback } from 'react'
import { api, getErrorMessage } from './utils/eden'
import { useEditorStore } from './store/editorStore'
import { useToastStore } from './store/toastStore'
import VideoEditor from './components/Editor/VideoEditor'
import MultiVideoPlayer from './components/Editor/MultiVideoPlayer'
import PropertyInspector from './components/Editor/PropertyInspector'
import AssetPanel from './components/Editor/AssetPanel'
import ToastContainer from './components/Editor/ToastContainer'

function App() {
  const { showToast } = useToastStore()
  const [activeTab, setActiveTab] = useState('assets')
  const { tracks } = useEditorStore()

  return (
    <div className="pro-master-root">
      <style>{`
        :root {
          --bg: #050505;
          --panel: #121212;
          --border: rgba(255,255,255,0.08);
          --accent: #007AFF;
          --text: #E1E1E1;
          --text-dim: #888;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: "Inter", -apple-system, sans-serif; }
        body { background: var(--bg); color: var(--text); overflow: hidden; }
        
        .pro-master-root {
          display: flex;
          flex-direction: column;
          height: 100vh;
          width: 100vw;
        }

        /* 顶部全局导航 */
        .pro-top-nav {
          height: 40px;
          background: #1A1A1A;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          padding: 0 16px;
          justify-content: space-between;
        }
        .logo-text { font-weight: 900; font-size: 14px; letter-spacing: 1px; color: var(--accent); }
        .nav-tabs { display: flex; gap: 24px; }
        .nav-tab { color: var(--text-dim); font-size: 12px; font-weight: 600; cursor: pointer; border: none; background: none; }
        .nav-tab.active { color: #fff; position: relative; }
        .nav-tab.active::after { content: ''; position: absolute; bottom: -12px; left: 0; width: 100%; height: 2px; background: var(--accent); }

        /* 中部核心区 */
        .pro-content {
          flex: 1;
          display: grid;
          grid-template-columns: 300px 1fr 320px;
          background: #000;
          gap: 1px;
          min-height: 0;
        }
        .panel-container { background: var(--bg); display: flex; flex-direction: column; overflow: hidden; }

        /* 左侧素材浏览器 */
        .browser-header { padding: 12px; border-bottom: 1px solid var(--border); display: flex; gap: 12px; }
        .browser-tab { font-size: 11px; font-weight: 700; color: var(--text-dim); cursor: pointer; border: none; background: none; }
        .browser-tab.active { color: var(--accent); }

        /* 中间监视器 */
        .monitor-area { background: #080808; display: flex; flex-direction: column; padding: 16px; position: relative; }
        .monitor-stage { flex: 1; background: #000; border-radius: 8px; border: 1px solid var(--border); box-shadow: 0 20px 50px rgba(0,0,0,0.5); overflow: hidden; }
        .monitor-info { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .timecode-pro { font-family: "SF Mono", monospace; color: var(--accent); font-size: 18px; font-weight: 700; }
        .res-badge { font-size: 10px; background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; color: var(--text-dim); }

        /* 底部时间轴 */
        .pro-bottom-timeline {
          height: 360px;
          background: var(--bg);
          border-top: 1px solid #222;
          display: flex;
          flex-direction: column;
        }
        .timeline-tools { height: 36px; border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 12px; justify-content: space-between; }
        .tool-btn-group { display: flex; gap: 8px; }
        .pro-tool-btn { background: none; border: 1px solid var(--border); color: var(--text-dim); width: 28px; height: 28px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; }
        .pro-tool-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }

        /* 统一导出按钮 */
        .btn-export-pro { background: var(--accent); color: #fff; border: none; padding: 6px 12px; border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer; }
      `}</style>

      <ToastContainer />
      
      <header className="pro-top-nav">
        <div className="logo-text">VEOMUSE PRO</div>
        <div className="nav-tabs">
          <button className="nav-tab active">编辑</button>
          <button className="nav-tab">调色</button>
          <button className="nav-tab">交付</button>
        </div>
        <button className="btn-export-pro">导出作品</button>
      </header>

      <main className="pro-content">
        {/* 左侧：资产与导演 */}
        <aside className="panel-container">
          <div className="browser-header">
            <button className="browser-tab active">项目素材</button>
            <button className="browser-tab">AI 导演</button>
          </div>
          <div style={{ flex: 1, padding: '12px' }}>
            <AssetPanel />
          </div>
        </aside>

        {/* 中间：专业监视器 */}
        <section className="monitor-area">
          <div className="monitor-info">
            <div style={{ color: '#ff3b30', fontSize: '10px', fontWeight: 800 }}>● LIVE</div>
            <div className="timecode-pro">00:00:00:00</div>
            <div className="res-badge">4K HDR | 60 FPS</div>
          </div>
          <div className="monitor-stage">
            <MultiVideoPlayer />
          </div>
          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center', gap: '20px' }}>
            <button className="pro-tool-btn">⏮</button>
            <button className="pro-tool-btn active">▶</button>
            <button className="pro-tool-btn">⏭</button>
          </div>
        </section>

        {/* 右侧：属性面板 */}
        <aside className="panel-container">
          <PropertyInspector />
        </aside>
      </main>

      <footer className="pro-bottom-timeline">
        <div className="timeline-tools">
          <div className="tool-btn-group">
            <button className="pro-tool-btn active">↖</button>
            <button className="pro-tool-btn">✂</button>
            <button className="pro-tool-btn">✋</button>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 600 }}>
            渲染缓存: 100% | 自动吸附: ON
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <VideoEditor />
        </div>
      </footer>
    </div>
  )
}

export default App
