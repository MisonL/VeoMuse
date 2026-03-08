import { useCallback, useMemo, useRef, useState } from 'react'
import { requestJson } from '../api'
import type { LabAssetOption, LabMode, ModelOption, ModelRecommendation } from '../types'

type ShowToast = (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void

interface AssetLike extends LabAssetOption {
  type?: string
}

interface UseCompareModeManagerParams {
  allAssets: AssetLike[]
  labMode: LabMode
  syncPlayback: boolean
  showToast: ShowToast
}

export const useCompareModeManager = ({
  allAssets,
  labMode,
  syncPlayback,
  showToast
}: UseCompareModeManagerParams) => {
  const [leftAssetId, setLeftAssetId] = useState('')
  const [rightAssetId, setRightAssetId] = useState('')
  const [leftModel, setLeftModel] = useState('veo-3.1')
  const [rightModel, setRightModel] = useState('kling-v1')
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([])

  const leftVideoRef = useRef<HTMLVideoElement | null>(null)
  const rightVideoRef = useRef<HTMLVideoElement | null>(null)

  const assets = useMemo(
    () => allAssets.filter((asset): asset is LabAssetOption => asset.type === 'video'),
    [allAssets]
  )
  const resolvedLeftAssetId = useMemo(() => {
    if (leftAssetId && assets.some((asset) => asset.id === leftAssetId)) return leftAssetId
    return assets[0]?.id || ''
  }, [assets, leftAssetId])
  const resolvedRightAssetId = useMemo(() => {
    if (rightAssetId && assets.some((asset) => asset.id === rightAssetId)) return rightAssetId
    const fallback = assets.find((asset) => asset.id !== resolvedLeftAssetId) || assets[0]
    return fallback?.id || ''
  }, [assets, resolvedLeftAssetId, rightAssetId])
  const leftAsset = useMemo(
    () => assets.find((asset) => asset.id === resolvedLeftAssetId),
    [assets, resolvedLeftAssetId]
  )
  const rightAsset = useMemo(
    () => assets.find((asset) => asset.id === resolvedRightAssetId),
    [assets, resolvedRightAssetId]
  )

  const exportReport = useCallback(async () => {
    try {
      const resolveModelName = (id: string) =>
        availableModels.find((item) => item.id === id)?.name || id
      const report = {
        timestamp: new Date().toISOString(),
        mode: labMode,
        left: {
          modelId: leftModel,
          modelName: resolveModelName(leftModel),
          assetName: leftAsset?.name || null
        },
        right: {
          modelId: rightModel,
          modelName: resolveModelName(rightModel),
          assetName: rightAsset?.name || null
        },
        syncPlayback
      }
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `comparison-report-${Date.now()}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      showToast('对比报告已导出', 'success')
    } catch (error: unknown) {
      const normalized = error instanceof Error ? error : new Error(String(error))
      showToast(normalized.message || '导出视频失败', 'error')
    }
  }, [
    availableModels,
    labMode,
    leftAsset,
    leftModel,
    rightAsset,
    rightModel,
    showToast,
    syncPlayback
  ])

  const requestRecommendation = useCallback(
    async (side: 'left' | 'right') => {
      const prompt = side === 'left' ? leftAsset?.name : rightAsset?.name
      if (!prompt) {
        showToast('请先选择对比素材', 'info')
        return
      }

      let payload: ModelRecommendation
      try {
        payload = await requestJson<ModelRecommendation>('/api/models/recommend', {
          method: 'POST',
          body: JSON.stringify({ prompt })
        })
      } catch (error: unknown) {
        const normalized = error instanceof Error ? error : new Error(String(error))
        showToast(normalized.message || '推荐模型失败', 'error')
        return
      }

      if (!payload?.recommendedModelId) return
      if (side === 'left') setLeftModel(payload.recommendedModelId)
      else setRightModel(payload.recommendedModelId)
      showToast(
        `${side === 'left' ? '左侧' : '右侧'}推荐模型: ${payload.recommendedModelId}`,
        'success'
      )
    },
    [leftAsset, rightAsset, showToast]
  )

  return {
    leftAssetId: resolvedLeftAssetId,
    rightAssetId: resolvedRightAssetId,
    leftModel,
    rightModel,
    availableModels,
    assets,
    leftAsset,
    rightAsset,
    leftVideoRef,
    rightVideoRef,
    setLeftAssetId,
    setRightAssetId,
    setLeftModel,
    setRightModel,
    setAvailableModels,
    exportReport,
    requestRecommendation
  }
}
