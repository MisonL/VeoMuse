import type { Asset, Track } from '../../store/editorStore'

export type AssetCategory = 'all' | 'video' | 'audio'

export const extractBase64Payload = (dataUrl: string) =>
  dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl

export const resolveAssetTypeByMime = (mime: string): Asset['type'] =>
  mime.startsWith('video') ? 'video' : 'audio'

export const createImportedAsset = (
  file: Pick<File, 'name' | 'type'>,
  src: string,
  exportSrc = '',
  idFactory: () => string
): Asset => ({
  id: idFactory(),
  name: file.name,
  type: resolveAssetTypeByMime(file.type || ''),
  src,
  exportSrc
})

export const filterAssetsByQueryAndCategory = (
  assets: Asset[],
  searchQuery: string,
  activeCategory: AssetCategory
) => {
  const keyword = searchQuery.toLowerCase().trim()
  return assets.filter((asset) => {
    const matchesSearch = asset.name.toLowerCase().includes(keyword)
    const matchesCategory = activeCategory === 'all' || asset.type === activeCategory
    return matchesSearch && matchesCategory
  })
}

export const appendAssetToTracks = (
  tracks: Track[],
  asset: Asset,
  clipIdFactory: () => string
): Track[] => {
  const targetTrackId = asset.type === 'video' ? 'track-v1' : 'track-a1'
  let inserted = false
  const nextTracks = tracks.map((track) => {
    if (track.id !== targetTrackId) return track
    const start = track.clips.length > 0 ? track.clips[track.clips.length - 1].end : 0
    const nextClip = {
      id: clipIdFactory(),
      start,
      end: start + 5,
      src: asset.src,
      name: asset.name,
      type: asset.type as 'video' | 'audio',
      data: asset.exportSrc ? { exportSrc: asset.exportSrc } : undefined
    }
    inserted = true
    return {
      ...track,
      clips: [...track.clips, nextClip]
    }
  })
  return inserted ? nextTracks : tracks
}

export const validateActorCreateInput = (
  actorName: string,
  actorRefImage: string,
  accessToken: string
): string | null => {
  if (!actorName.trim() || !actorRefImage.trim()) {
    return '请填写演员名称和参考图 URL'
  }
  if (!accessToken.trim()) {
    return '请先登录后再创建演员'
  }
  return null
}

export const buildActorCreatePayload = (actorName: string, actorRefImage: string) => ({
  name: actorName.trim(),
  refImage: actorRefImage.trim()
})

export const validateMotionSyncInput = (
  motionActorId: string,
  latestMotionData: unknown,
  accessToken: string
): string | null => {
  if (!motionActorId.trim()) return '请选择演员后再同步'
  if (!latestMotionData) return '暂无动捕数据'
  if (!accessToken.trim()) return '请先登录后再同步动捕'
  return null
}

export const findParentTrackByClipId = (tracks: Track[], selectedClipId: string) =>
  tracks.find((track) => track.clips.some((clip) => clip.id === selectedClipId)) || null

export const buildMotionSyncPatch = (
  existingData: Record<string, unknown> | undefined,
  motionActorId: string,
  latestMotionData: unknown,
  nowMs: number
) => {
  const pose =
    latestMotionData && typeof latestMotionData === 'object'
      ? (latestMotionData as { pose?: unknown }).pose
      : undefined
  const motionPoseCount = Array.isArray(pose) ? pose.length : 0
  return {
    ...(existingData || {}),
    actorId: motionActorId,
    motionSyncedAt: nowMs,
    motionPoseCount
  }
}
