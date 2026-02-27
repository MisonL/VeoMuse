import { useState, memo, useEffect, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from './store/editorStore'
import { useToastStore } from './store/toastStore'
import { useThemeSync } from './hooks/useThemeSync'
import { api, getErrorMessage } from './utils/eden'
import VideoEditor from './components/Editor/VideoEditor'
import MultiVideoPlayer from './components/Editor/MultiVideoPlayer'
import PropertyInspector from './components/Editor/PropertyInspector'
import AssetPanel from './components/Editor/AssetPanel'
import ComparisonLab from './components/Editor/ComparisonLab'
import ToastContainer from './components/Editor/ToastContainer'
import ThemeSwitcher from './components/Common/ThemeSwitcher'

function App() {
  useThemeSync(); 
  const { showToast } = useToastStore()
  
  const { isPlaying, togglePlay, setCurrentTime, tracks, setTracks } = useEditorStore(
    useShallow(state => ({
      isPlaying: state.isPlaying,
      togglePlay: state.togglePlay,
      setCurrentTime: state.setCurrentTime,
      tracks: state.tracks,
      setTracks: state.setTracks
    }))
  )

  // @ts-ignore
  const { undo, redo, pastStates, futureStates } = useEditorStore.temporal.getState()
  
  const [activeMode, setActiveMode] = useState('edit')
  const [activeTool, setActiveTool] = useState('select')
  const [activeSidebar, setActiveSidebar] = useState('assets')
  const [directorPrompt, setDirectorPrompt] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const [telemetryHistory, setTelemetryHistory] = useState<number[]>(new Array(10).fill(0));
  const [currentMetrics, setCurrentMetrics] = useState({ gpu: 0, ram: '0 / 0', cache: '0%' });

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const { data } = await api.api.admin.metrics.get();
        if (data && 'system' in data) {
          const gpuLoad = Math.round(data.system.renderLoad);
          setCurrentMetrics({
            gpu: gpuLoad,
            ram: `${(data.system.memory.total / (1024 ** 3)).toFixed(1)}GB`,
            cache: `${Math.round(data.system.memory.usage * 100)}%`
          });
          setTelemetryHistory(prev => [...prev.slice(1), gpuLoad]);
        }
      } catch (e) {}
    };
    const timer = setInterval(fetchMetrics, 2000);
    fetchMetrics();
    return () => clearInterval(timer);
  }, []);

  const handleDirector = async () => {
    if (!directorPrompt) return showToast('请输入脚本', 'info');
    setIsProcessing(true);
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

  return (
    <div className="pro-master-shell" onContextMenu={e => e.preventDefault()}>
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
          --ap-radius: 12px;
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
        body { background: var(--ap-bg); color: var(--ap-text); font-family: -apple-system, system-ui, sans-serif; overflow: hidden; transition: background 0.3s ease; }

        .pro-master-shell {
          height: 100vh; width: 100vw; display: grid; grid-template-rows: 56px 1fr 380px; gap: 8px; background: var(--ap-bg); padding: 8px;
        }

        .pro-panel { background: var(--ap-surface); border: 1px solid var(--ap-border); border-radius: 14px; display: flex; flex-direction: column; overflow: hidden; }

        .os-header { display: grid; grid-template-columns: 240px 1fr 400px; align-items: center; padding: 0 24px; }
        .brand-zone { display: flex; align-items: center; gap: 12px; }
        .brand-logo { width: 28px; height: 28px; background: var(--ap-accent); border-radius: 7px; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #fff; font-size: 16px; border: 0.5px solid rgba(255,255,255,0.2); }
        
        .mode-selector { display: flex; background: rgba(128,128,128,0.08); padding: 3px; border-radius: 10px; gap: 2px; border: 0.5px solid var(--ap-border); justify-self: center; }
        .mode-tab { border: none; background: none; padding: 6px 20px; border-radius: 8px; font-size: 12px; font-weight: 700; color: var(--ap-text-dim); cursor: pointer; transition: 0.2s; }
        .mode-tab.active { background: var(--ap-surface); color: var(--ap-accent); box-shadow: 0 2px 8px rgba(0,0,0,0.08); }

        .os-main { display: grid; grid-template-columns: 320px 1fr 340px; gap: 8px; min-height: 0; }
        .panel-title-bar { height: 44px; padding: 0 16px; border-bottom: 1px solid var(--ap-border); display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }

        .monitor-core { background: #000 !important; position: relative; border: 1px solid #222 !important; }
        .timecode { font-family: "SF Mono", monospace; color: var(--ap-accent); font-size: 26px; font-weight: 600; letter-spacing: -1.5px; }
        
        .transport-controls { height: 74px; display: flex; justify-content: center; gap: 48px; align-items: center; border-top: 1px solid rgba(255,255,255,0.03); flex-shrink: 0; }
        .transport-btn { background: none; border: none; color: #fff; cursor: pointer; transition: 0.2s; font-size: 24px; }
        .transport-btn.play { color: var(--ap-accent); font-size: 40px; opacity: 1; }

        .timeline-container { height: 380px; flex-shrink: 0; }
        
        /* 终极对齐修复：遥测看板 */
        .timeline-actions { 
          height: 52px; padding: 0 20px; border-bottom: 1px solid var(--ap-border); 
          display: flex; flex-direction: row !important; align-items: center !important; justify-content: space-between; 
        }
        
        .system-telemetry { 
          display: flex !important; flex-direction: row !important; align-items: center !important; gap: 20px; height: 100%;
        }
        
        .telemetry-item { 
          display: flex !important; flex-direction: row !important; align-items: center !important; gap: 8px; 
          font-size: 10px; font-weight: 800; color: var(--ap-text-dim); text-transform: uppercase; white-space: nowrap;
        }

        .telemetry-sparkline { display: flex; align-items: flex-end; gap: 2px; height: 12px; width: 40px; }
        .spark-bar { width: 3px; background: #34C759; border-radius: 1px; transition: height 0.5s ease; }

        .pro-inspector-outer div, .pro-inspector-outer section { background-color: transparent !important; color: inherit !important; border-color: var(--ap-border) !important; }
      `}</style>

      <ToastContainer />
      
      <header className="pro-panel os-header">
        <div className="brand-zone">
          <div className="brand-logo">V</div>
          <span style={{fontWeight: 800, fontSize: '15px'}}>VEOMUSE PRO</span>
        </div>
        <div className="mode-selector">
          {['edit', 'color', 'audio'].map(m => (
            <button key={m} className={`mode-tab ${activeMode === m ? 'active' : ''}`} onClick={() => setActiveMode(m)}>
              {m === 'edit' ? '剪辑' : m === 'color' ? '实验室' : '音频大师'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <ThemeSwitcher />
          <button style={{ background: 'var(--ap-accent)', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '10px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>导出</button>
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
          <div style={{ flex: 1, padding: '20px', overflow: 'hidden' }}>
            <AssetPanel mode={activeSidebar as any} />
          </div>
        </aside>

        <section className="pro-panel monitor-core">
          {activeMode === 'edit' ? (
            <>
              <div className="monitor-overlay">
                <div style={{ color: '#FF3B30', fontSize: '10px', fontWeight: 900 }}>● 实时</div>
                <div className="timecode">00:00:00:00</div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--ap-text-dim)' }}>4K | HDR</div>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}><MultiVideoPlayer /></div>
              <div className="transport-controls">
                <button className="transport-btn" onClick={() => setCurrentTime(0)}>⏮</button>
                <button className="transport-btn play" onClick={togglePlay}>{isPlaying ? '⏸' : '▶'}</button>
                <button className="transport-btn" onClick={() => setCurrentTime(tracks[0]?.clips[0]?.end || 0)}>⏭</button>
              </div>
            </>
          ) : activeMode === 'color' ? (
            <ComparisonLab />
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--ap-text-dim)', gap: '20px' }}>
              <div style={{ fontSize: '48px' }}>🎚️</div>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>AUDIO MASTER 引擎已就绪</div>
            </div>
          )}
        </section>

        <aside className="pro-panel pro-inspector-outer">
          <div className="panel-title-bar"><span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ap-text-dim)' }}>属性检查器</span></div>
          <div style={{ flex: 1, overflowY: 'auto' }}><PropertyInspector /></div>
        </aside>
      </div>

      <footer className="pro-panel timeline-container">
        <div className="timeline-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '4px', marginRight: '12px', borderRight: '1px solid var(--ap-border)', paddingRight: '12px' }}>
              <button className="tool-icon" onClick={() => undo()} disabled={pastStates.length === 0}>↩</button>
              <button className="tool-icon" onClick={() => redo()} disabled={futureStates.length === 0}>↪</button>
            </div>
            <button className={`tool-icon ${activeTool === 'select' ? 'active' : ''}`} onClick={() => setActiveTool('select')}>↖</button>
            <button className={`tool-icon ${activeTool === 'cut' ? 'active' : ''}`} onClick={() => setActiveTool('cut')}>✂</button>
            <button className={`tool-icon ${activeTool === 'hand' ? 'active' : ''}`} onClick={() => setActiveTool('hand')}>✋</button>
          </div>
          
          <div className="system-telemetry">
            <div className="telemetry-item">
              <span>GPU LOAD: <b style={{color: '#34C759', marginLeft: '4px'}}>{currentMetrics.gpu}%</b></span>
              <div className="telemetry-sparkline">
                {telemetryHistory.map((v, i) => <div key={i} className="spark-bar" style={{ height: `${v}%` }} />)}
              </div>
            </div>
            <div className="telemetry-item" style={{ borderLeft: '1px solid var(--ap-border)', paddingLeft: '16px' }}>
              RAM: <span style={{ color: '#34C759' }}>{currentMetrics.ram}</span>
            </div>
            <div className="telemetry-item" style={{ borderLeft: '1px solid var(--ap-border)', paddingLeft: '16px' }}>
              CACHE: <span style={{ color: 'var(--ap-accent)' }}>{currentMetrics.cache}</span>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', padding: '16px', background: 'rgba(0,0,0,0.02)' }}>
          <VideoEditor activeTool={activeTool as any} />
        </div>
      </footer>
    </div>
  )
}

export default memo(App)
