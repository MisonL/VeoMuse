import type { MarketplaceModel, ModelProfile } from '@veomuse/shared'
import { getLocalDb } from '../LocalDatabaseService'
import {
  DEFAULT_PROFILES,
  metricsFromRow,
  nowIso,
  profileFromRow,
  calcP95,
  type DbRecord
} from '../modelMarketplaceShared'
import { TelemetryService } from '../TelemetryService'

export const ensureDefaultProfiles = () => {
  const db = getLocalDb()
  const upsertProfile = db.prepare(`
    INSERT INTO model_profiles (
      id, name, provider, capabilities_json, cost_per_second, max_duration_sec,
      supports_4k, supports_audio, supports_stylization, region, enabled, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      provider = excluded.provider,
      capabilities_json = excluded.capabilities_json,
      cost_per_second = excluded.cost_per_second,
      max_duration_sec = excluded.max_duration_sec,
      supports_4k = excluded.supports_4k,
      supports_audio = excluded.supports_audio,
      supports_stylization = excluded.supports_stylization,
      region = excluded.region,
      enabled = excluded.enabled,
      updated_at = excluded.updated_at
  `)

  DEFAULT_PROFILES.forEach((profile) => {
    upsertProfile.run(
      profile.id,
      profile.name,
      profile.provider,
      JSON.stringify(profile.capabilities),
      profile.costPerSecond,
      profile.maxDurationSec,
      profile.supports4k ? 1 : 0,
      profile.supportsAudio ? 1 : 0,
      profile.supportsStylization ? 1 : 0,
      profile.region,
      profile.enabled ? 1 : 0,
      profile.updatedAt
    )
  })
}

export const getAllProfiles = (): ModelProfile[] => {
  const rows = getLocalDb()
    .prepare(`SELECT * FROM model_profiles ORDER BY id ASC`)
    .all() as DbRecord[]
  return rows.map(profileFromRow)
}

export const getProfile = (modelId: string): ModelProfile | null => {
  const row = getLocalDb()
    .prepare(`SELECT * FROM model_profiles WHERE id = ?`)
    .get(modelId) as DbRecord | null
  return row ? profileFromRow(row) : null
}

export const collectAndPersistMetrics = (windowMinutes: number = 1440) => {
  const db = getLocalDb()
  const profiles = getAllProfiles()
  const telemetry = TelemetryService.getInstance().getRawMetrics()
  const fromTs = Date.now() - windowMinutes * 60 * 1000

  const upsertMetric = db.prepare(`
    INSERT INTO model_runtime_metrics (
      model_id, window_minutes, total_requests, success_rate, p95_latency_ms, avg_cost_usd, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(model_id) DO UPDATE SET
      window_minutes = excluded.window_minutes,
      total_requests = excluded.total_requests,
      success_rate = excluded.success_rate,
      p95_latency_ms = excluded.p95_latency_ms,
      avg_cost_usd = excluded.avg_cost_usd,
      updated_at = excluded.updated_at
  `)

  profiles.forEach((profile) => {
    const modelMetrics = telemetry.filter(
      (metric) =>
        metric.service === `MODEL-${profile.id}` && new Date(metric.timestamp).getTime() >= fromTs
    )
    const totalRequests = modelMetrics.length
    const successCount = modelMetrics.filter((metric) => metric.success).length
    const successRate = totalRequests ? Number((successCount / totalRequests).toFixed(4)) : 1
    const p95LatencyMs = calcP95(modelMetrics.map((metric) => metric.durationMs))
    const avgCostUsd = totalRequests ? Number((profile.costPerSecond * 8).toFixed(4)) : 0

    upsertMetric.run(
      profile.id,
      windowMinutes,
      totalRequests,
      successRate,
      p95LatencyMs,
      avgCostUsd,
      nowIso()
    )
  })
}

export const listMarketplace = (options: { refreshMetrics?: boolean } = {}): MarketplaceModel[] => {
  if (options.refreshMetrics !== false) {
    collectAndPersistMetrics()
  }

  const profiles = getAllProfiles()
  const getMetric = getLocalDb().prepare(`SELECT * FROM model_runtime_metrics WHERE model_id = ?`)
  return profiles.map((profile) => ({
    profile,
    metrics: metricsFromRow(getMetric.get(profile.id) as DbRecord | null, profile.id)
  }))
}
