import path from 'path'
import { cleanupGeneratedFiles, startCleanupScheduler } from '../services/CleanupSchedulerService'
import { LocalDatabaseService } from '../services/LocalDatabaseService'
import { ModelMarketplaceService } from '../services/ModelMarketplaceService'
import { SloService } from '../services/SloService'
import { VideoGenerationService } from '../services/VideoGenerationService'
import { isDevRuntime, parseBooleanEnv } from '../http/context'
import { resolveErrorMessage } from '../http/errors'

type StartableApp = {
  listen: (options: { port: number; hostname: string }) => unknown
  server?: {
    port?: number | string
  } | null
}

const parseMs = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const isWeakSecret = (value: string | undefined, placeholders: string[]) => {
  const secret = String(value || '').trim()
  if (!secret) return true
  return placeholders.some((item) => item.toLowerCase() === secret.toLowerCase())
}

const resolveGeneratedDir = () => {
  const baseUploadsDir = process.env.UPLOADS_PATH
    ? path.resolve(process.env.UPLOADS_PATH)
    : path.resolve(process.cwd(), '../../uploads')
  return path.join(baseUploadsDir, 'generated')
}

const assertProductionSecrets = () => {
  if (!process.env.JWT_SECRET?.trim()) {
    throw new Error('JWT_SECRET 未配置，生产环境拒绝启动')
  }
  if (!process.env.SECRET_ENCRYPTION_KEY?.trim()) {
    throw new Error('SECRET_ENCRYPTION_KEY 未配置，生产环境拒绝启动')
  }
  if (
    isWeakSecret(process.env.REDIS_PASSWORD, [
      'veomuse-redis-change-me',
      'replace-with-strong-password',
      'changeme',
      'change-me'
    ])
  ) {
    throw new Error('REDIS_PASSWORD 未配置强口令，生产环境拒绝启动')
  }
}

const createDbHealthTask = (intervalMs: number) => {
  if (intervalMs <= 0) return null
  let repairing = false
  return setInterval(() => {
    if (repairing) return
    const health = LocalDatabaseService.checkIntegrity('quick')
    if (health.status === 'ok') return
    if (!LocalDatabaseService.shouldAutoRepair(health)) {
      console.warn(
        `[DB-AutoRepair] skipped non-corruption health issue: ${health.messages.join('; ') || health.status}`
      )
      return
    }
    repairing = true
    try {
      const repair = LocalDatabaseService.repair({
        force: true,
        reason: 'runtime-healthcheck-auto'
      })
      if (repair.status === 'repaired') {
        ModelMarketplaceService.resetAfterDatabaseRecovery()
        console.warn(`[DB-AutoRepair] repaired database, copiedRows=${repair.salvage.copiedRows}`)
      } else if (repair.status === 'failed') {
        console.error(`[DB-AutoRepair] failed: ${repair.error || 'unknown error'}`)
      }
    } finally {
      repairing = false
    }
  }, intervalMs)
}

const createVideoJobSyncTask = (params: {
  enabled: boolean
  intervalMs: number
  batchSize: number
  olderThanMs: number
}) => {
  if (!params.enabled || params.intervalMs <= 0) return null
  let syncing = false
  return setInterval(() => {
    if (syncing) return
    syncing = true
    void VideoGenerationService.syncPendingJobsBatch({
      limit: params.batchSize,
      olderThanMs: params.olderThanMs
    })
      .then((batch) => {
        if (batch.syncedCount > 0 || batch.failedCount > 0) {
          console.log(
            `[video-job-sync] scanned=${batch.scannedCount}, synced=${batch.syncedCount}, failed=${batch.failedCount}, skipped=${batch.skippedCount}`
          )
        }
        if (batch.failedCount > 0) {
          const sample = batch.failedJobs
            .slice(0, 2)
            .map((item) => `${item.jobId}:${item.error}`)
            .join('; ')
          console.warn(`[video-job-sync] failed sample: ${sample}`)
        }
      })
      .catch((error: unknown) => {
        console.warn(
          `[video-job-sync] unexpected error: ${String(
            resolveErrorMessage(error, 'unknown sync error')
          )}`
        )
      })
      .finally(() => {
        syncing = false
      })
  }, params.intervalMs)
}

export const startAppRuntime = ({ app }: { app: StartableApp }) => {
  const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production'
  if (isProduction) {
    assertProductionSecrets()
  }
  if (!isDevRuntime() && !process.env.ADMIN_TOKEN?.trim()) {
    console.error(
      '[Security] ADMIN_TOKEN 未配置，管理接口已在生产模式禁用。请设置 ADMIN_TOKEN 后重启服务。'
    )
  }

  app.listen({ port: parseInt(process.env.PORT || '33117', 10), hostname: '0.0.0.0' })

  const generatedDir = resolveGeneratedDir()
  const cleanupIntervalMs = parseMs(process.env.CLEANUP_INTERVAL_MS, 86_400_000)
  const cleanupRetentionMs = parseMs(process.env.CLEANUP_RETENTION_MS, 86_400_000)
  const sloCleanupIntervalMs = parseMs(process.env.SLO_CLEANUP_INTERVAL_MS, 86_400_000)
  const marketplaceMetricIntervalMs = parseMs(process.env.MARKETPLACE_METRIC_INTERVAL_MS, 300_000)
  const dbHealthcheckIntervalMs = parseMs(process.env.DB_HEALTHCHECK_INTERVAL_MS, 0)
  const videoJobAutoSyncEnabled = process.env.VIDEO_JOB_AUTO_SYNC_ENABLED
    ? parseBooleanEnv(process.env.VIDEO_JOB_AUTO_SYNC_ENABLED)
    : true
  const videoJobAutoSyncIntervalMs = parseMs(process.env.VIDEO_JOB_AUTO_SYNC_INTERVAL_MS, 20_000)
  const videoJobAutoSyncBatchSize = parsePositiveInt(process.env.VIDEO_JOB_AUTO_SYNC_BATCH_SIZE, 8)
  const videoJobAutoSyncOlderThanMs = parsePositiveInt(
    process.env.VIDEO_JOB_AUTO_SYNC_OLDER_THAN_MS,
    5_000
  )

  void cleanupGeneratedFiles(generatedDir, { maxAgeMs: cleanupRetentionMs, retries: 2 })
  SloService.cleanupExpiredData()

  const cleanupTask = startCleanupScheduler(generatedDir, cleanupIntervalMs, cleanupRetentionMs)
  const sloCleanupTask = setInterval(() => {
    SloService.cleanupExpiredData()
  }, sloCleanupIntervalMs)
  const metricTask = setInterval(
    () => ModelMarketplaceService.collectAndPersistMetrics(),
    marketplaceMetricIntervalMs
  )
  const dbHealthTask = createDbHealthTask(dbHealthcheckIntervalMs)
  const videoJobSyncTask = createVideoJobSyncTask({
    enabled: videoJobAutoSyncEnabled,
    intervalMs: videoJobAutoSyncIntervalMs,
    batchSize: videoJobAutoSyncBatchSize,
    olderThanMs: videoJobAutoSyncOlderThanMs
  })

  const dispose = () => {
    clearInterval(cleanupTask)
    clearInterval(sloCleanupTask)
    clearInterval(metricTask)
    if (dbHealthTask) clearInterval(dbHealthTask)
    if (videoJobSyncTask) clearInterval(videoJobSyncTask)
  }

  process.on('SIGTERM', dispose)
  process.on('SIGINT', dispose)

  console.log(`🚀 VeoMuse 旗舰后端已启动: ${app.server?.port}`)
}
