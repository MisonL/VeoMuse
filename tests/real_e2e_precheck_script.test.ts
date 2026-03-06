import { describe, expect, it } from 'bun:test'
import { runRealE2EPrecheck } from '../scripts/real_e2e_precheck'

const envOf = (input: Record<string, string | undefined>) => input as NodeJS.ProcessEnv

describe('真实回归预检脚本', () => {
  it('缺少 GEMINI_API_KEYS 时应返回失败结果', () => {
    const result = runRealE2EPrecheck(envOf({}))

    expect(result.ok).toBe(false)
    expect(result.missingEnv).toContain('GEMINI_API_KEYS')
    expect(result.message).toContain('缺少真实回归必需环境变量')
  })

  it('配置 GEMINI_API_KEYS 时应返回通过结果', () => {
    const result = runRealE2EPrecheck(
      envOf({
        GEMINI_API_KEYS: 'key-a,key-b'
      })
    )

    expect(result.ok).toBe(true)
    expect(result.missingEnv.length).toBe(0)
    expect(result.message).toBe('真实回归凭据预检通过。')
  })

  it('可通过 E2E_REAL_REQUIRED_ENV_KEYS 扩展额外凭据检查', () => {
    const missingExtra = runRealE2EPrecheck(
      envOf({
        GEMINI_API_KEYS: 'key-a',
        E2E_REAL_REQUIRED_ENV_KEYS: 'OPENAI_API_KEY, OPENAI_BASE_URL'
      })
    )

    expect(missingExtra.ok).toBe(false)
    expect(missingExtra.missingEnv).toEqual(['OPENAI_API_KEY', 'OPENAI_BASE_URL'])

    const ready = runRealE2EPrecheck(
      envOf({
        GEMINI_API_KEYS: 'key-a',
        E2E_REAL_REQUIRED_ENV_KEYS: 'OPENAI_API_KEY,OPENAI_BASE_URL',
        OPENAI_API_KEY: 'openai-key',
        OPENAI_BASE_URL: 'https://api.openai.local'
      })
    )

    expect(ready.ok).toBe(true)
    expect(ready.missingEnv.length).toBe(0)
  })
})
