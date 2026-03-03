// apps/frontend/src/utils/SyncController.ts

export class SyncController {
  private videoRefs = new Map<string, HTMLVideoElement>()
  private audioRefs = new Map<string, HTMLAudioElement>()
  private preloadedSet = new Set<string>() // 记录已预加载的 Clip ID
  private maxOpsPerSync = 160
  private lastSyncStats = { processed: 0, skipped: 0, preloaded: 0, seekAdjusted: 0 }

  setPerformanceBudget(maxOpsPerSync: number) {
    this.maxOpsPerSync = Math.max(20, Math.floor(maxOpsPerSync))
  }

  getPerformanceBudget() {
    return this.maxOpsPerSync
  }

  getLastSyncStats() {
    return this.lastSyncStats
  }

  registerVideo(id: string, el: HTMLVideoElement | null) {
    if (el) this.videoRefs.set(id, el)
    else {
      this.videoRefs.delete(id)
      this.preloadedSet.delete(id)
    }
  }

  registerAudio(id: string, el: HTMLAudioElement | null) {
    if (el) this.audioRefs.set(id, el)
    else {
      this.audioRefs.delete(id)
      this.preloadedSet.delete(id)
    }
  }

  clear() {
    this.videoRefs.clear()
    this.audioRefs.clear()
    this.preloadedSet.clear()
  }

  sync(time: number, isPlaying: boolean, tracks: any[]) {
    let processed = 0
    let skipped = 0
    let preloaded = 0
    let seekAdjusted = 0

    tracks.forEach((track) => {
      track.clips.forEach((clip: any) => {
        if (processed >= this.maxOpsPerSync) {
          skipped++
          return
        }

        const media =
          track.type === 'video' ? this.videoRefs.get(clip.id) : this.audioRefs.get(clip.id)
        if (!media) return
        processed++

        // 1. 预测性预加载逻辑 (5秒阈值)
        const timeToStart = clip.start - time
        if (timeToStart > 0 && timeToStart <= 5 && !this.preloadedSet.has(clip.id)) {
          console.log(`🚀 [Pro Preload] 预加载片段: ${clip.name || clip.id}`)
          media.load()
          this.preloadedSet.add(clip.id)
          preloaded++
        }

        // 2. 现有的同步逻辑
        const isInRange = time >= clip.start && time <= clip.end
        if (isInRange) {
          if (track.type === 'video') media.style.display = 'block'
          const internalTime = time - clip.start
          if (Math.abs(media.currentTime - internalTime) > 0.1) {
            media.currentTime = internalTime
            seekAdjusted++
          }
          if (isPlaying && media.paused) media.play().catch(() => {})
          else if (!isPlaying && !media.paused) media.pause()
        } else {
          if (track.type === 'video') media.style.display = 'none'
          if (!media.paused) media.pause()
          // 如果已经播放过了，且离得太远，可以考虑从 preloadedSet 移除以便循环使用
          if (time < clip.start - 10 || time > clip.end + 5) {
            this.preloadedSet.delete(clip.id)
          }
        }
      })
    })

    this.lastSyncStats = { processed, skipped, preloaded, seekAdjusted }
    return this.lastSyncStats
  }
}

export const syncController = new SyncController()
