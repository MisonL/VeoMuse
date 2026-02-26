// apps/frontend/src/utils/SyncController.ts

export class SyncController {
  private videoRefs = new Map<string, HTMLVideoElement>();
  private audioRefs = new Map<string, HTMLAudioElement>();

  registerVideo(id: string, el: HTMLVideoElement | null) {
    if (el) this.videoRefs.set(id, el); 
    else this.videoRefs.delete(id); // 已支持解绑
  }

  registerAudio(id: string, el: HTMLAudioElement | null) {
    if (el) this.audioRefs.set(id, el); 
    else this.audioRefs.delete(id); // 已支持解绑
  }

  // 增加主动清理，彻底杜绝泄露
  clear() {
    this.videoRefs.clear();
    this.audioRefs.clear();
  }

  sync(time: number, isPlaying: boolean, tracks: any[]) {
    tracks.forEach(track => {
      track.clips.forEach((clip: any) => {
        const media = track.type === 'video' ? this.videoRefs.get(clip.id) : this.audioRefs.get(clip.id);
        if (!media) return;
        const isInRange = time >= clip.start && time <= clip.end;
        if (isInRange) {
          if (track.type === 'video') media.style.display = 'block';
          const internalTime = time - clip.start;
          if (Math.abs(media.currentTime - internalTime) > 0.1) media.currentTime = internalTime;
          if (isPlaying && media.paused) media.play().catch(() => {});
          else if (!isPlaying && !media.paused) media.pause();
        } else {
          if (track.type === 'video') media.style.display = 'none';
          if (!media.paused) media.pause();
        }
      });
    });
  }
}

export const syncController = new SyncController();
