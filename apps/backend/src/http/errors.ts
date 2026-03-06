export const readErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (!error || typeof error !== 'object') return ''
  const candidate = error as { message?: unknown }
  return typeof candidate.message === 'string' ? candidate.message : ''
}

export const resolveErrorMessage = (error: unknown, fallback: string) => {
  const message = readErrorMessage(error)
  return message || fallback
}
