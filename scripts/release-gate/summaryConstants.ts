import type { FailureDomain } from './contracts'

export const FAILURE_DOMAIN_RULES: Array<{
  domain: Exclude<FailureDomain, 'unknown'>
  patterns: RegExp[]
}> = [
  {
    domain: 'security',
    patterns: [/\bsecurity\b/i, /\bsecret(s)?\b/i, /\bgitleaks?\b/i]
  },
  {
    domain: 'build',
    patterns: [/\bbuild\b/i, /\bcompile\b/i, /\bbundle\b/i, /\btsc\b/i]
  },
  {
    domain: 'e2e',
    patterns: [/\be2e\b/i, /\bplaywright\b/i, /\bsmoke\b/i, /\bregression\b/i]
  },
  {
    domain: 'slo',
    patterns: [/\bslo\b/i, /\/api\/health/i]
  },
  {
    domain: 'test',
    patterns: [/\bunit test(s)?\b/i, /\btest(s)?\b/i, /\bjest\b/i, /\bvitest\b/i]
  }
]

export const DOMAIN_RECOMMENDATIONS: Record<FailureDomain, string> = {
  security: '先执行 `bun run security:scan` 修复敏感信息或高危配置，再重新触发门禁。',
  build: '先本地执行 `bun run build` 修复编译或打包错误，再继续后续校验。',
  test: '先执行 `bun run test` 修复失败用例并补充必要断言。',
  e2e: '先按失败场景单独执行对应 E2E 命令（smoke/regression）定位根因，再重跑门禁。',
  slo: '先确认 `/api/health` 可达与 SLO 样本充足，再执行 `bun run scripts/slo_gate.ts` 校验。',
  unknown: '根据失败日志定位根因，补充可复现命令后重新执行门禁。'
}

export {
  QUALITY_TAG_REAL_E2E,
  QUALITY_TAG_VIDEO_GENERATE_LOOP,
  REAL_E2E_PRECHECK_STEP_NAME,
  REAL_E2E_STEP_NAME,
  VIDEO_GENERATE_LOOP_DEFAULT_STEP_NAME
} from './contracts'
