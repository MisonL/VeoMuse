import fs from 'fs'
import path from 'path'

interface Finding {
  file: string
  line: number
  rule: string
  snippet: string
}

const MAX_FILE_BYTES = 2 * 1024 * 1024

const rules: Array<{ id: string; pattern: RegExp }> = [
  { id: 'openai-api-key', pattern: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { id: 'aws-access-key-id', pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { id: 'github-pat', pattern: /\bghp_[A-Za-z0-9]{36}\b/g },
  { id: 'slack-token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { id: 'private-key', pattern: /-----BEGIN (RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY-----/g },
  {
    id: 'weak-password-pattern',
    pattern: /\bpassw(?:0)rd(?:[!@#$%^&*0-9][A-Za-z0-9!@#$%^&*()_+\-=[\]{};:,.<>/?]{0,24})?\b/gi
  },
  {
    id: 'suspicious-assignment',
    pattern: /\b(api[_-]?key|token|secret|password)\b\s*[:=]\s*['"][^'"\r\n]{10,}['"]/gi
  }
]

const allowRegexes: RegExp[] = [
  /replace-with-strong-password/i,
  /veomuse-redis-change-me/i,
  /your[_-]?(key|token|secret|password)/i,
  /mock[-_a-z0-9]*/i,
  /unit[-_a-z0-9]*/i,
  /test[-_a-z0-9]*/i,
  /example/i,
  /demo/i,
  /stress-key/i,
  /org-level-key/i,
  /org-b-only-key/i,
  /workspace-key/i,
  /org-openai-compatible-key/i,
  /workspace-openai-compatible-key/i
]

const args = new Set(process.argv.slice(2))
const stagedOnly = args.has('--staged')

const runGit = (gitArgs: string[]) => {
  const proc = Bun.spawnSync(['git', ...gitArgs], {
    stdout: 'pipe',
    stderr: 'pipe'
  })
  if (proc.exitCode !== 0) {
    const errorText =
      Buffer.from(proc.stderr).toString('utf8').trim() || `git ${gitArgs.join(' ')} failed`
    throw new Error(errorText)
  }
  return Buffer.from(proc.stdout).toString('utf8')
}

const listTargetFiles = () => {
  const raw = stagedOnly
    ? runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMR'])
    : runGit(['ls-files'])
  return raw
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

const isLikelyBinary = (content: string) => content.includes('\u0000')

const shouldAllow = (matched: string, lineText: string, file: string) => {
  if (file.endsWith('.md')) return true
  if (lineText.includes('process.env.')) return true
  return allowRegexes.some((regex) => regex.test(matched) || regex.test(lineText))
}

const scanFile = (filePath: string) => {
  const absolute = path.resolve(filePath)
  if (!fs.existsSync(absolute)) return [] as Finding[]
  const stat = fs.statSync(absolute)
  if (!stat.isFile()) return [] as Finding[]
  if (stat.size > MAX_FILE_BYTES) return [] as Finding[]

  const content = fs.readFileSync(absolute, 'utf8')
  if (isLikelyBinary(content)) return [] as Finding[]

  const findings: Finding[] = []
  const lines = content.split(/\r?\n/)
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]
    for (const rule of rules) {
      rule.pattern.lastIndex = 0
      let matched: RegExpExecArray | null
      while ((matched = rule.pattern.exec(line)) !== null) {
        const token = matched[0]
        if (shouldAllow(token, line, filePath)) continue
        findings.push({
          file: filePath,
          line: lineIndex + 1,
          rule: rule.id,
          snippet: line.trim().slice(0, 180)
        })
      }
    }
  }
  return findings
}

try {
  const files = listTargetFiles()
  const findings = files.flatMap(scanFile)

  if (findings.length === 0) {
    console.log(`[security] secrets guard passed (${stagedOnly ? 'staged' : 'repo'})`)
    process.exit(0)
  }

  console.error(`[security] detected ${findings.length} potential secret(s):`)
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} [${finding.rule}] ${finding.snippet}`)
  }
  console.error('[security] push blocked. Please remove secrets or move them to env variables.')
  process.exit(1)
} catch (error: any) {
  console.error(`[security] scan failed: ${error?.message || 'unknown error'}`)
  process.exit(2)
}
