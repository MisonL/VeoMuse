import { useState, memo, useCallback } from 'react'
import { api } from './utils/eden'
import { useEditorStore } from './store/editorStore'
import { useToastStore } from './store/toastStore'
import VideoEditor from './components/Editor/VideoEditor'
import MultiVideoPlayer from './components/Editor/MultiVideoPlayer'
import PropertyInspector from './components/Editor/PropertyInspector'
import AssetPanel from './components/Editor/AssetPanel'
import ToastContainer from './components/Editor/ToastContainer'
import { ToolButton } from './components/Common/Atoms'
import './App.css'

function App() {
  const { showToast } = useToastStore()
  const [activeTool, setActiveTool] = useState<'select' | 'cut' | 'hand'>('select')
  const [monitorRes] = useState('4K HDR | 10-bit')
  const { tracks } = useEditorStore()

  const handleExport = useCallback(async () => {
    showToast('正在准备渲染引擎...', 'info');
    try {
      const { data, error } = await api.api.video.compose.post({ timelineData: { tracks } });
      if (error) showToast('渲染任务提交失败', 'error');
      else if (data && 'outputPath' in data) showToast(`渲染成功: ${data.outputPath}`, 'success');
    } catch (e: any) { showToast(e.message, 'error'); }
  }, [tracks, showToast]);

  return (
    <div className="pro-workspace">
      <ToastContainer />
      
      <header className="pro-header">
        <div className="pro-logo">
          <div className="pro-orb" />
          <span>VEOMUSE <small>PRO V3.1</small></span>
        </div>
        <div className="workspace-tabs">
          <button className="w-tab active">编辑</button>
          <button className="w-tab">视觉效果</button>
          <button className="w-tab">音频混合</button>
          <button className="w-tab">导出</button>
        </div>
        <div className="header-actions">
          <button className="export-btn" onClick={handleExport}>导出作品</button>
        </div>
      </header>

      <main className="pro-main">
        <section className="pro-browser">
          <div className="browser-tabs">
            <button className="b-tab active">项目资产</button>
            <button className="b-tab">AI 导演中心</button>
          </div>
          <div className="browser-content">
            <AssetPanel />
          </div>
        </section>

        <section className="pro-monitor">
          <div className="monitor-header">
            <div className="status-indicator">● LIVE</div>
            <span className="timecode">00:00:00:00</span>
            <span className="res-tag">{monitorRes}</span>
          </div>
          <div className="monitor-viewport">
            <MultiVideoPlayer />
          </div>
          <div className="monitor-controls-pro">
            <div className="audio-peak-meter">
              <div className="audio-meter"><div className="meter-fill" style={{ height: '40%' }} /></div>
              <div className="audio-meter"><div className="meter-fill" style={{ height: '35%' }} /></div>
            </div>
            <div className="transport-controls">
              <ToolButton icon="⏮" />
              <ToolButton icon="▶" active />
              <ToolButton icon="⏭" />
            </div>
            <div className="monitor-extras">
              <span className="fps-label">60 FPS</span>
            </div>
          </div>
        </section>

        <section className="pro-inspector">
          <PropertyInspector />
        </section>
      </main>

      <footer className="pro-footer">
        <div className="timeline-toolbar">
          <div className="tool-group">
            <ToolButton icon="↖" active={activeTool === 'select'} onClick={() => setActiveTool('select')} label="选择工具 (V)" />
            <ToolButton icon="✂" active={activeTool === 'cut'} onClick={() => setActiveTool('cut')} label="剃刀工具 (C)" />
            <ToolButton icon="✋" active={activeTool === 'hand'} onClick={() => setActiveTool('hand')} label="抓手工具 (H)" />
          </div>
          <div className="timeline-meta">
            <span className="meta-item">已开启磁吸对齐</span>
            <div className="divider" />
            <span className="meta-item">渲染缓存: 85%</span>
          </div>
        </div>
        <div className="timeline-engine-pro">
          <VideoEditor activeTool={activeTool} />
        </div>
      </footer>
    </div>
  )
}

export default App
