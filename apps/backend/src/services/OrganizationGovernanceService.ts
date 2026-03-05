import { getLocalDb } from './LocalDatabaseService'

export interface OrganizationQuota {
  organizationId: string
  requestLimit: number
  storageLimitBytes: number
  concurrencyLimit: number
  updatedBy: string
  updatedAt: string
}

export interface OrganizationUsage {
  organizationId: string
  requestCount: number
  storageBytes: number
  lastRequestAt: string | null
  updatedAt: string
  activeRequests: number
}

export interface OrganizationQuotaCheckResult {
  allowed: boolean
  reason: 'request' | 'storage' | 'concurrency' | 'ok'
  limit: number
  current: number
  upcoming: number
  remaining: number
  quota: OrganizationQuota
  usage: OrganizationUsage
}

export interface OrganizationAuditRecord {
  id: string
  source: 'channel' | 'workspace'
  organizationId: string
  workspaceId: string | null
  actor: string
  action: string
  providerId: string | null
  traceId: string | null
  createdAt: string
  detail: Record<string, unknown>
}

export interface OrganizationAuditExportOptions {
  from?: string
  to?: string
  scope?: 'all' | 'channel' | 'workspace'
  format?: 'json' | 'csv'
  limit?: number
}

export interface OrganizationAuditExportResult {
  organizationId: string
  generatedAt: string
  from?: string
  to?: string
  scope: 'all' | 'channel' | 'workspace'
  format: 'json' | 'csv'
  limit: number
  total: number
  records: OrganizationAuditRecord[]
  csv?: string
}

const nowIso = () => new Date().toISOString()

const clampInt = (value: unknown, fallback = 0) => {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, parsed)
}

const parseJsonObject = (value: unknown) => {
  try {
    const parsed = JSON.parse(String(value || '{}'))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return {}
  } catch {
    return {}
  }
}

const activeRequestCounters = new Map<string, number>()

const toQuota = (organizationId: string, row?: any): OrganizationQuota => ({
  organizationId,
  requestLimit: clampInt(row?.request_limit, 0),
  storageLimitBytes: clampInt(row?.storage_limit_bytes, 0),
  concurrencyLimit: clampInt(row?.concurrency_limit, 0),
  updatedBy: String(row?.updated_by || 'system'),
  updatedAt: String(row?.updated_at || nowIso())
})

const toUsage = (organizationId: string, row?: any): OrganizationUsage => ({
  organizationId,
  requestCount: clampInt(row?.request_count, 0),
  storageBytes: clampInt(row?.storage_bytes, 0),
  lastRequestAt: row?.last_request_at ? String(row.last_request_at) : null,
  updatedAt: String(row?.updated_at || nowIso()),
  activeRequests: activeRequestCounters.get(organizationId) || 0
})

const csvEscape = (value: unknown) => {
  const raw = String(value ?? '')
  if (!/[",\n\r]/.test(raw)) return raw
  return `"${raw.replace(/"/g, '""')}"`
}

export class OrganizationGovernanceService {
  static getQuota(organizationId: string): OrganizationQuota {
    const row = getLocalDb()
      .prepare(
        `
      SELECT * FROM organization_quotas
      WHERE organization_id = ?
      LIMIT 1
    `
      )
      .get(organizationId)
    return toQuota(organizationId, row)
  }

  static upsertQuota(input: {
    organizationId: string
    requestLimit?: number
    storageLimitBytes?: number
    concurrencyLimit?: number
    updatedBy: string
  }): OrganizationQuota {
    const current = this.getQuota(input.organizationId)
    const next: OrganizationQuota = {
      organizationId: input.organizationId,
      requestLimit:
        input.requestLimit === undefined ? current.requestLimit : clampInt(input.requestLimit, 0),
      storageLimitBytes:
        input.storageLimitBytes === undefined
          ? current.storageLimitBytes
          : clampInt(input.storageLimitBytes, 0),
      concurrencyLimit:
        input.concurrencyLimit === undefined
          ? current.concurrencyLimit
          : clampInt(input.concurrencyLimit, 0),
      updatedBy: input.updatedBy || current.updatedBy || 'system',
      updatedAt: nowIso()
    }

    getLocalDb()
      .prepare(
        `
      INSERT INTO organization_quotas (
        organization_id, request_limit, storage_limit_bytes, concurrency_limit, updated_by, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(organization_id) DO UPDATE SET
        request_limit = excluded.request_limit,
        storage_limit_bytes = excluded.storage_limit_bytes,
        concurrency_limit = excluded.concurrency_limit,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
    `
      )
      .run(
        next.organizationId,
        next.requestLimit,
        next.storageLimitBytes,
        next.concurrencyLimit,
        next.updatedBy,
        next.updatedAt
      )

    return this.getQuota(input.organizationId)
  }

  static getUsage(organizationId: string): OrganizationUsage {
    const row = getLocalDb()
      .prepare(
        `
      SELECT * FROM organization_usage_counters
      WHERE organization_id = ?
      LIMIT 1
    `
      )
      .get(organizationId)
    return toUsage(organizationId, row)
  }

  static incrementRequest(organizationId: string, delta: number = 1) {
    const safeDelta = Math.max(0, Math.floor(delta || 0))
    if (!safeDelta) return this.getUsage(organizationId)
    const nowTs = nowIso()

    getLocalDb()
      .prepare(
        `
      INSERT INTO organization_usage_counters (
        organization_id, request_count, storage_bytes, last_request_at, updated_at
      ) VALUES (?, ?, 0, ?, ?)
      ON CONFLICT(organization_id) DO UPDATE SET
        request_count = organization_usage_counters.request_count + excluded.request_count,
        last_request_at = excluded.last_request_at,
        updated_at = excluded.updated_at
    `
      )
      .run(organizationId, safeDelta, nowTs, nowTs)

    return this.getUsage(organizationId)
  }

  static addStorageUsage(organizationId: string, deltaBytes: number) {
    const safeDelta = Number.parseInt(String(deltaBytes || 0), 10)
    if (!Number.isFinite(safeDelta) || safeDelta === 0) return this.getUsage(organizationId)

    const nowTs = nowIso()
    getLocalDb()
      .prepare(
        `
      INSERT INTO organization_usage_counters (
        organization_id, request_count, storage_bytes, last_request_at, updated_at
      ) VALUES (?, 0, ?, NULL, ?)
      ON CONFLICT(organization_id) DO UPDATE SET
        storage_bytes = CASE
          WHEN organization_usage_counters.storage_bytes + excluded.storage_bytes < 0 THEN 0
          ELSE organization_usage_counters.storage_bytes + excluded.storage_bytes
        END,
        updated_at = excluded.updated_at
    `
      )
      .run(organizationId, safeDelta, nowTs)

    return this.getUsage(organizationId)
  }

  static checkRequestAllowed(
    organizationId: string,
    upcoming: number = 1
  ): OrganizationQuotaCheckResult {
    const quota = this.getQuota(organizationId)
    const usage = this.getUsage(organizationId)
    const upcomingSafe = Math.max(0, Math.floor(upcoming || 0))
    const limit = quota.requestLimit
    const current = usage.requestCount

    if (limit <= 0) {
      return {
        allowed: true,
        reason: 'ok',
        limit,
        current,
        upcoming: upcomingSafe,
        remaining: Number.POSITIVE_INFINITY,
        quota,
        usage
      }
    }

    const allowed = current + upcomingSafe <= limit
    return {
      allowed,
      reason: allowed ? 'ok' : 'request',
      limit,
      current,
      upcoming: upcomingSafe,
      remaining: Math.max(0, limit - current),
      quota,
      usage
    }
  }

  static consumeRequestQuota(
    organizationId: string,
    delta: number = 1
  ): OrganizationQuotaCheckResult {
    const check = this.checkRequestAllowed(organizationId, delta)
    if (!check.allowed) return check
    const usage = this.incrementRequest(organizationId, delta)
    return {
      ...check,
      usage,
      current: usage.requestCount,
      remaining:
        check.limit <= 0 ? Number.POSITIVE_INFINITY : Math.max(0, check.limit - usage.requestCount)
    }
  }

  static checkStorageAllowed(
    organizationId: string,
    upcomingBytes: number = 0
  ): OrganizationQuotaCheckResult {
    const quota = this.getQuota(organizationId)
    const usage = this.getUsage(organizationId)
    const upcomingSafe = Math.max(0, Math.floor(upcomingBytes || 0))
    const limit = quota.storageLimitBytes
    const current = usage.storageBytes

    if (limit <= 0) {
      return {
        allowed: true,
        reason: 'ok',
        limit,
        current,
        upcoming: upcomingSafe,
        remaining: Number.POSITIVE_INFINITY,
        quota,
        usage
      }
    }

    const allowed = current + upcomingSafe <= limit
    return {
      allowed,
      reason: allowed ? 'ok' : 'storage',
      limit,
      current,
      upcoming: upcomingSafe,
      remaining: Math.max(0, limit - current),
      quota,
      usage
    }
  }

  static checkConcurrencyAllowed(organizationId: string): OrganizationQuotaCheckResult {
    const quota = this.getQuota(organizationId)
    const usage = this.getUsage(organizationId)
    const limit = quota.concurrencyLimit
    const current = usage.activeRequests

    if (limit <= 0) {
      return {
        allowed: true,
        reason: 'ok',
        limit,
        current,
        upcoming: 1,
        remaining: Number.POSITIVE_INFINITY,
        quota,
        usage
      }
    }

    const allowed = current + 1 <= limit
    return {
      allowed,
      reason: allowed ? 'ok' : 'concurrency',
      limit,
      current,
      upcoming: 1,
      remaining: Math.max(0, limit - current),
      quota,
      usage
    }
  }

  static async withConcurrencyLimit<T>(organizationId: string, job: () => Promise<T>): Promise<T> {
    const check = this.checkConcurrencyAllowed(organizationId)
    if (!check.allowed) {
      throw new Error(`组织并发配额已达上限：${check.current}/${check.limit}`)
    }

    const current = activeRequestCounters.get(organizationId) || 0
    activeRequestCounters.set(organizationId, current + 1)
    try {
      return await job()
    } finally {
      const next = Math.max(0, (activeRequestCounters.get(organizationId) || 1) - 1)
      if (next <= 0) activeRequestCounters.delete(organizationId)
      else activeRequestCounters.set(organizationId, next)
    }
  }

  static exportAudits(
    organizationId: string,
    options: OrganizationAuditExportOptions = {}
  ): OrganizationAuditExportResult {
    const scope =
      options.scope === 'channel' || options.scope === 'workspace' ? options.scope : 'all'
    const format = options.format === 'csv' ? 'csv' : 'json'
    const limit = Math.max(1, Math.min(5000, clampInt(options.limit, 1000)))
    const from = options.from?.trim() || undefined
    const to = options.to?.trim() || undefined

    const records: OrganizationAuditRecord[] = []

    if (scope === 'all' || scope === 'channel') {
      const clauses = ['organization_id = ?']
      const params: any[] = [organizationId]
      if (from) {
        clauses.push('created_at >= ?')
        params.push(from)
      }
      if (to) {
        clauses.push('created_at <= ?')
        params.push(to)
      }

      const rows = getLocalDb()
        .prepare(
          `
        SELECT
          id,
          organization_id,
          workspace_id,
          actor_user_id AS actor,
          action,
          provider_id,
          detail_json,
          created_at,
          trace_id
        FROM ai_channel_audits
        WHERE ${clauses.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
        )
        .all(...params) as any[]

      for (const row of rows) {
        records.push({
          id: String(row.id),
          source: 'channel',
          organizationId: String(row.organization_id),
          workspaceId: row.workspace_id ? String(row.workspace_id) : null,
          actor: String(row.actor || ''),
          action: String(row.action || ''),
          providerId: row.provider_id ? String(row.provider_id) : null,
          traceId: row.trace_id ? String(row.trace_id) : null,
          createdAt: String(row.created_at || ''),
          detail: parseJsonObject(row.detail_json)
        })
      }
    }

    if (scope === 'all' || scope === 'workspace') {
      const clauses = ['organization_id = ?']
      const params: any[] = [organizationId]
      if (from) {
        clauses.push('created_at >= ?')
        params.push(from)
      }
      if (to) {
        clauses.push('created_at <= ?')
        params.push(to)
      }

      const rows = getLocalDb()
        .prepare(
          `
        SELECT
          id,
          organization_id,
          workspace_id,
          actor_name AS actor,
          action,
          NULL AS provider_id,
          detail_json,
          created_at,
          trace_id
        FROM audit_logs
        WHERE ${clauses.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
        )
        .all(...params) as any[]

      for (const row of rows) {
        records.push({
          id: String(row.id),
          source: 'workspace',
          organizationId: String(row.organization_id),
          workspaceId: row.workspace_id ? String(row.workspace_id) : null,
          actor: String(row.actor || ''),
          action: String(row.action || ''),
          providerId: null,
          traceId: row.trace_id ? String(row.trace_id) : null,
          createdAt: String(row.created_at || ''),
          detail: parseJsonObject(row.detail_json)
        })
      }
    }

    const sorted = records.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit)

    const output: OrganizationAuditExportResult = {
      organizationId,
      generatedAt: nowIso(),
      from,
      to,
      scope,
      format,
      limit,
      total: sorted.length,
      records: sorted
    }

    if (format === 'csv') {
      const header = [
        'id',
        'source',
        'organizationId',
        'workspaceId',
        'actor',
        'action',
        'providerId',
        'traceId',
        'createdAt',
        'detailJson'
      ]
      const rows = sorted.map((item) =>
        [
          item.id,
          item.source,
          item.organizationId,
          item.workspaceId || '',
          item.actor,
          item.action,
          item.providerId || '',
          item.traceId || '',
          item.createdAt,
          JSON.stringify(item.detail || {})
        ]
          .map(csvEscape)
          .join(',')
      )
      output.csv = [header.join(','), ...rows].join('\n')
    }

    return output
  }
}
