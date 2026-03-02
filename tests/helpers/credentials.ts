const normalizeSeed = (seed: string) => {
  const compact = seed.replace(/[^a-zA-Z0-9]/g, '')
  if (compact.length >= 12) return compact.slice(-12)
  return compact.padEnd(12, 'x')
}

export const buildTestPassword = (seed?: string) => {
  const source = seed || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const suffix = normalizeSeed(source)
  return `Vm${suffix}#Q9a`
}
