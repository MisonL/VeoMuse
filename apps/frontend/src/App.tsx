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
            vTrack.clips.push({ id: `auto-${Date.now()}-${i}`, start: offset, end: offset + 5, src: '', name: scene.title, type: 'video' });
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
          --ap-accent-glow: rgba(0, 122, 255, 0.3);
          --ap-text: #F5F5F7;
          --ap-text-dim: #8E8E93;
          --ap-radius: 14px;
          --ap-gap: 10px;
        }

        [data-theme='light'] {
          --ap-bg: #F5F5F7;
          --ap-surface: #FFFFFF;
          --ap-card: #FBFBFD;
          --ap-border: rgba(0, 0, 0, 0.08);
          --ap-text: #1C1C1E;
          --ap-text-dim: #8E8E93;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        body { background: var(--ap-bg); color: var(--ap-text); font-family: -apple-system, system-ui, sans-serif; overflow: hidden; }

        .veomuse-industrial-shell {
          height: 100vh; width: 100vw; display: flex; flex-direction: column; background: var(--ap-bg); padding: 8px; gap: 8px;
        }

        .pro-panel {
          background: var(--ap-surface); border: 1px solid var(--ap-border); border-radius: 16px; display: flex; flex-direction: column; overflow: hidden;
          box-shadow: 0 4px 24px rgba(0,0,0,0.05);
        }

        /* 顶栏重塑：三段式均衡布局 */
        .header-bar { 
          height: 64px; padding: 0 24px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; background: var(--ap-surface); 
        }
        
        .brand-zone { display: flex; align-items: center; gap: 12px; }
        .brand-logo { 
          width: 30px; height: 30px; background: var(--ap-accent); border-radius: 8px; 
          display: flex; align-items: center; justify-content: center; font-weight: 900; color: #fff; font-size: 16px;
          border: 0.5px solid rgba(255,255,255,0.2);
        }
        .brand-name { font-weight: 800; font-size: 15px; letter-spacing: -0.5px; opacity: 0.9; }

        .mode-selector { 
          display: flex; background: rgba(128,128,128,0.08); padding: 4px; border-radius: 12px; gap: 4px; 
          border: 0.5px solid var(--ap-border);
        }
        .mode-tab { border: none; background: none; padding: 8px 24px; border-radius: 9px; font-size: 13px; font-weight: 700; color: var(--ap-text-dim); cursor: pointer; transition: 0.2s; }
        .mode-tab.active { background: var(--ap-surface); color: var(--ap-accent); box-shadow: 0 2px 10px rgba(0,0,0,0.08); }

        .header-actions { display: flex; justify-content: flex-end; align-items: center; gap: 20px; }

        .main-layout { flex: 1; display: grid; grid-template-columns: 340px 1fr 360px; gap: 8px; min-height: 0; }
        .panel-title-bar { height: 48px; padding: 0 20px; border-bottom: 1px solid var(--ap-border); display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }

        .monitor-core { background: #000 !important; position: relative; border: 1px solid #222 !important; }
        [data-theme='light'] .monitor-core { border-color: #eee !important; }
        .monitor-overlay { position: absolute; top: 24px; left: 24px; right: 24px; display: flex; justify-content: space-between; z-index: 5; pointer-events: none; }
        .timecode { font-family: "SF Mono", monospace; color: var(--ap-accent); font-size: 26px; font-weight: 600; letter-spacing: -1.5px; }
        
        .transport-controls { height: 80px; display: flex; justify-content: center; gap: 48px; align-items: center; border-top: 1px solid rgba(255,255,255,0.03); flex-shrink: 0; }
        .transport-btn { background: none; border: none; color: #fff; cursor: pointer; transition: 0.2s; font-size: 24px; }
        .transport-btn.play { color: var(--ap-accent); font-size: 44px; opacity: 1; }

        .timeline-container { height: 400px; flex-shrink: 0; }
        .tool-icon { 
          width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; 
          border-radius: 8px; border: none; background: transparent; cursor: pointer; color: var(--ap-text-dim); font-size: 20px; transition: 0.2s;
        }
        .tool-icon.active { background: var(--ap-accent); color: #fff; box-shadow: 0 0 15px var(--ap-accent-glow); }
      `}</style>

      <ToastContainer />
      
      <header className="pro-panel header-bar">
        <div className="brand-zone">
          <div className="brand-logo">V</div>
          <span className="brand-name">VEOMUSE PRO</span>
        </div>
        
        <div className="mode-selector">
          {['edit', 'color', 'audio'].map(m => (
            <button key={m} className={`mode-tab ${activeMode === m ? 'active' : ''}`} onClick={() => setActiveMode(m)}>
              {m === 'edit' ? '剪辑' : m === 'color' ? '调色' : '音频大师'}
            </button>
          ))}
        </div>

        <div className="header-actions">
          <ThemeSwitcher />
          <button style={{ background: 'var(--ap-accent)', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '10px', fontSize: '13px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px var(--ap-accent-glow)' }}>导出</button>
        </div>
      </header>

      <div className="os-main main-layout">
        <aside className="pro-panel">
          <div className="panel-title-bar">
            <div style={{ display: 'flex', gap: '20px' }}>
              <button style={{ background: 'none', border: 'none', color: activeSidebar === 'assets' ? 'var(--ap-accent)' : 'var(--ap-text-dim)', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }} onClick={() => setActiveSidebar('assets')}>媒体资源</button>
              <button style={{ background: 'none', border: 'none', color: activeSidebar === 'director' ? 'var(--ap-accent)' : 'var(--ap-text-dim)', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }} onClick={() => setActiveSidebar('director')}>AI 导演</button>
            </div>
          </div>
          <div style={{ flex: 1, padding: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {activeSidebar === 'assets' ? <AssetPanel /> : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <textarea 
                  placeholder="在此输入您的创意分镜脚本..." 
                  value={directorPrompt}
                  onChange={(e) => setDirectorPrompt(e.target.value)}
                  style={{ flex: 1, background: 'rgba(128,128,128,0.05)', border: '1px solid var(--ap-border)', borderRadius: '12px', padding: '20px', color: 'var(--ap-text)', resize: 'none', outline: 'none', fontSize: '15px' }} 
                />
                <button onClick={handleDirector} disabled={isProcessing} style={{ background: 'var(--ap-accent)', color: '#fff', border: 'none', height: '52px', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', opacity: isProcessing ? 0.5 : 1 }}>
                  {isProcessing ? '构思中...' : '生成分镜序列'}
                </button>
              </div>
            )}
          </div>
        </aside>

        <section className="pro-panel monitor-core">
          {activeMode === 'edit' ? (
            <>
              <div className="monitor-overlay">
                <div style={{ color: '#FF3B30', fontSize: '11px', fontWeight: 900, background: 'rgba(255,59,48,0.1)', padding: '3px 8px', borderRadius: '4px' }}>● 实时</div>
                <div className="timecode">00:00:00:00</div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ap-text-dim)' }}>4K | HDR</div>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}><MultiVideoPlayer /></div>
              <div className="transport-controls">
                <button className="transport-btn" onClick={() => setCurrentTime(0)}>⏮</button>
                <button className="transport-btn play" onClick={togglePlay}>{isPlaying ? '⏸' : '▶'}</button>
                <button className="transport-btn" onClick={() => setCurrentTime(tracks[0]?.clips[0]?.end || 0)}>⏭</button>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--ap-text-dim)', gap: '20px' }}>
              <div style={{ fontSize: '48px' }}>{activeMode === 'color' ? '🎨' : '🎚️'}</div>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>{activeMode.toUpperCase()} 引擎已挂载</div>
            </div>
          )}
        </section>

        <aside className="pro-panel pro-inspector-outer">
          <div className="panel-title-bar"><span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ap-text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>属性检查器</span></div>
          <div style={{ flex: 1, overflowY: 'auto' }}><PropertyInspector /></div>
        </aside>
      </div>

      <footer className="pro-panel timeline-container">
        <div className="timeline-actions" style={{ height: '52px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button className={`tool-icon ${activeTool === 'select' ? 'active' : ''}`} onClick={() => setActiveTool('select')}>↖</button>
            <button className={`tool-icon ${activeTool === 'cut' ? 'active' : ''}`} onClick={() => setActiveTool('cut')}>✂</button>
            <button className={`tool-icon ${activeTool === 'hand' ? 'active' : ''}`} onClick={() => setActiveTool('hand')}>✋</button>
          </div>
          
          <div style={{ display: 'flex', gap: '20px', fontSize: '10px', fontWeight: 800, color: 'var(--ap-text-dim)', textTransform: 'uppercase' }}>
            <div style={{ background: 'rgba(52,199,89,0.1)', padding: '2px 8px', borderRadius: '4px', color: '#34C759' }}>GPU: {systemStatus.gpu}%</div>
            <div style={{ borderLeft: '1px solid var(--ap-border)', paddingLeft: '12px' }}>CACHE: 92%</div>
            <div style={{ borderLeft: '1px solid var(--ap-border)', paddingLeft: '12px', color: 'var(--ap-accent)' }}>ROL DOWN 8.0</div>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', padding: '16px', background: 'rgba(0,0,0,0.02)' }}>
          <VideoEditor activeTool={activeTool as any} />
        </div>
      </footer>
    </div>
  )
}

export default App
