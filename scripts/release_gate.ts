interface GateStep {
  name: string
  command: string
  env?: Record<string, string>
  retries?: number
}

type SloMode = 'soft' | 'hard'

const args = new Set(process.argv.slice(2))
const runRealE2E = args.has('--with-real-e2e') || process.env.RELEASE_GATE_REAL_E2E === 'true'

const parseSloMode = (value: string | undefined): SloMode | null => {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'hard' || normalized === 'soft') return normalized
  return null
}

const resolveCurrentBranch = () => {
  const refName = String(process.env.GITHUB_REF_NAME || '').trim()
  if (refName) return refName

  const ref = String(process.env.GITHUB_REF || '').trim()
  if (ref.startsWith('refs/heads/')) {
    return ref.slice('refs/heads/'.length)
  }

  const result = Bun.spawnSync(['zsh', '-lc', 'git branch --show-current'], {
    cwd: process.cwd(),
    env: process.env,
    stdout: 'pipe',
    stderr: 'ignore'
  })
  if (result.exitCode === 0) {
    const branch = result.stdout.toString().trim()
    if (branch) return branch
  }
  return ''
}

const resolveSloMode = (): SloMode => {
  const explicitMode = parseSloMode(process.env.RELEASE_SLO_MODE || process.env.SLO_GATE_MODE)
  if (explicitMode) return explicitMode
  const currentBranch = resolveCurrentBranch()
  return currentBranch === 'main' ? 'hard' : 'soft'
}

const sloMode = resolveSloMode()

const steps: GateStep[] = [
  { name: 'Secrets Scan', command: 'bun run security:scan' },
  { name: 'Build', command: 'bun run build' },
  { name: 'Unit Tests', command: 'bun run test -- --max-concurrency 1' },
  { name: 'E2E Smoke', command: 'bun run e2e:smoke -- --workers=1', retries: 1 },
  { name: 'E2E Regression (Mock)', command: 'bun run e2e:regression:mock -- --workers=1', retries: 1 },
  { name: `SLO Check (${sloMode})`, command: `bun run scripts/slo_gate.ts --mode ${sloMode}` }
]

if (runRealE2E) {
  steps.push({
    name: 'E2E Regression (Real)',
    command: 'bun run e2e:regression:real -- --workers=1',
    env: { E2E_REAL_CHANNELS: 'true' }
  })
}

const runStep = async (step: GateStep) => {
  const maxAttempts = Math.max(1, (step.retries || 0) + 1)
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    console.log(`\n[release-gate] >>> ${step.name}${maxAttempts > 1 ? ` (attempt ${attempt}/${maxAttempts})` : ''}`)
    const startedAt = Date.now()
    const proc = Bun.spawn(['zsh', '-lc', step.command], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...(step.env || {})
      },
      stdout: 'inherit',
      stderr: 'inherit',
      stdin: 'inherit'
    })

    const code = await proc.exited
    const duration = Date.now() - startedAt
    if (code === 0) {
      console.log(`[release-gate] <<< ${step.name} passed (${duration}ms)`)
      return
    }

    if (attempt >= maxAttempts) {
      throw new Error(`${step.name} failed with exit code ${code} (${duration}ms)`)
    }

    console.warn(`[release-gate] ${step.name} failed (exit ${code}), retrying...`)
  }
}

const main = async () => {
  const branch = resolveCurrentBranch() || '(unknown)'
  console.log(`[release-gate] start (branch=${branch}, sloMode=${sloMode})`)
  for (const step of steps) {
    await runStep(step)
  }
  console.log('\n[release-gate] all checks passed')
}

main().catch((error: any) => {
  console.error(`\n[release-gate] failed: ${error?.message || 'unknown error'}`)
  process.exit(1)
})
