export const ASPECT_RATIO_16_9 = 16 / 9

export const clamp = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return min
  return Math.min(Math.max(value, min), max)
}

export const calcAspectFit = (containerWidth: number, containerHeight: number, ratio = ASPECT_RATIO_16_9) => {
  if (!Number.isFinite(containerWidth) || !Number.isFinite(containerHeight) || containerWidth <= 0 || containerHeight <= 0) {
    return { width: 0, height: 0 }
  }

  if (!Number.isFinite(ratio) || ratio <= 0) {
    return { width: 0, height: 0 }
  }

  const containerRatio = containerWidth / containerHeight

  if (containerRatio > ratio) {
    const height = containerHeight
    return { width: Math.round(height * ratio), height: Math.round(height) }
  }

  const width = containerWidth
  return { width: Math.round(width), height: Math.round(width / ratio) }
}
