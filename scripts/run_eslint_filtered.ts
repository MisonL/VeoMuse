import { ESLint } from 'eslint'

const KNOWN_BASELINE_WARNING =
  '[baseline-browser-mapping] The data in this module is over two months old.'

const args = process.argv.slice(2)
const targets = args.length > 0 ? args : ['.']

const stringifyArg = (value: unknown) => {
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.message
  if (value === null || value === undefined) return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const originalWarn = console.warn.bind(console)
console.warn = (...warnArgs: unknown[]) => {
  const message = warnArgs.map((item) => stringifyArg(item)).join(' ')
  if (message.includes(KNOWN_BASELINE_WARNING)) return
  originalWarn(...warnArgs)
}

const run = async () => {
  const eslint = new ESLint({
    cwd: process.cwd(),
    errorOnUnmatchedPattern: false
  })

  const results = await eslint.lintFiles(targets)
  const formatter = await eslint.loadFormatter('stylish')
  const output = formatter.format(results)

  if (output) {
    process.stdout.write(output.endsWith('\n') ? output : `${output}\n`)
  }

  const errorCount = results.reduce((total, current) => total + current.errorCount, 0)
  const fatalCount = results.reduce((total, current) => total + current.fatalErrorCount, 0)

  process.exit(errorCount + fatalCount > 0 ? 1 : 0)
}

await run()
