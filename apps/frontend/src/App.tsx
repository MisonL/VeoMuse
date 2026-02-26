import { useState, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToastStore } from './store/toastStore'
import VideoEditor from './components/Editor/VideoEditor'
import MultiVideoPlayer from './components/Editor/MultiVideoPlayer'
import PropertyInspector from './components/Editor/PropertyInspector'
import AssetPanel from './components/Editor/AssetPanel'
import ToastContainer from './components/Editor/ToastContainer'
import { GlassCard, ToolButton, ProSlider } from './components/Common/Atoms'
import './App.css'

function App() {
  const [activeTool, setActiveTab] = useState<'select' | 'cut' | 'hand'>('select')
  const [monitorRes, setMonitorRes] = useState('4K HDR')
  const [fps, setFps] = useState(60)

  return (
    <div className="pro-workspace">
      <ToastContainer />
      
      {/* 顶部：全球控制栏 */}
      <header className="pro-header">
        <div className="pro-logo">
          <div className="pro-orb" />
          <span>VEOMUSE <small>PRO V3.1</small></span>
        </div>
        <div className="workspace-tabs">
          <button className="w-tab active">编辑</button>
          <button className="w-tab">调色</button>
          <button className="w-tab">音频</button>
          <button className="w-tab">交付</button>
        </div>
        <div className="header-actions">
          <button className="export-btn">导出作品</button>
        </div>
      </header>

      {/* 中部：核心创作区 */}
      <main className="pro-main">
        {/* 左侧：素材与导演 */}
        <section className="pro-browser">
          <div className="browser-tabs">
            <button className="b-tab active">素材项目</button>
            <button className="b-tab">AI 导演</button>
          </div>
          <div className="browser-content">
            <AssetPanel />
          </div>
        </section>

        {/* 中间：主监视器 */}
        <section className="pro-monitor">
          <div className="monitor-header">
            <span className="timecode">00:00:00:00</span>
            <span className="res-tag">{monitorRes}</span>
          </div>
          <div className="monitor-viewport">
            <MultiVideoPlayer />
          </div>
          <div className="monitor-controls">
            <ToolButton icon="◀" />
            <ToolButton icon="▶" active />
            <ToolButton icon="▶▶" />
          </div>
        </section>

        {/* 右侧：精细化属性面板 */}
        <section className="pro-inspector">
          <PropertyInspector />
        </section>
      </main>

      {/* 底部：工业级时间轴 */}
      <footer className="pro-footer">
        <div className="timeline-toolbar">
          <div className="tool-group">
            <ToolButton icon="↖" active={activeTool === 'select'} onClick={() => setActiveTab('select')} label="选择工具 (V)" />
            <ToolButton icon="✂" active={activeTool === 'cut'} onClick={() => setActiveTab('cut')} label="剃刀工具 (C)" />
            <ToolButton icon="✋" active={activeTool === 'hand'} onClick={() => setActiveTab('hand')} label="抓手工具 (H)" />
          </div>
          <div className="timeline-meta">
            <span>FPS: {fps}</span>
            <div className="divider" />
            <span>自动吸附: 开启</span>
          </div>
        </div>
        <div className="timeline-engine">
          <VideoEditor />
        </div>
      </footer>
    </div>
  )
}

export default App
