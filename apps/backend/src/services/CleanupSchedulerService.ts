import fs from 'fs/promises'
import path from 'path'
import { TelemetryService } from './TelemetryService'

export interface CleanupLogger {
  info: (message: string) => void
  warn: (message: string) => void
  error: (message: string) => void
}

export interface CleanupOptions {
  now?: number
  maxAgeMs?: number
  retries?: number
  logger?: CleanupLogger
  removeFile?: (target: string) => Promise<void>
}

export interface CleanupResult {
  directory: string
  scanned: number
  removed: number
  failed: number
  retries: number
  durationMs: number
  success: boolean
  timestamp: string
}

const DAY_MS = 86_400_000

const defaultLogger: CleanupLogger = {
  info: (message) => console.log(message),
  warn: (message) => console.warn(message),
  error: (message) => console.error(message)
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const tryRemoveWithRetry = async (
  target: string,
  retries: number,
  logger: CleanupLogger,
  removeFile: (path: string) => Promise<void>
) => {
  let attempts = 0
  while (attempts <= retries) {
    try {
      await removeFile(target)
      return { ok: true, retriesUsed: attempts }
    } catch (error: any) {
      attempts += 1
      if (attempts > retries) {
        logger.error(`[Cleanup] 删除失败: ${target} | ${error?.message || 'Unknown error'}`)
        return { ok: false, retriesUsed: retries }
      }
      logger.warn(`[Cleanup] 删除重试 ${attempts}/${retries}: ${path.basename(target)}`)
      await sleep(Math.min(200 * attempts, 1000))
    }
  }

  return { ok: false, retriesUsed: retries }
}

export const cleanupGeneratedFiles = async (
  directory: string,
  options: CleanupOptions = {}
): Promise<CleanupResult> => {
  const start = Date.now()
  const now = options.now ?? Date.now()
  const maxAgeMs = options.maxAgeMs ?? DAY_MS
  const retries = Math.max(0, options.retries ?? 2)
  const logger = options.logger ?? defaultLogger
  const removeFile = options.removeFile ?? fs.unlink

  let scanned = 0
  let removed = 0
  let failed = 0
  let retriesUsed = 0

  logger.info(`[Cleanup] 开始扫描目录: ${directory}`)

  try {
    const entries = await fs.readdir(directory, { withFileTypes: true })
    const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name)
    scanned = files.length

    for (const file of files) {
      const fullPath = path.join(directory, file)
      const stat = await fs.stat(fullPath)
      if (now - stat.mtimeMs <= maxAgeMs) continue

      const result = await tryRemoveWithRetry(fullPath, retries, logger, removeFile)
      retriesUsed += result.retriesUsed
      if (result.ok) {
        removed += 1
        logger.info(`[Cleanup] 已删除过期文件: ${file}`)
      } else {
        failed += 1
      }
    }
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      logger.warn(`[Cleanup] 目录不存在，跳过: ${directory}`)
    } else {
      failed += 1
      logger.error(`[Cleanup] 任务异常: ${error?.message || 'Unknown error'}`)
    }
  }

  const durationMs = Date.now() - start
  const result: CleanupResult = {
    directory,
    scanned,
    removed,
    failed,
    retries: retriesUsed,
    durationMs,
    success: failed === 0,
    timestamp: new Date().toISOString()
  }

  TelemetryService.getInstance().recordApiCall({
    service: 'System-Cleanup',
    durationMs,
    success: result.success,
    timestamp: result.timestamp
  })

  logger.info(
    `[Cleanup] 扫描完成: scanned=${scanned}, removed=${removed}, failed=${failed}, retries=${retriesUsed}, duration=${durationMs}ms`
  )
  return result
}

export const startCleanupScheduler = (
  directory: string,
  intervalMs: number = DAY_MS,
  maxAgeMs: number = DAY_MS
) =>
  setInterval(async () => {
    await cleanupGeneratedFiles(directory, { maxAgeMs, retries: 2 })
  }, intervalMs)
