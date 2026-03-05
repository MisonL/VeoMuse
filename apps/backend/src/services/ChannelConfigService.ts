import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { getLocalDb } from './LocalDatabaseService'

export type ChannelScope = 'organization' | 'workspace'

export interface ChannelRuntimeContext {
  organizationId: string
  workspaceId?: string
}

export interface ChannelProvider {
  id: string
  label: string
  category: 'model' | 'service'
  defaultBaseUrl?: string
}

export interface ChannelConfigRow {
  id: string
  organizationId: string
  workspaceId: string | null
  providerId: string
  baseUrl: string
  enabled: boolean
  extra: Record<string, unknown>
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
  hasSecret: boolean
  secretMasked: string
}

export interface ChannelResolvedConfig {
  providerId: string
  baseUrl: string
  apiKey: string
  extra: Record<string, unknown>
  enabled: boolean
  scope: ChannelScope
}

type DbChannelConfigRow = {
  id?: unknown
  organization_id?: unknown
  workspace_id?: unknown
  provider_id?: unknown
  base_url?: unknown
  enabled?: unknown
  extra_json?: unknown
  created_by?: unknown
  updated_by?: unknown
  created_at?: unknown
  updated_at?: unknown
  secret_encrypted?: unknown
}

const now = () => new Date().toISOString()

const PROVIDERS: ChannelProvider[] = [
  { id: 'veo-3.1', label: 'Gemini Veo 3.1', category: 'model' },
  { id: 'kling-v1', label: 'Kling V1', category: 'model' },
  { id: 'sora-preview', label: 'Sora Preview', category: 'model' },
  { id: 'luma-dream', label: 'Luma Dream', category: 'model' },
  { id: 'runway-gen3', label: 'Runway Gen-3', category: 'model' },
  { id: 'pika-1.5', label: 'Pika 1.5', category: 'model' },
  { id: 'openai-compatible', label: 'OpenAI 兼容（自定义）', category: 'model' },
  { id: 'tts', label: 'TTS 配音', category: 'service' },
  { id: 'voiceMorph', label: '音色迁移', category: 'service' },
  { id: 'spatialRender', label: '空间重构', category: 'service' },
  { id: 'vfx', label: 'VFX 特效', category: 'service' },
  { id: 'lipSync', label: '口型同步', category: 'service' },
  { id: 'audioAnalysis', label: '音频分析', category: 'service' },
  { id: 'relighting', label: '重光照', category: 'service' },
  { id: 'styleTransfer', label: '风格迁移', category: 'service' }
]

const MODEL_PROVIDER_IDS = new Set(
  PROVIDERS.filter((item) => item.category === 'model').map((item) => item.id)
)
const SERVICE_PROVIDER_IDS = new Set(
  PROVIDERS.filter((item) => item.category === 'service').map((item) => item.id)
)

const getKey = () => {
  const raw = process.env.SECRET_ENCRYPTION_KEY?.trim()
  if (raw) {
    const decoded = /^[a-f0-9]{64}$/i.test(raw)
      ? Buffer.from(raw, 'hex')
      : Buffer.from(raw, 'base64')
    if (decoded.length === 32) return decoded
  }
  const fallback = process.env.JWT_SECRET?.trim() || 'veomuse-dev-encryption-secret-change-me'
  return createHash('sha256').update(fallback).digest()
}

const encryptSecret = (plain: string) => {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`
}

const decryptSecret = (value: string) => {
  const [ivPart, tagPart, dataPart] = String(value || '').split('.')
  if (!ivPart || !tagPart || !dataPart) return ''
  try {
    const key = getKey()
    const iv = Buffer.from(ivPart, 'base64')
    const tag = Buffer.from(tagPart, 'base64')
    const data = Buffer.from(dataPart, 'base64')
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
    return decrypted.toString('utf8')
  } catch {
    return ''
  }
}

const maskSecret = (value: string) => {
  const raw = String(value || '')
  if (!raw) return ''
  if (raw.length <= 6) return `${raw[0]}***${raw.slice(-1)}`
  return `${raw.slice(0, 3)}***${raw.slice(-3)}`
}

const normalizeConfigRow = (row?: DbChannelConfigRow | null): ChannelConfigRow => {
  const source = row || {}
  const secret = decryptSecret(String(source.secret_encrypted || ''))
  const extra = (() => {
    try {
      return JSON.parse(String(source.extra_json || '{}'))
    } catch {
      return {}
    }
  })()
  return {
    id: String(source.id || ''),
    organizationId: String(source.organization_id || ''),
    workspaceId: source.workspace_id ? String(source.workspace_id) : null,
    providerId: String(source.provider_id || ''),
    baseUrl: String(source.base_url || ''),
    enabled: Number(source.enabled || 0) === 1,
    extra,
    createdBy: String(source.created_by || ''),
    updatedBy: String(source.updated_by || ''),
    createdAt: String(source.created_at || ''),
    updatedAt: String(source.updated_at || ''),
    hasSecret: Boolean(secret),
    secretMasked: maskSecret(secret)
  }
}

const resolveErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return fallback
}

export class ChannelConfigService {
  static listProviders() {
    return PROVIDERS
  }

  static assertProvider(providerId: string) {
    if (!PROVIDERS.some((item) => item.id === providerId)) {
      throw new Error('不支持的渠道 provider')
    }
  }

  private static normalizeExtra(
    providerId: string,
    extra?: Record<string, unknown>,
    options?: { requireModel?: boolean }
  ) {
    const normalized = extra && typeof extra === 'object' ? { ...extra } : {}
    if (providerId !== 'openai-compatible') return normalized

    const requireModel = options?.requireModel !== false
    const model = String(normalized.model || '').trim()
    if (requireModel && !model) {
      throw new Error('OpenAI 兼容渠道必须填写 model')
    }

    const rawPath = String(normalized.path || '/v1/chat/completions').trim()
    let path = rawPath || '/v1/chat/completions'
    if (/^https?:\/\//i.test(path)) {
      try {
        const parsed = new URL(path)
        if (!/^https?:$/.test(parsed.protocol)) {
          throw new Error('OpenAI 兼容渠道 path 仅支持 http/https 绝对地址')
        }
        path = parsed.toString()
      } catch {
        throw new Error('OpenAI 兼容渠道 path 格式不正确')
      }
    } else if (!path.startsWith('/')) {
      path = `/${path}`
    }

    const next: Record<string, unknown> = {
      ...normalized,
      path
    }
    if (model) next.model = model
    else delete next.model

    const temperatureRaw = normalized.temperature
    if (
      temperatureRaw !== undefined &&
      temperatureRaw !== null &&
      String(temperatureRaw).trim() !== ''
    ) {
      const temperature = Number(temperatureRaw)
      if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
        throw new Error('OpenAI 兼容渠道 temperature 需在 0-2 之间')
      }
      next.temperature = Number(temperature.toFixed(3))
    } else {
      delete next.temperature
    }

    return next
  }

  static listConfigs(organizationId: string, workspaceId?: string) {
    const db = getLocalDb()
    const rows = workspaceId
      ? db
          .prepare(
            `
        SELECT * FROM ai_channel_configs
        WHERE organization_id = ? AND (workspace_id IS NULL OR workspace_id = ?)
        ORDER BY provider_id ASC, workspace_id DESC
      `
          )
          .all(organizationId, workspaceId)
      : db
          .prepare(
            `
        SELECT * FROM ai_channel_configs
        WHERE organization_id = ? AND workspace_id IS NULL
        ORDER BY provider_id ASC
      `
          )
          .all(organizationId)
    const normalizedRows = rows as DbChannelConfigRow[]

    const map = new Map<string, ChannelConfigRow>()
    for (const row of normalizedRows) {
      const normalized = normalizeConfigRow(row)
      const key = normalized.providerId
      if (!map.has(key)) {
        map.set(key, normalized)
        continue
      }
      const existing = map.get(key)!
      if (!existing.workspaceId && normalized.workspaceId) {
        map.set(key, normalized)
      }
    }
    return Array.from(map.values())
  }

  static upsertConfig(input: {
    organizationId: string
    workspaceId?: string
    providerId: string
    baseUrl?: string
    apiKey?: string
    enabled?: boolean
    extra?: Record<string, unknown>
    actorUserId: string
    traceId?: string
  }): ChannelConfigRow {
    this.assertProvider(input.providerId)
    const db = getLocalDb()
    const scopeWorkspaceId = input.workspaceId?.trim() || null
    const nowTs = now()
    const existing = db
      .prepare(
        `
      SELECT * FROM ai_channel_configs
      WHERE organization_id = ? AND provider_id = ? AND ((workspace_id IS NULL AND ? IS NULL) OR workspace_id = ?)
      LIMIT 1
    `
      )
      .get(
        input.organizationId,
        input.providerId,
        scopeWorkspaceId,
        scopeWorkspaceId
      ) as DbChannelConfigRow | null

    const existingBaseUrl = String(existing?.base_url || '').trim()
    const nextBaseUrl =
      input.baseUrl === undefined ? existingBaseUrl : String(input.baseUrl || '').trim()
    const existingExtra = (() => {
      try {
        return JSON.parse(String(existing?.extra_json || '{}')) as Record<string, unknown>
      } catch {
        return {}
      }
    })()
    const nextEnabled =
      input.enabled === undefined ? Number(existing?.enabled || 0) === 1 : Boolean(input.enabled)
    const nextExtraObject = this.normalizeExtra(
      input.providerId,
      input.extra === undefined ? existingExtra : input.extra,
      { requireModel: nextEnabled }
    )
    const nextExtra = JSON.stringify(nextExtraObject)
    const nextEnabledFlag = nextEnabled ? 1 : 0
    const keepEncrypted = existing?.secret_encrypted ? String(existing.secret_encrypted) : ''
    const nextSecretEncrypted = input.apiKey?.trim()
      ? encryptSecret(input.apiKey.trim())
      : keepEncrypted

    if (existing) {
      const existingId = String(existing.id || '')
      db.prepare(
        `
        UPDATE ai_channel_configs
        SET base_url = ?, secret_encrypted = ?, extra_json = ?, enabled = ?, updated_by = ?, updated_at = ?
        WHERE id = ?
      `
      ).run(
        nextBaseUrl,
        nextSecretEncrypted,
        nextExtra,
        nextEnabledFlag,
        input.actorUserId,
        nowTs,
        existingId
      )
      this.writeAudit(
        input.organizationId,
        scopeWorkspaceId,
        input.actorUserId,
        'channel.updated',
        input.providerId,
        {
          workspaceId: scopeWorkspaceId,
          enabled: Boolean(nextEnabledFlag),
          hasSecret: Boolean(nextSecretEncrypted),
          hasBaseUrl: Boolean(nextBaseUrl)
        },
        input.traceId
      )
      const row = db
        .prepare(`SELECT * FROM ai_channel_configs WHERE id = ?`)
        .get(existingId) as DbChannelConfigRow | null
      return normalizeConfigRow(row)
    }

    const id = `chn_${crypto.randomUUID()}`
    db.prepare(
      `
      INSERT INTO ai_channel_configs (
        id, organization_id, workspace_id, provider_id, base_url, secret_encrypted, extra_json, enabled,
        created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      id,
      input.organizationId,
      scopeWorkspaceId,
      input.providerId,
      nextBaseUrl,
      nextSecretEncrypted,
      nextExtra,
      nextEnabledFlag,
      input.actorUserId,
      input.actorUserId,
      nowTs,
      nowTs
    )
    this.writeAudit(
      input.organizationId,
      scopeWorkspaceId,
      input.actorUserId,
      'channel.created',
      input.providerId,
      {
        workspaceId: scopeWorkspaceId,
        enabled: Boolean(nextEnabledFlag),
        hasSecret: Boolean(nextSecretEncrypted),
        hasBaseUrl: Boolean(nextBaseUrl)
      },
      input.traceId
    )
    const row = db
      .prepare(`SELECT * FROM ai_channel_configs WHERE id = ?`)
      .get(id) as DbChannelConfigRow | null
    return normalizeConfigRow(row)
  }

  static resolve(providerId: string, context: ChannelRuntimeContext): ChannelResolvedConfig | null {
    this.assertProvider(providerId)
    const db = getLocalDb()
    const workspaceId = context.workspaceId?.trim() || null
    const row = (
      workspaceId
        ? db
            .prepare(
              `
        SELECT * FROM ai_channel_configs
        WHERE organization_id = ? AND provider_id = ? AND (workspace_id = ? OR workspace_id IS NULL)
        ORDER BY workspace_id DESC, updated_at DESC
        LIMIT 1
      `
            )
            .get(context.organizationId, providerId, workspaceId)
        : db
            .prepare(
              `
        SELECT * FROM ai_channel_configs
        WHERE organization_id = ? AND provider_id = ? AND workspace_id IS NULL
        LIMIT 1
      `
            )
            .get(context.organizationId, providerId)
    ) as DbChannelConfigRow | null

    if (!row) return null
    const secret = decryptSecret(String(row.secret_encrypted || ''))
    if (!secret || Number(row.enabled || 0) !== 1) return null
    return {
      providerId,
      baseUrl: String(row.base_url || ''),
      apiKey: secret,
      extra: (() => {
        try {
          return JSON.parse(String(row.extra_json || '{}'))
        } catch {
          return {}
        }
      })(),
      enabled: true,
      scope: row.workspace_id ? 'workspace' : 'organization'
    }
  }

  static getCapabilities(context?: ChannelRuntimeContext) {
    const empty = {
      models: {
        'veo-3.1': false,
        'kling-v1': false,
        'sora-preview': false,
        'luma-dream': false,
        'runway-gen3': false,
        'pika-1.5': false,
        'openai-compatible': false
      } as Record<string, boolean>,
      services: {
        tts: false,
        voiceMorph: false,
        spatialRender: false,
        vfx: false,
        lipSync: false,
        audioAnalysis: false,
        relighting: false,
        styleTransfer: false
      } as Record<string, boolean>
    }

    if (!context?.organizationId) return empty

    for (const providerId of MODEL_PROVIDER_IDS) {
      empty.models[providerId] = Boolean(this.resolve(providerId, context))
    }
    for (const providerId of SERVICE_PROVIDER_IDS) {
      empty.services[providerId] = Boolean(this.resolve(providerId, context))
    }
    return empty
  }

  static async testConfig(input: {
    providerId: string
    baseUrl?: string
    apiKey?: string
    extra?: Record<string, unknown>
    organizationId?: string
    workspaceId?: string
  }) {
    this.assertProvider(input.providerId)
    const organizationId = String(input.organizationId || '').trim()
    const workspaceId = String(input.workspaceId || '').trim()
    const resolved = organizationId
      ? this.resolve(input.providerId, {
          organizationId,
          workspaceId: workspaceId || undefined
        })
      : null
    const apiKey = String(input.apiKey || '').trim() || String(resolved?.apiKey || '').trim()
    const baseUrl = String(input.baseUrl || '').trim() || String(resolved?.baseUrl || '').trim()
    const extra = {
      ...(resolved?.extra && typeof resolved.extra === 'object' ? resolved.extra : {}),
      ...(input.extra && typeof input.extra === 'object' ? input.extra : {})
    }
    if (!apiKey) return { success: false, message: 'API Key 不能为空' }
    if (baseUrl) {
      try {
        const url = new URL(baseUrl)
        if (!/^https?:$/.test(url.protocol)) {
          return { success: false, message: 'Base URL 仅支持 http/https' }
        }
      } catch {
        return { success: false, message: 'Base URL 格式不正确' }
      }
    }
    try {
      this.normalizeExtra(input.providerId, extra)
    } catch (error: unknown) {
      return {
        success: false,
        message: resolveErrorMessage(error, 'extra 参数校验失败')
      }
    }
    return {
      success: true,
      message: resolved
        ? `格式校验通过（已使用${resolved.scope === 'workspace' ? '工作区' : '组织'}级已保存配置）`
        : '格式校验通过，可保存后用于实际请求'
    }
  }

  private static writeAudit(
    organizationId: string,
    workspaceId: string | null,
    actorUserId: string,
    action: string,
    providerId: string,
    detail: Record<string, unknown>,
    traceId?: string
  ) {
    const normalizedTraceId = String(traceId || '').trim() || null
    getLocalDb()
      .prepare(
        `
      INSERT INTO ai_channel_audits (
        id, organization_id, workspace_id, actor_user_id, action, provider_id, detail_json, trace_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        `chna_${crypto.randomUUID()}`,
        organizationId,
        workspaceId,
        actorUserId,
        action,
        providerId,
        JSON.stringify(detail || {}),
        normalizedTraceId,
        now()
      )
  }
}
