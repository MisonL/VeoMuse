import { buildRealE2EPrecheckMessage, resolveRealE2EPrecheckMissingEnv } from './release_gate'

interface RealE2EPrecheckResult {
  ok: boolean
  missingEnv: string[]
  message: string
}

export const runRealE2EPrecheck = (env: NodeJS.ProcessEnv): RealE2EPrecheckResult => {
  const missingEnv = resolveRealE2EPrecheckMissingEnv(env)
  if (missingEnv.length > 0) {
    return {
      ok: false,
      missingEnv,
      message: buildRealE2EPrecheckMessage(missingEnv)
    }
  }

  return {
    ok: true,
    missingEnv: [],
    message: '真实回归凭据预检通过。'
  }
}

if (import.meta.main) {
  const result = runRealE2EPrecheck(process.env)
  if (!result.ok) {
    console.error(`[real-e2e-precheck] failed: ${result.message}`)
    process.exit(1)
  }

  console.log(`[real-e2e-precheck] passed: ${result.message}`)
}
