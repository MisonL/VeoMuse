export const shouldEnableTimelineVirtualization = (totalClipCount: number, duration: number) => (
  totalClipCount > 80 && duration >= 90
)

export const getTimelineVirtualWindow = (currentTime: number, duration: number) => ({
  windowStart: Math.max(0, currentTime - 25),
  windowEnd: Math.min(duration, currentTime + 45)
})

export interface TimelineActionLike {
  start: number
  end: number
}

export const filterTimelineActionsByWindow = <T extends TimelineActionLike>(
  actions: T[],
  windowStart: number,
  windowEnd: number
) => actions.filter(action => action.end >= windowStart && action.start <= windowEnd)
