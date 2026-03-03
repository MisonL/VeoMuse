import { describe, expect, it } from 'bun:test'
import type { Asset, Track } from '../apps/frontend/src/store/editorStore'
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
} from '../apps/frontend/src/components/Editor/assetPanel.logic'

describe('AssetPanel 纯逻辑', () => {
  it('extractBase64Payload 应兼容 dataUrl 与纯 base64', () => {
    expect(extractBase64Payload('data:text/plain;base64,Zm9v')).toBe('Zm9v')
    expect(extractBase64Payload('YmFy')).toBe('YmFy')
  })

  it('createImportedAsset 应按 mime 推断资产类型', () => {
    const video = createImportedAsset(
      { name: 'a.mp4', type: 'video/mp4' } as File,
      'blob://a',
      '/tmp/a',
      () => 'id-a'
    )
    const audio = createImportedAsset(
      { name: 'b.wav', type: 'audio/wav' } as File,
      'blob://b',
      '',
      () => 'id-b'
    )
    expect(video).toEqual({
      id: 'id-a',
      name: 'a.mp4',
      type: 'video',
      src: 'blob://a',
      exportSrc: '/tmp/a'
    })
    expect(audio.type).toBe('audio')
  })

  it('filterAssetsByQueryAndCategory 应按关键词和分类过滤', () => {
    const assets: Asset[] = [
      { id: '1', name: 'city video', src: 'a', type: 'video' },
      { id: '2', name: 'voice over', src: 'b', type: 'audio' },
      { id: '3', name: 'street b-roll', src: 'c', type: 'video' }
    ]
    expect(filterAssetsByQueryAndCategory(assets, 'city', 'all').map((item) => item.id)).toEqual([
      '1'
    ])
    expect(filterAssetsByQueryAndCategory(assets, '  ', 'video').map((item) => item.id)).toEqual([
      '1',
      '3'
    ])
    expect(filterAssetsByQueryAndCategory(assets, 'voice', 'video').map((item) => item.id)).toEqual(
      []
    )
  })

  it('appendAssetToTracks 应追加到目标轨并按末尾 end 续接', () => {
    const tracks: Track[] = [
      {
        id: 'track-v1',
        name: 'v',
        type: 'video',
        clips: [{ id: 'c1', start: 0, end: 8, src: '', name: '', type: 'video' }]
      },
      { id: 'track-a1', name: 'a', type: 'audio', clips: [] }
    ]
    const next = appendAssetToTracks(
      tracks,
      { id: 'a1', name: 'shot', src: '/shot.mp4', exportSrc: '/export/shot.mp4', type: 'video' },
      () => 'clip-new'
    )
    expect(next[0].clips).toHaveLength(2)
    expect(next[0].clips[1]).toMatchObject({
      id: 'clip-new',
      start: 8,
      end: 13,
      src: '/shot.mp4',
      name: 'shot',
      type: 'video'
    })
    expect((next[0].clips[1] as any).data).toEqual({ exportSrc: '/export/shot.mp4' })
  })

  it('appendAssetToTracks 在无目标轨时应保持引用不变', () => {
    const tracks: Track[] = [{ id: 'track-t1', name: 't', type: 'text', clips: [] }]
    const next = appendAssetToTracks(
      tracks,
      { id: 'a2', name: 'voice', src: '/v.wav', type: 'audio' },
      () => 'clip-audio'
    )
    expect(next[0]).toBe(tracks[0])
  })

  it('validateActorCreateInput 与 buildActorCreatePayload 应返回稳定结果', () => {
    expect(validateActorCreateInput('', 'https://x', 'token')).toBe('请填写演员名称和参考图 URL')
    expect(validateActorCreateInput('hero', '', 'token')).toBe('请填写演员名称和参考图 URL')
    expect(validateActorCreateInput('hero', 'https://x', '')).toBe('请先登录后再创建演员')
    expect(validateActorCreateInput(' hero ', ' https://x ', 'token')).toBeNull()
    expect(buildActorCreatePayload(' hero ', ' https://x ')).toEqual({
      name: 'hero',
      refImage: 'https://x'
    })
  })

  it('validateMotionSyncInput 与动捕 patch 构建应覆盖边界', () => {
    expect(validateMotionSyncInput('', { pose: [] }, 'token')).toBe('请选择演员后再同步')
    expect(validateMotionSyncInput('actor-1', null, 'token')).toBe('暂无动捕数据')
    expect(validateMotionSyncInput('actor-1', { pose: [] }, '')).toBe('请先登录后再同步动捕')
    expect(validateMotionSyncInput('actor-1', { pose: [1, 2] }, 'token')).toBeNull()

    expect(buildMotionSyncPatch({ old: true }, 'actor-1', { pose: [1, 2, 3] }, 123456)).toEqual({
      old: true,
      actorId: 'actor-1',
      motionSyncedAt: 123456,
      motionPoseCount: 3
    })
  })

  it('findParentTrackByClipId 应返回命中轨道或 null', () => {
    const tracks: Track[] = [
      {
        id: 'track-v1',
        name: 'v',
        type: 'video',
        clips: [{ id: 'c1', start: 0, end: 3, src: '', name: '', type: 'video' }]
      },
      { id: 'track-a1', name: 'a', type: 'audio', clips: [] }
    ]
    expect(findParentTrackByClipId(tracks, 'c1')?.id).toBe('track-v1')
    expect(findParentTrackByClipId(tracks, 'missing')).toBeNull()
  })
})
