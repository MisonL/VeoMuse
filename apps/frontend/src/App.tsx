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

  // 模拟工业级数据流
  const systemStatus = useMemo(() => ({
    gpu: Math.floor(Math.random() * 30 + 10),
    ram: '4.2GB / 32GB',
    cached: '92%'
  }), [activeMode]);

  return (
    <div className="veomuse-industrial-shell" onContextMenu={e => e.preventDefault()}>
      <style>{`
        :root {
          --ap-bg: #000000;
          --ap-surface: #1C1C1E;
          --ap-card: #2C2C2E;
          --ap-border: rgba(255, 255, 255, 0.08);
          --ap-accent: #007AFF;
          --ap-accent-glow: rgba(0, 122, 255, 0.4);
          --ap-text: #F5F5F7;
          --ap-text-dim: #8E8E93;
          --ap-radius: 16px;
          --ap-gap: 12px;
        }

        [data-theme='light'] {
          --ap-bg: #F2F2F7;
          --ap-surface: #FFFFFF;
          --ap-card: #FBFBFD;
          --ap-border: rgba(0, 0, 0, 0.06);
          --ap-text: #1C1C1E;
          --ap-text-dim: #8E8E93;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        body { background: var(--ap-bg); color: var(--ap-text); font-family: -apple-system, system-ui, sans-serif; overflow: hidden; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); }

        .veomuse-industrial-shell {
          height: 100vh; width: 100vw; display: flex; flex-direction: column; background: var(--ap-bg); padding: var(--ap-gap); gap: var(--ap-gap);
        }

        /* 统一工业级卡片 */
        .pro-panel {
          background: var(--ap-surface);
          border: 1px solid var(--ap-border);
          border-radius: var(--ap-radius);
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          transition: all 0.3s ease;
        }

        /* 顶部：旗舰级导航 */
        .header-bar {
          height: 60px; padding: 0 24px; display: flex; align-items: center; justify-content: space-between;
        }
        .brand-zone { display: flex; align-items: center; gap: 12px; }
        .brand-logo { width: 32px; height: 32px; background: var(--ap-accent); border-radius: 8px; box-shadow: 0 0 15px var(--ap-accent-glow); display: flex; align-items: center; justify-content: center; font-weight: 900; color: #fff; font-size: 18px; }
        .brand-name { font-weight: 800; font-size: 16px; letter-spacing: -0.5px; }

        .mode-selector { display: flex; background: rgba(128,128,128,0.08); padding: 4px; border-radius: 12px; gap: 4px; }
        .mode-tab { border: none; background: none; padding: 8px 20px; border-radius: 9px; font-size: 13px; font-weight: 700; color: var(--ap-text-dim); cursor: pointer; transition: 0.2s; }
        .mode-tab.active { background: var(--ap-surface); color: var(--ap-text); box-shadow: 0 2px 10px rgba(0,0,0,0.1); }

        /* 中部：生产力矩阵 */
        .main-layout { flex: 1; display: grid; grid-template-columns: 340px 1fr 360px; gap: var(--ap-gap); min-height: 0; }
        
        .panel-title-bar { height: 48px; padding: 0 20px; border-bottom: 1px solid var(--ap-border); display: flex; align-items: center; justify-content: space-between; background: rgba(128,128,128,0.02); }
        .panel-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: var(--ap-text-dim); }

        /* 监视器：核心沉浸区 */
        .monitor-core { background: #000 !important; border: 1px solid #333 !important; position: relative; }
        .monitor-overlay { position: absolute; top: 24px; left: 24px; right: 24px; display: flex; justify-content: space-between; pointer-events: none; z-index: 5; }
        .timecode-display { font-family: "SF Mono", monospace; color: var(--ap-accent); font-size: 28px; font-weight: 600; letter-spacing: -1.5px; filter: drop-shadow(0 0 10px rgba(0,122,255,0.3)); }
        
        .transport-controls { height: 80px; display: flex; justify-content: center; gap: 48px; align-items: center; border-top: 1px solid rgba(255,255,255,0.03); }
        .transport-btn { background: none; border: none; color: #fff; cursor: pointer; opacity: 0.6; transition: 0.2s; font-size: 24px; }
        .transport-btn:hover { opacity: 1; transform: scale(1.1); }
        .transport-btn.play { color: var(--ap-accent); font-size: 48px; opacity: 1; }

        /* 底部：工业级时间轴 */
        .timeline-container { height: 400px; }
        .timeline-actions { height: 52px; padding: 0 24px; border-bottom: 1px solid var(--ap-border); display: flex; align-items: center; justify-content: space-between; }
        
        .tool-bar { display: flex; gap: 12px; }
        .tool-icon { 
          width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; 
          border-radius: 8px; border: 1px solid transparent; cursor: pointer; transition: 0.2s; color: var(--ap-text-dim); font-size: 20px;
        }
        .tool-icon.active { background: var(--ap-accent); color: #fff; box-shadow: 0 0 15px var(--ap-accent-glow); }

        .system-meta { display: flex; gap: 24px; font-size: 10px; font-weight: 800; color: var(--ap-text-dim); text-transform: uppercase; }
        .meta-item span { color: #34C759; margin-left: 4px; }

        /* 修复属性面板溢出与背景 */
        .pro-inspector-outer { height: 100%; }
        .pro-inspector-outer * { background-color: transparent !important; color: inherit !important; }
      `}</style>

      <ToastContainer />
      
      {/* 顶部旗舰导航 */}
      <header className="pro-panel header-bar">
        <div className="brand-zone">
          <div className="brand-logo">V</div>
          <div className="brand-name">VEOMUSE PRO <small style={{fontSize: '10px', opacity: 0.5}}>V3.1</small></div>
        </div>
        
        <div className="mode-selector">
          {['edit', 'color', 'audio'].map(m => (
            <button key={m} className={`mode-tab ${activeMode === m ? 'active' : ''}`} onClick={() => setActiveMode(m)}>
              {m === 'edit' ? '剪辑' : m === 'color' ? '调色' : '音频'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <ThemeSwitcher />
          <button style={{ background: 'var(--ap-accent)', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '10px', fontSize: '13px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 15px var(--ap-accent-glow)' }}>导出 HDR</button>
        </div>
      </header>

      {/* 主生产力矩阵 */}
      <div className="main-layout">
        <aside className="pro-panel">
          <div className="panel-title-bar">
            <div style={{ display: 'flex', gap: '20px' }}>
              <button style={{ background: 'none', border: 'none', color: activeSidebar === 'assets' ? 'var(--ap-accent)' : 'var(--ap-text-dim)', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }} onClick={() => setActiveSidebar('assets')}>媒体资源</button>
              <button style={{ background: 'none', border: 'none', color: activeSidebar === 'director' ? 'var(--ap-accent)' : 'var(--ap-text-dim)', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }} onClick={() => setActiveSidebar('director')}>AI 导演</button>
            </div>
          </div>
          <div style={{ flex: 1, padding: '24px', overflow: 'hidden' }}>
            {activeSidebar === 'assets' ? <AssetPanel /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
                <textarea placeholder="输入创意脚本..." style={{ flex: 1, background: 'rgba(128,128,128,0.05)', border: '1px solid var(--ap-border)', borderRadius: '12px', padding: '20px', color: 'var(--ap-text)', resize: 'none', outline: 'none', fontSize: '15px', lineHeight: '1.6' }} />
                <button style={{ background: 'var(--ap-accent)', color: '#fff', border: 'none', height: '52px', borderRadius: '12px', fontWeight: 800, fontSize: '14px', cursor: 'pointer' }}>生成分镜序列</button>
              </div>
            )}
          </div>
        </aside>

        <section className="pro-panel monitor-core">
          {activeMode === 'edit' ? (
            <>
              <div className="monitor-overlay">
                <div style={{ color: '#FF3B30', fontSize: '11px', fontWeight: 900 }}>● 实时</div>
                <div className="timecode-display">00:00:00:00</div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ap-text-dim)' }}>4K | 60 FPS</div>
              </div>
              <div className="monitor-stage">
                <MultiVideoPlayer />
              </div>
              <div className="transport-controls">
                <button className="transport-btn">⏮</button>
                <button className="transport-btn play">▶</button>
                <button className="transport-btn">⏭</button>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
              <div style={{ fontSize: '48px' }}>{activeMode === 'color' ? '🎨' : '🎚️'}</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ap-text-dim)' }}>
                {activeMode === 'color' ? 'GPU 加速调色引擎已就绪' : '多通道音频混音器已加载'}
              </div>
              <button style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--ap-border)', padding: '12px 32px', borderRadius: '12px', fontWeight: 700 }}>进入实验室</button>
            </div>
          )}
        </section>

        <aside className="pro-panel pro-inspector-outer">
          <div className="panel-title-bar"><span className="panel-label">属性检查器</span></div>
          <PropertyInspector />
        </aside>
      </div>

      {/* 底部时间轴系统 */}
      <footer className="pro-panel timeline-container">
        <div className="timeline-actions">
          <div className="tool-bar">
            <button className={`tool-icon ${activeTool === 'select' ? 'active' : ''}`} onClick={() => setActiveTool('select')}>↖</button>
            <button className={`tool-icon ${activeTool === 'cut' ? 'active' : ''}`} onClick={() => setActiveTool('cut')}>✂</button>
            <button className={`tool-icon ${activeTool === 'hand' ? 'active' : ''}`} onClick={() => setActiveTool('hand')}>✋</button>
          </div>
          
          <div className="system-meta">
            <div className="meta-item">GPU 负载: <span>{systemStatus.gpu}%</span></div>
            <div className="meta-item">内存占用: <span>{systemStatus.ram}</span></div>
            <div className="meta-item">引擎: <span>ROL DOWN 8.0</span></div>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', padding: '16px' }}>
          <VideoEditor activeTool={activeTool as any} />
        </div>
      </footer>
    </div>
  )
}

export default App
