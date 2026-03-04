import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '../../store/editorStore'
import type { Asset } from '../../store/editorStore'
import { useActorsStore } from '../../store/actorsStore'
import type { ActorProfile } from '../../store/actorsStore'
import { useToastStore } from '../../store/toastStore'
import { buildAuthHeaders, getAccessToken, resolveApiBase } from '../../utils/eden'
import { MotionSyncManager } from '../../utils/motionSync'
import {
  appendAssetToTracks,
  buildActorCreatePayload,
  buildMotionSyncPatch,
  createImportedAsset,
  extractBase64Payload,
  filterAssetsByQueryAndCategory,
  findParentTrackByClipId,
  validateActorCreateInput,
  validateMotionSyncInput
} from './assetPanel.logic'
import './AssetPanel.css'

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error(`读取文件失败: ${file.name}`))
    reader.readAsDataURL(file)
  })

interface AssetPanelProps {
  mode?: 'assets' | 'director' | 'actors' | 'motion'
  directorPrompt?: string
  onDirectorPromptChange?: (value: string) => void
  onRunDirector?: () => Promise<void> | void
  directorScenes?: Array<{ title?: string; duration?: number; videoPrompt?: string }>
  isAiWorking?: boolean
}

const AssetPanel: React.FC<AssetPanelProps> = ({
  mode = 'assets',
  directorPrompt = '',
  onDirectorPromptChange,
  onRunDirector,
  directorScenes = [],
  isAiWorking = false
}) => {
  const {
    assets,
    addAsset,
    tracks,
    setTracks,
    selectedClipId,
    updateClip,
    isMotionCaptureActive,
    setMotionCaptureActive,
    latestMotionData,
    setLatestMotionData
  } = useEditorStore(
    useShallow((state) => ({
      assets: state.assets,
      addAsset: state.addAsset,
      tracks: state.tracks,
      setTracks: state.setTracks,
      selectedClipId: state.selectedClipId,
      updateClip: state.updateClip,
      isMotionCaptureActive: state.isMotionCaptureActive,
      setMotionCaptureActive: state.setMotionCaptureActive,
      latestMotionData: state.latestMotionData,
      setLatestMotionData: state.setLatestMotionData
    }))
  )
  const { showToast } = useToastStore()
  const { actors, isActorLoading, fetchActors, prependActor } = useActorsStore(
    useShallow((state) => ({
      actors: state.actors,
      isActorLoading: state.isLoading,
      fetchActors: state.fetchActors,
      prependActor: state.prependActor
    }))
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<'all' | 'video' | 'audio'>('all')
  const [actorName, setActorName] = useState('')
  const [actorRefImage, setActorRefImage] = useState('')
  const [motionActorId, setMotionActorId] = useState('')
  const [isActorCreating, setIsActorCreating] = useState(false)
  const [isMotionSyncing, setIsMotionSyncing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const objectUrlsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      objectUrlsRef.current.clear()
    }
  }, [])

  const loadActors = useCallback(async () => {
    try {
      await fetchActors()
    } catch (e: any) {
      showToast(e.message || '加载演员库失败', 'error')
    }
  }, [fetchActors, showToast])

  useEffect(() => {
    if (mode === 'actors' || mode === 'motion') {
      loadActors()
    }
  }, [mode, loadActors])

  const importFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files)
      if (!list.length) return

      for (const file of list) {
        const url = URL.createObjectURL(file)
        objectUrlsRef.current.add(url)
        let exportSrc = ''

        try {
          const dataUrl = await readFileAsDataUrl(file)
          const base64Data = extractBase64Payload(dataUrl)
          const response = await fetch(`${resolveApiBase()}/api/storage/local-import`, {
            method: 'POST',
            headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              fileName: file.name,
              base64Data,
              contentType: file.type || undefined
            })
          })
          const payload = (await response.json().catch(() => null)) as any
          if (!response.ok) {
            throw new Error(payload?.error || `HTTP ${response.status}`)
          }
          if (payload?.success && payload.imported?.localPath) {
            exportSrc = payload.imported.localPath
          }
        } catch (e: any) {
          showToast(`${file.name} 未能完成后端导入，将仅用于本地预览`, 'warning')
        }

        const newAsset: Asset = createImportedAsset(file, url, exportSrc, () => {
          return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        })
        addAsset(newAsset)
      }

      showToast(`成功导入 ${list.length} 个媒体资产`, 'success')
    },
    [addAsset, showToast]
  )

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) void importFiles(e.target.files)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files?.length) {
      void importFiles(e.dataTransfer.files)
    }
  }

  const handleAddToTimeline = (asset: Asset) => {
    const nextTracks = appendAssetToTracks(tracks, asset, () => `clip-${Date.now()}`)
    const changed = nextTracks !== tracks && nextTracks.some((track, i) => track !== tracks[i])
    if (!changed) return
    setTracks(nextTracks)
    showToast(`已将 ${asset.name} 添加至时间轴`, 'success')
  }

  const handleCreateActor = async () => {
    const accessToken = getAccessToken().trim()
    const actorValidation = validateActorCreateInput(actorName, actorRefImage, accessToken)
    if (actorValidation) {
      showToast(actorValidation, 'info')
      return
    }

    setIsActorCreating(true)
    try {
      const response = await fetch(`${resolveApiBase()}/api/ai/actors`, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ...buildActorCreatePayload(actorName, actorRefImage)
        })
      })
      const payload = (await response.json().catch(() => null)) as any
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || `HTTP ${response.status}`)
      }
      if (payload?.actor) {
        const actor = payload.actor as ActorProfile
        prependActor(actor)
        if (!motionActorId) setMotionActorId(actor.id)
        setActorName('')
        setActorRefImage('')
        showToast('演员已加入演员库', 'success')
      }
    } catch (e: any) {
      showToast(e.message || '创建演员失败', 'error')
    } finally {
      setIsActorCreating(false)
    }
  }

  const startMotionCapture = async () => {
    await MotionSyncManager.startCapture((data) => {
      setLatestMotionData(data)
    })
    setMotionCaptureActive(true)
    showToast('动捕流已启动（60fps）', 'success')
  }

  const stopMotionCapture = () => {
    MotionSyncManager.stopCapture()
    setMotionCaptureActive(false)
    showToast('动捕流已停止', 'info')
  }

  const syncMotionToActor = async () => {
    const accessToken = getAccessToken().trim()
    const motionValidation = validateMotionSyncInput(motionActorId, latestMotionData, accessToken)
    if (motionValidation) {
      showToast(motionValidation, motionValidation.includes('暂无') ? 'warning' : 'info')
      return
    }

    setIsMotionSyncing(true)
    try {
      const response = await fetch(`${resolveApiBase()}/api/ai/actors/motion-sync`, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          actorId: motionActorId,
          motionData: latestMotionData
        })
      })
      const payload = (await response.json().catch(() => null)) as any
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || `HTTP ${response.status}`)
      }

      if (selectedClipId) {
        const parentTrack = findParentTrackByClipId(tracks, selectedClipId)
        if (parentTrack) {
          const existingData = parentTrack.clips.find((clip) => clip.id === selectedClipId)
            ?.data as Record<string, unknown> | undefined
          updateClip(parentTrack.id, selectedClipId, {
            data: buildMotionSyncPatch(existingData, motionActorId, latestMotionData, Date.now())
          })
        }
      }

      showToast(`动捕已同步到演员：${payload?.actorName || motionActorId}`, 'success')
    } catch (e: any) {
      showToast(e.message || '动捕同步失败', 'error')
    } finally {
      setIsMotionSyncing(false)
    }
  }

  const filteredAssets = filterAssetsByQueryAndCategory(assets, searchQuery, activeCategory)

  return (
    <div className="pro-asset-panel">
      <input
        type="file"
        id="asset-upload-files"
        name="assetUploadFiles"
        aria-label="导入素材文件"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        accept="video/*,audio/*"
        style={{ display: 'none' }}
      />

      {mode === 'assets' ? (
        <>
          <div className="asset-header-actions">
            <div className="asset-search-bar">
              <span className="search-icon">🔍</span>
              <input
                id="asset-search-input"
                name="assetSearch"
                aria-label="搜索素材"
                type="text"
                placeholder="搜索或导入素材..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              id="btn-import"
              className="import-btn-pro"
              onClick={handleImportClick}
              data-testid="btn-import-assets"
            >
              <span>➕</span> 导入
            </button>
          </div>

          <div className="asset-categories">
            {['all', 'video', 'audio'].map((cat) => (
              <button
                key={cat}
                className={`cat-btn ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat as any)}
              >
                {cat === 'all' ? '全部' : cat === 'video' ? '视频' : '音频'}
              </button>
            ))}
          </div>

          <div className="pro-asset-grid">
            {filteredAssets.length > 0 ? (
              filteredAssets.map((asset) => (
                <div key={asset.id} className={`asset-tile ${asset.type}`}>
                  <div className="tile-preview">
                    {asset.type === 'video' ? '🎬' : '🎵'}
                    <div className="tile-actions">
                      <button onClick={() => handleAddToTimeline(asset)}>➕</button>
                    </div>
                  </div>
                  <div className="tile-footer">
                    <span className="tile-name">{asset.name}</span>
                    <span className="tile-duration">本地资产</span>
                  </div>
                </div>
              ))
            ) : (
              <div
                className="pro-empty-state-v2"
                onClick={handleImportClick}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <div className="empty-icon">📁</div>
                <p>暂无媒体素材</p>
                <span>点击此处或拖拽文件进行导入</span>
              </div>
            )}
          </div>
        </>
      ) : mode === 'director' ? (
        <div className="director-hub">
          <div className="hub-section">
            <h4 className="section-label">脚本分析反馈</h4>
            <div className="analysis-card">
              <span className="status-tag">实时在线</span>
              <p className="analysis-text">
                输入完整脚本后点击“生成分镜”，系统会自动分析并编排到时间轴。
              </p>
            </div>
          </div>

          <div className="hub-section hub-section-tight">
            <textarea
              name="directorPrompt"
              className="pro-textarea-mini"
              placeholder="输入脚本，例如：清晨街道上，主角从咖啡店走出..."
              value={directorPrompt}
              onChange={(e) => onDirectorPromptChange?.(e.target.value)}
              data-testid="input-director-prompt"
            />
            <button
              id="btn-run-director"
              className="import-btn-pro hub-primary-btn"
              onClick={() => onRunDirector?.()}
              disabled={isAiWorking}
              data-testid="btn-run-director"
            >
              {isAiWorking ? '分析中...' : '生成分镜并编排'}
            </button>
          </div>

          <div className="hub-section hub-section-loose">
            <h4 className="section-label">分镜流</h4>
            <div className="scene-card-list">
              {(directorScenes.length ? directorScenes : [{ title: '等待生成', duration: 0 }]).map(
                (scene, idx) => (
                  <div className="scene-card" key={`${scene.title || 'scene'}-${idx}`}>
                    <div className="scene-index">{idx + 1}</div>
                    <div className="scene-info">
                      <div className="scene-title">{scene.title || '未命名分镜'}</div>
                      <div className="scene-meta">{scene.duration || 0}s</div>
                    </div>
                    <button
                      className="scene-add-btn"
                      onClick={() =>
                        scene.videoPrompt && onDirectorPromptChange?.(scene.videoPrompt)
                      }
                    >
                      填入提示词
                    </button>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      ) : mode === 'actors' ? (
        <div className="director-hub">
          <div className="hub-section">
            <h4 className="section-label">演员库管理</h4>
            <div className="analysis-card">
              <span className="status-tag">一致性引擎</span>
              <p className="analysis-text">
                新增角色后，可在属性面板锁定角色一致性并启用口型同步。
              </p>
            </div>
          </div>

          <div className="hub-section hub-section-tight">
            <input
              name="actorName"
              className="pro-textarea-mini actor-input"
              placeholder="演员名称，例如：都市女主角"
              value={actorName}
              onChange={(e) => setActorName(e.target.value)}
            />
            <input
              name="actorRefImage"
              className="pro-textarea-mini actor-input actor-input-spaced"
              placeholder="参考图 URL，例如：https://..."
              value={actorRefImage}
              onChange={(e) => setActorRefImage(e.target.value)}
            />
            <button
              className="import-btn-pro hub-primary-btn"
              onClick={handleCreateActor}
              disabled={isActorLoading || isActorCreating}
            >
              {isActorCreating ? '提交中...' : isActorLoading ? '加载中...' : '新增演员'}
            </button>
          </div>

          <div className="hub-section hub-section-loose">
            <h4 className="section-label">演员列表</h4>
            <div className="scene-card-list">
              {(actors.length
                ? actors
                : [{ id: 'empty', name: '暂无演员', refImage: '-', createdAt: '-' }]
              ).map((actor, idx) => (
                <div className="scene-card" key={`${actor.id}-${idx}`}>
                  <div className="scene-index">{idx + 1}</div>
                  <div className="scene-info">
                    <div className="scene-title">{actor.name}</div>
                    <div className="scene-meta">{actor.refImage}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="director-hub">
          <div className="hub-section">
            <h4 className="section-label">动作捕捉实验室</h4>
            <div className="analysis-card">
              <span className="status-tag">{isMotionCaptureActive ? '采集中' : '待启动'}</span>
              <p className="analysis-text">
                可将实时骨架数据同步至演员一致性驱动，并用于空间预览场景。
              </p>
            </div>
          </div>

          <div className="hub-section hub-section-tight">
            <div className="motion-controls">
              <button
                className="import-btn-pro motion-btn"
                onClick={isMotionCaptureActive ? stopMotionCapture : startMotionCapture}
              >
                {isMotionCaptureActive ? '停止动捕' : '启动动捕'}
              </button>
              <button
                className="import-btn-pro motion-btn"
                disabled={isMotionSyncing}
                onClick={syncMotionToActor}
              >
                {isMotionSyncing ? '同步中...' : '同步至演员'}
              </button>
              <select
                name="motionActorId"
                className="pro-select-mini motion-actor-select"
                value={motionActorId}
                onChange={(e) => setMotionActorId(e.target.value)}
              >
                <option value="">选择演员</option>
                {actors.map((actor) => (
                  <option key={actor.id} value={actor.id}>
                    {actor.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="hub-section hub-section-loose">
            <h4 className="section-label">实时姿态摘要</h4>
            <div className="scene-card-list">
              <div className="scene-card">
                <div className="scene-index">P</div>
                <div className="scene-info">
                  <div className="scene-title">骨架关键点</div>
                  <div className="scene-meta">{latestMotionData?.pose?.length ?? 0} points</div>
                </div>
              </div>
              <div className="scene-card">
                <div className="scene-index">F</div>
                <div className="scene-info">
                  <div className="scene-title">面部表情</div>
                  <div className="scene-meta">
                    {latestMotionData?.face?.expression || 'N/A'} /{' '}
                    {latestMotionData?.face?.intensity ?? 0}
                  </div>
                </div>
              </div>
              <div className="scene-card">
                <div className="scene-index">T</div>
                <div className="scene-info">
                  <div className="scene-title">采样时间</div>
                  <div className="scene-meta">
                    {latestMotionData?.timestamp
                      ? new Date(latestMotionData.timestamp).toLocaleTimeString()
                      : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AssetPanel
