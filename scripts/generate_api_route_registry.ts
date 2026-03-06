import fs from 'fs/promises'
import path from 'path'

type RouteMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options'

interface MethodCallToken {
  method: RouteMethod | 'group'
  path: string
  index: number
  openParenIndex: number
  closeParenIndex: number
}

interface GroupRange {
  prefix: string
  bodyStart: number
  bodyEnd: number
}

interface GenerateRouteRegistryInput {
  backendPath: string
  outputPath: string
}

const METHOD_CALL_PATTERN =
  /\.(group|get|post|put|patch|delete|head|options)\s*\(\s*(['"`])((?:\\.|(?!\2)[^\\])*)\2/gm
const ROUTE_METHODS = new Set<RouteMethod>([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options'
])

const DEFAULT_INPUT: GenerateRouteRegistryInput = {
  backendPath: path.resolve(process.cwd(), 'apps/backend/src/index.ts'),
  outputPath: path.resolve(process.cwd(), 'docs/api-routes.generated.json')
}

const skipQuotedString = (source: string, startIndex: number) => {
  const quote = source[startIndex]
  let index = startIndex + 1
  while (index < source.length) {
    const char = source[index]
    if (char === '\\') {
      index += 2
      continue
    }
    if (char === quote) {
      return index + 1
    }
    index += 1
  }
  return source.length
}

const skipLineComment = (source: string, startIndex: number) => {
  let index = startIndex + 2
  while (index < source.length && source[index] !== '\n') {
    index += 1
  }
  return index
}

const skipBlockComment = (source: string, startIndex: number) => {
  const endIndex = source.indexOf('*/', startIndex + 2)
  if (endIndex < 0) return source.length
  return endIndex + 2
}

const findMatchingDelimiter = (
  source: string,
  openIndex: number,
  openChar: string,
  closeChar: string
) => {
  let depth = 1
  let index = openIndex + 1
  while (index < source.length) {
    const char = source[index]
    const next = source[index + 1]

    if (char === "'" || char === '"' || char === '`') {
      index = skipQuotedString(source, index)
      continue
    }
    if (char === '/' && next === '/') {
      index = skipLineComment(source, index)
      continue
    }
    if (char === '/' && next === '*') {
      index = skipBlockComment(source, index)
      continue
    }

    if (char === openChar) {
      depth += 1
      index += 1
      continue
    }
    if (char === closeChar) {
      depth -= 1
      if (depth === 0) return index
    }
    index += 1
  }
  return -1
}

const findFirstTopLevelComma = (source: string, start: number, end: number) => {
  let parenDepth = 0
  let bracketDepth = 0
  let braceDepth = 0
  let index = start
  while (index < end) {
    const char = source[index]
    const next = source[index + 1]

    if (char === "'" || char === '"' || char === '`') {
      index = skipQuotedString(source, index)
      continue
    }
    if (char === '/' && next === '/') {
      index = skipLineComment(source, index)
      continue
    }
    if (char === '/' && next === '*') {
      index = skipBlockComment(source, index)
      continue
    }

    if (char === '(') parenDepth += 1
    else if (char === ')') parenDepth -= 1
    else if (char === '[') bracketDepth += 1
    else if (char === ']') bracketDepth -= 1
    else if (char === '{') braceDepth += 1
    else if (char === '}') braceDepth -= 1
    else if (char === ',' && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
      return index
    }
    index += 1
  }
  return -1
}

const findTopLevelArrow = (source: string, start: number, end: number) => {
  let parenDepth = 0
  let bracketDepth = 0
  let braceDepth = 0
  let index = start
  while (index < end) {
    const char = source[index]
    const next = source[index + 1]

    if (char === "'" || char === '"' || char === '`') {
      index = skipQuotedString(source, index)
      continue
    }
    if (char === '/' && next === '/') {
      index = skipLineComment(source, index)
      continue
    }
    if (char === '/' && next === '*') {
      index = skipBlockComment(source, index)
      continue
    }

    if (char === '(') parenDepth += 1
    else if (char === ')') parenDepth -= 1
    else if (char === '[') bracketDepth += 1
    else if (char === ']') bracketDepth -= 1
    else if (char === '{') braceDepth += 1
    else if (char === '}') braceDepth -= 1
    else if (
      char === '=' &&
      next === '>' &&
      parenDepth === 0 &&
      bracketDepth === 0 &&
      braceDepth === 0
    ) {
      return index
    }
    index += 1
  }
  return -1
}

const skipWhitespaces = (source: string, start: number, end: number) => {
  let index = start
  while (index < end && /\s/.test(source[index] || '')) {
    index += 1
  }
  return index
}

const normalizeRoutePath = (rawPath: string) => {
  const trimmed = String(rawPath || '').trim()
  if (!trimmed) return ''
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  const compact = withLeadingSlash.replace(/\/{2,}/g, '/')
  if (compact === '/') return compact
  return compact.replace(/\/+$/g, '')
}

const joinRoutePath = (leftPath: string, rightPath: string) => {
  const left = normalizeRoutePath(leftPath)
  const right = normalizeRoutePath(rightPath)
  if (!left) return right
  if (!right || right === '/') return left
  return normalizeRoutePath(`${left.replace(/\/+$/g, '')}/${right.replace(/^\/+/g, '')}`)
}

const parseMethodCalls = (source: string): MethodCallToken[] => {
  const tokens: MethodCallToken[] = []
  let match: RegExpExecArray | null = METHOD_CALL_PATTERN.exec(source)
  while (match) {
    const method = match[1] as MethodCallToken['method']
    const routePath = String(match[3] || '')
    if (!routePath.startsWith('/')) {
      match = METHOD_CALL_PATTERN.exec(source)
      continue
    }

    const openParenIndex = source.indexOf('(', match.index)
    if (openParenIndex < 0) {
      match = METHOD_CALL_PATTERN.exec(source)
      continue
    }

    const closeParenIndex = findMatchingDelimiter(source, openParenIndex, '(', ')')
    if (closeParenIndex < 0) {
      match = METHOD_CALL_PATTERN.exec(source)
      continue
    }

    tokens.push({
      method,
      path: normalizeRoutePath(routePath),
      index: match.index,
      openParenIndex,
      closeParenIndex
    })

    match = METHOD_CALL_PATTERN.exec(source)
  }
  return tokens
}

const extractGroupRange = (source: string, token: MethodCallToken): GroupRange | null => {
  const argsStart = token.openParenIndex + 1
  const argsEnd = token.closeParenIndex
  const commaIndex = findFirstTopLevelComma(source, argsStart, argsEnd)
  if (commaIndex < 0) return null

  const arrowIndex = findTopLevelArrow(source, commaIndex + 1, argsEnd)
  if (arrowIndex < 0) return null

  const bodyExprStart = skipWhitespaces(source, arrowIndex + 2, argsEnd)
  if (bodyExprStart >= argsEnd) return null

  if (source[bodyExprStart] === '{') {
    const blockEnd = findMatchingDelimiter(source, bodyExprStart, '{', '}')
    if (blockEnd < 0) return null
    return {
      prefix: token.path,
      bodyStart: bodyExprStart + 1,
      bodyEnd: Math.min(blockEnd, argsEnd)
    }
  }

  return {
    prefix: token.path,
    bodyStart: bodyExprStart,
    bodyEnd: argsEnd
  }
}

const resolveActiveGroupPrefix = (groups: GroupRange[], callIndex: number) => {
  const activeGroups = groups
    .filter((group) => callIndex >= group.bodyStart && callIndex < group.bodyEnd)
    .sort((left, right) => left.bodyStart - right.bodyStart)

  return activeGroups.reduce((prefix, group) => joinRoutePath(prefix, group.prefix), '')
}

export const extractApiRoutesFromBackendSource = (source: string) => {
  const tokens = parseMethodCalls(source)
  const groupRanges = tokens
    .filter((token) => token.method === 'group')
    .map((token) => extractGroupRange(source, token))
    .filter((item): item is GroupRange => Boolean(item))

  const routes = new Set<string>()
  for (const token of tokens) {
    if (!ROUTE_METHODS.has(token.method as RouteMethod)) continue
    const groupPrefix = resolveActiveGroupPrefix(groupRanges, token.index)
    const fullPath = groupPrefix
      ? joinRoutePath(groupPrefix, token.path)
      : normalizeRoutePath(token.path)
    if (fullPath.startsWith('/api')) {
      routes.add(fullPath)
    }
  }

  return [...routes].sort((left, right) => left.localeCompare(right))
}

const listTypeScriptFiles = async (dirPath: string): Promise<string[]> => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    const files = await Promise.all(
      entries.map(async (entry) => {
        const absolutePath = path.join(dirPath, entry.name)
        if (entry.isDirectory()) {
          return listTypeScriptFiles(absolutePath)
        }
        if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
          return [absolutePath]
        }
        return []
      })
    )
    return files.flat().sort((left, right) => left.localeCompare(right))
  } catch (error: unknown) {
    const code = (error as { code?: string } | null | undefined)?.code
    if (code === 'ENOENT') return []
    throw error
  }
}

const resolveBackendSourceFiles = async (backendPath: string) => {
  const entryPath = path.resolve(backendPath)
  const httpDirPath = path.join(path.dirname(entryPath), 'http')
  const httpFiles = await listTypeScriptFiles(httpDirPath)
  return [entryPath, ...httpFiles].sort((left, right) => left.localeCompare(right))
}

export const readApiRoutesFromBackend = async (backendPath: string) => {
  const sourceFiles = await resolveBackendSourceFiles(backendPath)
  const routes = new Set<string>()

  for (const sourceFile of sourceFiles) {
    const content = await fs.readFile(sourceFile, 'utf8')
    const extractedRoutes = extractApiRoutesFromBackendSource(content)
    extractedRoutes.forEach((route) => routes.add(route))
  }

  return [...routes].sort((left, right) => left.localeCompare(right))
}

export const resolveArgValue = (argv: string[], flag: string) => {
  const equalsPrefix = `${flag}=`
  for (let index = 0; index < argv.length; index += 1) {
    const item = String(argv[index] || '').trim()
    if (!item) continue
    if (item === flag) {
      return String(argv[index + 1] || '').trim()
    }
    if (item.startsWith(equalsPrefix)) {
      return item.slice(equalsPrefix.length).trim()
    }
  }
  return ''
}

export const resolveGenerateRegistryInput = (argv: string[]): GenerateRouteRegistryInput => {
  const backendArg = resolveArgValue(argv, '--backend')
  const outputArg = resolveArgValue(argv, '--output')

  return {
    backendPath: path.resolve(process.cwd(), backendArg || DEFAULT_INPUT.backendPath),
    outputPath: path.resolve(process.cwd(), outputArg || DEFAULT_INPUT.outputPath)
  }
}

export const generateApiRouteRegistry = async (input: Partial<GenerateRouteRegistryInput> = {}) => {
  const backendPath = path.resolve(input.backendPath || DEFAULT_INPUT.backendPath)
  const outputPath = path.resolve(input.outputPath || DEFAULT_INPUT.outputPath)
  const routes = await readApiRoutesFromBackend(backendPath)
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, `${JSON.stringify(routes, null, 2)}\n`, 'utf8')
  return {
    backendPath,
    outputPath,
    routeCount: routes.length,
    routes
  }
}

const toErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message
  return String(error || 'unknown error')
}

const run = async () => {
  try {
    const input = resolveGenerateRegistryInput(process.argv.slice(2))
    const result = await generateApiRouteRegistry(input)
    console.log(
      JSON.stringify(
        {
          status: 'passed',
          backendPath: result.backendPath,
          outputPath: result.outputPath,
          routeCount: result.routeCount
        },
        null,
        2
      )
    )
    process.exit(0)
  } catch (error) {
    console.error(`生成 API 路由注册表失败: ${toErrorMessage(error)}`)
    process.exit(1)
  }
}

if (import.meta.main) {
  void run()
}
