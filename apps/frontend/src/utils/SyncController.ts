// apps/frontend/src/utils/SyncController.ts

export class SyncController {
  private videoRefs = new Map<string, HTMLVideoElement>();
  private audioRefs = new Map<string, HTMLAudioElement>();

  registerVideo(id: string, el: HTMLVideoElement | null) {
    if (el) this.videoRefs.set(id, el); else this.videoRefs.delete(id);
  }

  registerAudio(id: string, el: HTMLAudioElement | null) {
    if (el) this.audioRefs.set(id, el); else this.audioRefs.delete(id);
  }

  sync(time: number, isPlaying: boolean, tracks: any[]) {
    tracks.forEach(track => {
      track.clips.forEach((clip: any) => {
        const media = track.type === 'video' 
          ? this.videoRefs.get(clip.id) 
          : this.audioRefs.get(clip.id);

        if (!media) return;

        const isInRange = time >= clip.start && time <= clip.end;

        if (isInRange) {
          if (track.type === 'video') media.style.display = 'block';
          
          const internalTime = time - clip.start;
          // 只有在误差较大时才进行硬跳转，保持流畅
          if (Math.abs(media.currentTime - internalTime) > 0.1) {
            media.currentTime = internalTime;
          }

          if (isPlaying && media.paused) {
            media.play().catch(() => {});
          } else if (!isPlaying && !media.paused) {
            media.pause();
          }
        } else {
          if (track.type === 'video') media.style.display = 'none';
          if (!media.paused) media.pause();
        }
      });
    });
  }
}

export const syncController = new SyncController();
