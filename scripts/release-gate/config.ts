import {
  DEFAULT_SLO_API_BASE,
  DEFAULT_SLO_BOOTSTRAP_TIMEOUT_MS,
  DEFAULT_SLO_HEALTH_TIMEOUT_MS,
  LOOPBACK_HOSTS,
  QUALITY_TAG_REAL_E2E,
  QUALITY_TAG_VIDEO_GENERATE_LOOP,
  REAL_E2E_PRECHECK_COMMAND,
  REAL_E2E_PRECHECK_STEP_NAME,
  REAL_E2E_STEP_NAME,
  type GateStep,
  type SloMode
} from './contracts'

const parseBoolean = (value: string | undefined) => {
  if (!value) return false
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const parseNonNegativeInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

const quoteShellArg = (value: string) => JSON.stringify(value)

const DEFAULT_REAL_E2E_REQUIRED_ENV_KEYS = ['E2E_REAL_CHANNELS', 'GEMINI_API_KEYS'] as const

export const parseSloMode = (value: string | undefined): SloMode | null => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
  if (normalized === 'hard' || normalized === 'soft') return normalized
  return null
}

export const parseArgValue = (argv: string[], flag: string) => {
  const eqPrefix = `${flag}=`
  for (let index = 0; index < argv.length; index += 1) {
    const item = String(argv[index] || '')
    if (item === flag) {
      return String(argv[index + 1] || '').trim()
    }
    if (item.startsWith(eqPrefix)) {
      return item.slice(eqPrefix.length).trim()
    }
  }
  return ''
}

export const isCiEnvironment = (env: NodeJS.ProcessEnv) => {
  return parseBoolean(env.CI) || parseBoolean(env.GITHUB_ACTIONS)
}

export const resolveSloMode = (params: {
  env: NodeJS.ProcessEnv
  currentBranch: string
  isCi: boolean
}): SloMode => {
  const explicitMode = parseSloMode(params.env.RELEASE_SLO_MODE || params.env.SLO_GATE_MODE)
  if (explicitMode) return explicitMode
  if (params.isCi) {
    return params.currentBranch === 'main' ? 'hard' : 'soft'
  }
  return 'soft'
}

export const resolveSloApiBase = (params: { argv: string[]; env: NodeJS.ProcessEnv }) => {
  const raw =
    parseArgValue(params.argv, '--api-base') ||
    params.env.SLO_GATE_API_BASE ||
    params.env.API_BASE_URL ||
    DEFAULT_SLO_API_BASE
  return raw.trim().replace(/\/+$/, '')
}

export const isLocalSloApiBase = (apiBase: string) => {
  try {
    const url = new URL(apiBase)
    return LOOPBACK_HOSTS.has(url.hostname.trim().toLowerCase())
  } catch {
    return false
  }
}

export const resolveSloBootstrapEnabled = (params: {
  env: NodeJS.ProcessEnv
  isCi: boolean
  apiBase: string
}) => {
  const raw = String(params.env.RELEASE_GATE_SLO_BOOTSTRAP || '').trim()
  if (raw) return parseBoolean(raw)
  if (params.isCi) return false
  return isLocalSloApiBase(params.apiBase)
}

export const resolveSloBootstrapTimeoutMs = (env: NodeJS.ProcessEnv) =>
  parsePositiveInt(env.RELEASE_GATE_SLO_BOOTSTRAP_TIMEOUT_MS, DEFAULT_SLO_BOOTSTRAP_TIMEOUT_MS)

export const resolveSloHealthTimeoutMs = (env: NodeJS.ProcessEnv) =>
  parsePositiveInt(env.RELEASE_GATE_SLO_HEALTH_TIMEOUT_MS, DEFAULT_SLO_HEALTH_TIMEOUT_MS)

export const buildSloGateCommand = (mode: SloMode, apiBase: string) => {
  return `bun run scripts/slo_gate.ts --mode ${mode} --api-base ${quoteShellArg(apiBase)}`
}

export const resolveRealE2ERequiredEnvKeys = (env: NodeJS.ProcessEnv) => {
  const extraKeys = String(env.E2E_REAL_REQUIRED_ENV_KEYS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return [...new Set([...DEFAULT_REAL_E2E_REQUIRED_ENV_KEYS, ...extraKeys])]
}

export const resolveRealE2EPrecheckMissingEnv = (env: NodeJS.ProcessEnv): ReadonlyArray<string> => {
  return resolveRealE2ERequiredEnvKeys(env).filter((key) => {
    const value = String(env[key] || '').trim()
    if (key === 'E2E_REAL_CHANNELS') {
      return value.toLowerCase() !== 'true'
    }
    return !value
  })
}

export const buildRealE2EPrecheckMessage = (missingEnv: ReadonlyArray<string>) => {
  if (!missingEnv.length) return ''
  const labels = missingEnv.map((key) =>
    key === 'E2E_REAL_CHANNELS' ? 'E2E_REAL_CHANNELS=true' : key
  )
  return `缺少真实回归必需环境变量：${labels.join(', ')}。请配置后重试，或移除 --with-real-e2e。`
}

export const resolveSloCheckRetries = (params: { argv: string[]; env: NodeJS.ProcessEnv }) => {
  const raw = parseArgValue(params.argv, '--slo-retries') || params.env.RELEASE_GATE_SLO_RETRIES
  return parseNonNegativeInt(raw, 1)
}

export const createSteps = (params: {
  sloMode: SloMode
  runRealE2E: boolean
  sloApiBase: string
  sloCheckRetries: number
}) => {
  const steps: GateStep[] = [
    {
      name: 'Secrets Scan',
      command: 'bun run security:scan',
      commandArgs: ['bun', 'run', 'security:scan']
    },
    { name: 'Build', command: 'bun run build', commandArgs: ['bun', 'run', 'build'] },
    {
      name: 'Unit Tests',
      command: 'bun run test',
      commandArgs: ['bun', 'run', 'test'],
      env: { NODE_ENV: 'test' }
    },
    {
      name: 'E2E Smoke',
      command: 'bun run e2e:smoke -- --workers=1',
      commandArgs: ['bun', 'run', 'e2e:smoke', '--', '--workers=1'],
      retries: 1
    },
    {
      name: 'E2E Regression',
      command: 'bun run e2e:regression -- --workers=1',
      commandArgs: ['bun', 'run', 'e2e:regression', '--', '--workers=1'],
      retries: 1,
      qualityTags: [QUALITY_TAG_VIDEO_GENERATE_LOOP]
    },
    {
      name: `SLO Check (${params.sloMode})`,
      command: buildSloGateCommand(params.sloMode, params.sloApiBase),
      commandArgs: [
        'bun',
        'run',
        'scripts/slo_gate.ts',
        '--mode',
        params.sloMode,
        '--api-base',
        params.sloApiBase
      ],
      retries: params.sloCheckRetries
    }
  ]

  if (params.runRealE2E) {
    steps.push({
      name: REAL_E2E_STEP_NAME,
      command: 'bun run e2e:regression:real -- --workers=1',
      commandArgs: ['bun', 'run', 'e2e:regression:real', '--', '--workers=1'],
      env: { E2E_REAL_CHANNELS: 'true' },
      outputCheck: 'require_real_e2e_executed',
      qualityTags: [QUALITY_TAG_REAL_E2E]
    })
  }

  return steps
}

export {
  REAL_E2E_PRECHECK_COMMAND,
  REAL_E2E_PRECHECK_STEP_NAME,
  REAL_E2E_STEP_NAME,
  QUALITY_TAG_REAL_E2E,
  QUALITY_TAG_VIDEO_GENERATE_LOOP
}
