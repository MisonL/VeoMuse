const isLikelyDynamicSegment = (segment: string) => {
  if (!segment) return false
  if (/^\d+$/.test(segment)) return true
  if (/^[a-f0-9]{8,}$/i.test(segment)) return true
  if (/^[a-f0-9-]{16,}$/i.test(segment)) return true
  if (
    /^(ws|prj|project|policy|scene|run|invite|member|audit|dbr|org|user)_[a-z0-9_-]+$/i.test(
      segment
    )
  )
    return true
  if (/^[A-Za-z0-9_-]{20,}$/.test(segment)) return true
  return false
}

export const normalizeRoutePath = (pathname: string) => {
  const cleaned = pathname.trim()
  if (!cleaned) return '/'
  return cleaned
    .split('/')
    .map((segment, index) => {
      if (index === 0 || !segment) return segment
      return isLikelyDynamicSegment(segment) ? ':id' : segment
    })
    .join('/')
}

export const resolveMetricCategory = (pathname: string) => {
  if (!pathname.startsWith('/api/')) return 'system' as const
  if (pathname === '/api/health') return 'system' as const
  if (pathname.startsWith('/api/admin/')) return 'system' as const
  if (pathname.startsWith('/api/telemetry/')) return 'system' as const
  if (
    pathname.startsWith('/api/ai/') ||
    pathname === '/api/video/generate' ||
    pathname.startsWith('/api/video/generations') ||
    pathname === '/api/video/compose' ||
    pathname === '/api/models/recommend'
  ) {
    return 'ai' as const
  }
  return 'non_ai' as const
}

export const resolveStatusCode = (status: number | string | undefined) => {
  if (typeof status === 'number' && Number.isFinite(status)) return status
  if (typeof status === 'string') {
    const parsed = Number.parseInt(status, 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return 200
}
