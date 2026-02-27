import { useState, memo, useEffect, useMemo, useCallback } from 'react'
import { useEditorStore } from './store/editorStore'
import { useToastStore } from './store/toastStore'
import { useThemeSync } from './hooks/useThemeSync'
import { api, getErrorMessage } from './utils/eden'
import VideoEditor from './components/Editor/VideoEditor'
import MultiVideoPlayer from './components/Editor/MultiVideoPlayer'
import PropertyInspector from './components/Editor/PropertyInspector'
import AssetPanel from './components/Editor/AssetPanel'
import ToastContainer from './components/Editor/ToastContainer'
import ThemeSwitcher from './components/Common/ThemeSwitcher'

function App() {
  useThemeSync(); 
  const { showToast } = useToastStore()
  const { isPlaying, togglePlay, setCurrentTime, tracks, setTracks } = useEditorStore()
  const [activeMode, setActiveMode] = useState('edit')
  const [activeTool, setActiveTool] = useState('select')
  const [activeSidebar, setActiveSidebar] = useState('assets')
  const [directorPrompt, setDirectorPrompt] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // 物理交互：一键导演逻辑
  const handleDirector = async () => {
    if (!directorPrompt) return showToast('请输入导演创意', 'info');
    setIsProcessing(true);
    showToast('🎬 AI 导演正在构思分镜...', 'info');
    try {
      const { data, error } = await api.api.ai.director.analyze.post({ script: directorPrompt });
      if (error) throw new Error(getErrorMessage(error));
      
      if (data && 'scenes' in data) {
        let offset = 0;
        const newTracks = JSON.parse(JSON.stringify(tracks));
        const vTrack = newTracks.find((t: any) => t.id === 'track-v1');
        if (vTrack) {
          data.scenes.forEach((scene: any, i: number) => {
            vTrack.clips.push({
              id: `auto-${Date.now()}-${i}`, start: offset, end: offset + 5,
              src: '', name: scene.title, type: 'video'
            });
            offset += 5;
          });
          setTracks(newTracks);
          showToast('分镜序列生成成功', 'success');
        }
      }
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setIsProcessing(false); }
  };

  const systemStatus = useMemo(() => ({
    gpu: Math.floor(Math.random() * 15 + 5),
    ram: '5.1GB / 32GB'
  }), [isPlaying]);

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
        body { background: var(--ap-bg); color: var(--ap-text); font-family: -apple-system, sans-serif; overflow: hidden; }

        .veomuse-industrial-shell {
          height: 100vh; width: 100vw; display: flex; flex-direction: column; background: var(--ap-bg); padding: var(--ap-gap); gap: var(--ap-gap);
        }

        .pro-panel {
          background: var(--ap-surface); border: 1px solid var(--ap-border); border-radius: var(--ap-radius); display: flex; flex-direction: column; overflow: hidden;
        }

        .header-bar { height: 56px; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; }
        .mode-selector { display: flex; background: rgba(128,128,128,0.08); padding: 3px; border-radius: 10px; gap: 2px; }
        .mode-tab { border: none; background: none; padding: 6px 18px; border-radius: 8px; font-size: 12px; font-weight: 700; color: var(--ap-text-dim); cursor: pointer; }
        .mode-tab.active { background: var(--ap-surface); color: var(--ap-text); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }

        .main-layout { flex: 1; display: grid; grid-template-columns: 320px 1fr 340px; gap: var(--ap-gap); min-height: 0; }
        .panel-title-bar { height: 44px; padding: 0 16px; border-bottom: 1px solid var(--ap-border); display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }

        .monitor-core { background: #000 !important; position: relative; }
        .monitor-overlay { position: absolute; top: 20px; left: 24px; right: 24px; display: flex; justify-content: space-between; z-index: 5; pointer-events: none; }
        .timecode { font-family: "SF Mono", monospace; color: var(--ap-accent); font-size: 24px; font-weight: 600; letter-spacing: -1px; }
        
        .transport-controls { height: 70px; display: flex; justify-content: center; gap: 40px; align-items: center; border-top: 1px solid rgba(255,255,255,0.03); flex-shrink: 0; }
        .transport-btn { background: none; border: none; color: #fff; cursor: pointer; transition: 0.2s; font-size: 20px; outline: none; }
        .transport-btn:active { transform: scale(0.9); }
        .transport-btn.play { color: var(--ap-accent); font-size: 36px; opacity: 1; }

        .timeline-container { height: 380px; flex-shrink: 0; }
        .timeline-actions { height: 48px; border-bottom: 1px solid var(--ap-border); display: flex; align-items: center; padding: 0 16px; justify-content: space-between; }
        
        .tool-icon { 
          width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; 
          border-radius: 7px; border: none; background: transparent; cursor: pointer; color: var(--ap-text-dim); font-size: 18px;
        }
        .tool-icon.active { background: var(--ap-accent); color: #fff; box-shadow: 0 0 12px var(--ap-accent-glow); }

        .inspector-placeholder { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--ap-text-dim); gap: 12px; }
      `}</style>

      <header className="pro-panel header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '28px', height: '28px', background: 'var(--ap-accent)', borderRadius: '7px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>V</div>
          <span style={{ fontWeight: 800, fontSize: '15px' }}>VEOMUSEPRO</span>
        </div>
        <div className="mode-selector">
          {['edit', 'color', 'audio'].map(m => (
            <button key={m} className={`mode-tab ${activeMode === m ? 'active' : ''}`} onClick={() => setActiveMode(m)}>
              {m === 'edit' ? '剪辑' : m === 'color' ? '调色' : '音频大师'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <ThemeSwitcher />
          <button style={{ background: 'var(--ap-accent)', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '10px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>导出作品</button>
        </div>
      </header>

      <div className="os-main main-layout">
        <aside className="pro-panel">
          <div className="panel-title-bar">
            <div style={{ display: 'flex', gap: '16px' }}>
              <button style={{ background: 'none', border: 'none', color: activeSidebar === 'assets' ? 'var(--ap-accent)' : 'var(--ap-text-dim)', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }} onClick={() => setActiveSidebar('assets')}>素材资产</button>
              <button style={{ background: 'none', border: 'none', color: activeSidebar === 'director' ? 'var(--ap-accent)' : 'var(--ap-text-dim)', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }} onClick={() => setActiveSidebar('director')}>AI 导演</button>
            </div>
          </div>
          <div style={{ flex: 1, padding: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {activeSidebar === 'assets' ? <AssetPanel /> : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <textarea 
                  placeholder="在此输入您的创意分镜脚本..." 
                  value={directorPrompt}
                  onChange={(e) => setDirectorPrompt(e.target.value)}
                  style={{ flex: 1, background: 'rgba(128,128,128,0.05)', border: '1px solid var(--ap-border)', borderRadius: '10px', padding: '16px', color: 'var(--ap-text)', resize: 'none', outline: 'none' }} 
                />
                <button 
                  onClick={handleDirector}
                  disabled={isProcessing}
                  style={{ background: 'var(--ap-accent)', color: '#fff', border: 'none', height: '44px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', opacity: isProcessing ? 0.5 : 1 }}
                >
                  {isProcessing ? '处理中...' : '生成分镜序列'}
                </button>
              </div>
            )}
          </div>
        </aside>

        <section className="pro-panel monitor-core">
          {activeMode === 'edit' ? (
            <>
              <div className="monitor-overlay">
                <div style={{ color: '#FF3B30', fontSize: '10px', fontWeight: 900 }}>● LIVE</div>
                <div className="timecode">00:00:00:00</div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ap-text-dim)' }}>4K HDR</div>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}><MultiVideoPlayer /></div>
              <div className="transport-controls">
                <button className="transport-btn" onClick={() => setCurrentTime(0)}>⏮</button>
                <button className="transport-btn play" onClick={togglePlay}>{isPlaying ? '⏸' : '▶'}</button>
                <button className="transport-btn" onClick={() => setCurrentTime(tracks[0]?.clips[0]?.end || 0)}>⏭</button>
              </div>
            </>
          ) : (
            <div className="inspector-placeholder">
              <div style={{ fontSize: '40px' }}>{activeMode === 'color' ? '🎨' : '🎚️'}</div>
              <div style={{ fontWeight: 700 }}>{activeMode === 'color' ? '调色实验室' : '音频大师'} 模块已挂载</div>
              <div style={{ fontSize: '12px' }}>专业工具集正在物理初始化...</div>
            </div>
          )}
        </section>

        <aside className="pro-panel pro-inspector-outer">
          <div className="panel-title-bar"><span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ap-text-dim)' }}>属性检查器</span></div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <PropertyInspector />
          </div>
        </aside>
      </div>

      <footer className="pro-panel timeline-container">
        <div className="timeline-actions">
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className={`tool-icon ${activeTool === 'select' ? 'active' : ''}`} onClick={() => setActiveTool('select')}>↖</button>
            <button className={`tool-icon ${activeTool === 'cut' ? 'active' : ''}`} onClick={() => setActiveTool('cut')}>✂</button>
            <button className={`tool-icon ${activeTool === 'hand' ? 'active' : ''}`} onClick={() => setActiveTool('hand')}>✋</button>
          </div>
          <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--ap-text-dim)' }}>
            GPU: {systemStatus.gpu}% | ENGINE: ROL DOWN 8.0 | CACHE: 100%
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
