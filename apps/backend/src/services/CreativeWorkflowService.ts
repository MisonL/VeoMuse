import type {
  AssetReuseRecord,
  BatchJob,
  BatchJobItem,
  CursorPageMeta,
  PromptWorkflow,
  PromptWorkflowRun
} from '@veomuse/shared'
import { getLocalDb } from './LocalDatabaseService'

const now = () => new Date().toISOString()

const parseRecord = (value: string | null | undefined): Record<string, unknown> => {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, unknown>
  } catch {
    return {}
  }
}

interface StableCursorPayload {
  createdAt: string
  id: string | null
}

const encodeStableCursor = (
  createdAt: string | null | undefined,
  id: string | null | undefined
) => {
  const normalizedCreatedAt = String(createdAt || '').trim()
  if (!normalizedCreatedAt) return null
  const normalizedId = String(id || '').trim()
  if (!normalizedId) return normalizedCreatedAt
  return `${normalizedCreatedAt}|${normalizedId}`
}

const decodeStableCursor = (cursor: string | null | undefined): StableCursorPayload | null => {
  const normalized = String(cursor || '').trim()
  if (!normalized) return null
  const delimiterIndex = normalized.indexOf('|')
  if (delimiterIndex < 0) {
    return {
      createdAt: normalized,
      id: null
    }
  }

  const createdAt = normalized.slice(0, delimiterIndex).trim()
  const id = normalized.slice(delimiterIndex + 1).trim()
  if (!createdAt) return null
  return {
    createdAt,
    id: id || null
  }
}

const toPromptWorkflow = (row: any): PromptWorkflow => ({
  id: String(row.id),
  organizationId: String(row.organization_id || 'org_default'),
  name: String(row.name || ''),
  description: String(row.description || ''),
  definition: parseRecord(row.definition_json),
  createdBy: String(row.created_by || 'system'),
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at)
})

const toPromptWorkflowRun = (row: any): PromptWorkflowRun => ({
  id: String(row.id),
  workflowId: String(row.workflow_id),
  organizationId: String(row.organization_id || 'org_default'),
  triggerType: String(row.trigger_type || 'manual'),
  status: row.status === 'failed' ? 'failed' : row.status === 'completed' ? 'completed' : 'queued',
  input: parseRecord(row.input_json),
  output: parseRecord(row.output_json),
  errorMessage: row.error_message ? String(row.error_message) : null,
  startedAt: String(row.started_at),
  completedAt: row.completed_at ? String(row.completed_at) : null,
  createdBy: String(row.created_by || 'system'),
  createdAt: String(row.created_at)
})

const toBatchJob = (row: any, items: BatchJobItem[]): BatchJob => ({
  id: String(row.id),
  organizationId: String(row.organization_id || 'org_default'),
  workflowRunId: row.workflow_run_id ? String(row.workflow_run_id) : null,
  jobType: String(row.job_type || 'creative.batch'),
  status: row.status === 'failed' ? 'failed' : row.status === 'completed' ? 'completed' : 'queued',
  totalItems: Number(row.total_items || 0),
  completedItems: Number(row.completed_items || 0),
  failedItems: Number(row.failed_items || 0),
  payload: parseRecord(row.payload_json),
  createdBy: String(row.created_by || 'system'),
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
  items
})

const toBatchJobItem = (row: any): BatchJobItem => ({
  id: String(row.id),
  jobId: String(row.job_id),
  organizationId: String(row.organization_id || 'org_default'),
  itemKey: String(row.item_key),
  status: row.status === 'failed' ? 'failed' : row.status === 'completed' ? 'completed' : 'queued',
  input: parseRecord(row.input_json),
  output: parseRecord(row.output_json),
  errorMessage: row.error_message ? String(row.error_message) : null,
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at)
})

const toAssetReuseRecord = (row: any): AssetReuseRecord => ({
  id: String(row.id),
  organizationId: String(row.organization_id || 'org_default'),
  assetId: String(row.asset_id),
  sourceProjectId: row.source_project_id ? String(row.source_project_id) : null,
  targetProjectId: row.target_project_id ? String(row.target_project_id) : null,
  reusedBy: String(row.reused_by || 'system'),
  context: parseRecord(row.context_json),
  createdAt: String(row.created_at)
})

const renderTemplate = (template: string, input: Record<string, unknown>) => {
  return template.replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (_full, key: string) => {
    const value = input[key]
    if (value === null || value === undefined) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    try {
      return JSON.stringify(value)
    } catch {
      return ''
    }
  })
}

const buildWorkflowOutput = (
  definition: Record<string, unknown>,
  input: Record<string, unknown>
) => {
  const template = typeof definition.template === 'string' ? definition.template : ''
  if (!template.trim()) {
    return {
      prompt: '',
      usedTemplate: false,
      input,
      definition
    }
  }
  return {
    prompt: renderTemplate(template, input),
    usedTemplate: true,
    input,
    definition
  }
}

export interface PromptWorkflowCreateInput {
  organizationId: string
  name: string
  description?: string
  definition?: Record<string, unknown>
  createdBy: string
}

export interface PromptWorkflowRunInput {
  organizationId?: string
  triggerType?: string
  input?: Record<string, unknown>
  createdBy: string
}

export interface PromptWorkflowRunListQuery {
  organizationId: string
  workflowId: string
  limit?: number
  cursor?: string
}

export interface PromptWorkflowRunPageResult {
  runs: PromptWorkflowRun[]
  page: CursorPageMeta
}

export interface BatchJobCreateInput {
  organizationId: string
  workflowRunId?: string | null
  jobType: string
  payload?: Record<string, unknown>
  items?: Array<{ itemKey?: string; input?: Record<string, unknown> }>
  createdBy: string
}

export interface BatchJobListQuery {
  organizationId: string
  workflowRunId?: string
  jobType?: string
  status?: BatchJob['status']
  limit?: number
  cursor?: string
}

export interface BatchJobPageResult {
  jobs: BatchJob[]
  page: CursorPageMeta
}

export interface AssetReuseCreateInput {
  organizationId: string
  assetId: string
  sourceProjectId?: string | null
  targetProjectId?: string | null
  reusedBy: string
  context?: Record<string, unknown>
}

export interface AssetReuseQuery {
  organizationId?: string
  assetId?: string
  sourceProjectId?: string
  targetProjectId?: string
  limit?: number
  offset?: number
}

export class CreativeWorkflowService {
  static createPromptWorkflow(input: PromptWorkflowCreateInput): PromptWorkflow {
    const organizationId = input.organizationId.trim() || 'org_default'
    const name = input.name.trim()
    if (!name) {
      throw new Error('工作流名称不能为空')
    }

    const id = `pwf_${crypto.randomUUID()}`
    const timestamp = now()
    const definition =
      input.definition && typeof input.definition === 'object' && !Array.isArray(input.definition)
        ? input.definition
        : {}

    getLocalDb()
      .prepare(
        `
      INSERT INTO prompt_workflows (
        id, organization_id, name, description, definition_json, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        id,
        organizationId,
        name,
        String(input.description || ''),
        JSON.stringify(definition),
        input.createdBy.trim() || 'system',
        timestamp,
        timestamp
      )

    const row = getLocalDb().prepare(`SELECT * FROM prompt_workflows WHERE id = ? LIMIT 1`).get(id)
    if (!row) throw new Error('工作流创建失败')
    return toPromptWorkflow(row)
  }

  static listPromptWorkflows(organizationId: string, limit: number = 50): PromptWorkflow[] {
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(200, Math.floor(limit)) : 50
    return getLocalDb()
      .prepare(
        `
      SELECT * FROM prompt_workflows
      WHERE organization_id = ?
      ORDER BY updated_at DESC, created_at DESC
      LIMIT ${safeLimit}
    `
      )
      .all(organizationId)
      .map(toPromptWorkflow)
  }

  static runPromptWorkflow(workflowId: string, input: PromptWorkflowRunInput): PromptWorkflowRun {
    const normalizedWorkflowId = workflowId.trim()
    if (!normalizedWorkflowId) {
      throw new Error('workflowId 不能为空')
    }

    const workflowRow = getLocalDb()
      .prepare(
        `
      SELECT * FROM prompt_workflows
      WHERE id = ?
      LIMIT 1
    `
      )
      .get(normalizedWorkflowId)

    if (!workflowRow) {
      throw new Error('工作流不存在')
    }

    const workflow = toPromptWorkflow(workflowRow)
    const expectedOrganizationId = (input.organizationId || '').trim()
    if (expectedOrganizationId && expectedOrganizationId !== workflow.organizationId) {
      throw new Error('无权执行该工作流')
    }
    const id = `pwfr_${crypto.randomUUID()}`
    const timestamp = now()
    const normalizedInput =
      input.input && typeof input.input === 'object' && !Array.isArray(input.input)
        ? input.input
        : {}
    const output = buildWorkflowOutput(workflow.definition, normalizedInput)

    getLocalDb()
      .prepare(
        `
      INSERT INTO prompt_workflow_runs (
        id, workflow_id, organization_id, trigger_type, status,
        input_json, output_json, error_message, started_at, completed_at, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        id,
        workflow.id,
        workflow.organizationId,
        (input.triggerType || 'manual').trim() || 'manual',
        'completed',
        JSON.stringify(normalizedInput),
        JSON.stringify(output),
        null,
        timestamp,
        timestamp,
        input.createdBy.trim() || 'system',
        timestamp
      )

    const row = getLocalDb()
      .prepare(`SELECT * FROM prompt_workflow_runs WHERE id = ? LIMIT 1`)
      .get(id)
    if (!row) throw new Error('工作流执行失败')
    return toPromptWorkflowRun(row)
  }

  static listPromptWorkflowRuns(input: PromptWorkflowRunListQuery): PromptWorkflowRunPageResult {
    const organizationId = input.organizationId.trim() || 'org_default'
    const workflowId = input.workflowId.trim()
    if (!workflowId) {
      throw new Error('workflowId 不能为空')
    }

    const workflow = getLocalDb()
      .prepare(
        `
      SELECT id, organization_id
      FROM prompt_workflows
      WHERE id = ?
      LIMIT 1
    `
      )
      .get(workflowId) as {
      id?: string
      organization_id?: string
    } | null

    if (!workflow?.id) {
      throw new Error('工作流不存在')
    }
    if ((workflow.organization_id || 'org_default') !== organizationId) {
      throw new Error('无权访问该工作流')
    }

    const safeLimit =
      Number.isFinite(input.limit) && (input.limit || 0) > 0
        ? Math.min(100, Math.floor(input.limit as number))
        : 20
    const decodedCursor = decodeStableCursor(input.cursor)
    const queryLimit = safeLimit + 1

    const rows: any[] =
      decodedCursor && decodedCursor.id !== null
        ? (getLocalDb()
            .prepare(
              `
          SELECT * FROM prompt_workflow_runs
          WHERE workflow_id = ? AND organization_id = ?
            AND (
              created_at < ?
              OR (created_at = ? AND id < ?)
            )
          ORDER BY created_at DESC, id DESC
          LIMIT ${queryLimit}
        `
            )
            .all(
              workflowId,
              organizationId,
              decodedCursor.createdAt,
              decodedCursor.createdAt,
              decodedCursor.id
            ) as any[])
        : decodedCursor
          ? (getLocalDb()
              .prepare(
                `
          SELECT * FROM prompt_workflow_runs
          WHERE workflow_id = ? AND organization_id = ? AND created_at < ?
          ORDER BY created_at DESC, id DESC
          LIMIT ${queryLimit}
        `
              )
              .all(workflowId, organizationId, decodedCursor.createdAt) as any[])
          : (getLocalDb()
              .prepare(
                `
          SELECT * FROM prompt_workflow_runs
          WHERE workflow_id = ? AND organization_id = ?
          ORDER BY created_at DESC, id DESC
          LIMIT ${queryLimit}
        `
              )
              .all(workflowId, organizationId) as any[])

    const hasMore = rows.length > safeLimit
    const pageRows = hasMore ? rows.slice(0, safeLimit) : rows
    const runs = pageRows.map(toPromptWorkflowRun)
    const nextCursor = hasMore
      ? encodeStableCursor(
          pageRows[pageRows.length - 1]?.created_at,
          pageRows[pageRows.length - 1]?.id
        )
      : null

    return {
      runs,
      page: {
        limit: safeLimit,
        hasMore,
        nextCursor: nextCursor || null
      }
    }
  }

  static createBatchJob(input: BatchJobCreateInput): BatchJob {
    const organizationId = input.organizationId.trim() || 'org_default'
    const jobType = input.jobType.trim()
    if (!jobType) {
      throw new Error('jobType 不能为空')
    }

    const nowTs = now()
    const jobId = `batch_${crypto.randomUUID()}`

    if (input.workflowRunId?.trim()) {
      const runRow = getLocalDb()
        .prepare(
          `
        SELECT organization_id
        FROM prompt_workflow_runs
        WHERE id = ?
        LIMIT 1
      `
        )
        .get(input.workflowRunId.trim()) as { organization_id?: string } | null
      if (!runRow) {
        throw new Error('workflowRun 不存在')
      }
      if ((runRow.organization_id || 'org_default') !== organizationId) {
        throw new Error('workflowRun 不属于当前组织')
      }
    }

    const normalizedItems = Array.isArray(input.items)
      ? input.items.map((item, index) => ({
          itemKey: String(item?.itemKey || `item-${index + 1}`).trim() || `item-${index + 1}`,
          input:
            item?.input && typeof item.input === 'object' && !Array.isArray(item.input)
              ? item.input
              : {}
        }))
      : []

    const insertTx = getLocalDb().transaction(() => {
      getLocalDb()
        .prepare(
          `
        INSERT INTO batch_jobs (
          id, organization_id, workflow_run_id, job_type, status,
          total_items, completed_items, failed_items, payload_json, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          jobId,
          organizationId,
          input.workflowRunId ? input.workflowRunId.trim() || null : null,
          jobType,
          normalizedItems.length === 0 ? 'completed' : 'queued',
          normalizedItems.length,
          normalizedItems.length === 0 ? 0 : 0,
          0,
          JSON.stringify(input.payload || {}),
          input.createdBy.trim() || 'system',
          nowTs,
          nowTs
        )

      const insertItem = getLocalDb().prepare(`
        INSERT INTO batch_job_items (
          id, job_id, organization_id, item_key, status,
          input_json, output_json, error_message, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      for (const item of normalizedItems) {
        insertItem.run(
          `bitem_${crypto.randomUUID()}`,
          jobId,
          organizationId,
          item.itemKey,
          'queued',
          JSON.stringify(item.input),
          '{}',
          null,
          nowTs,
          nowTs
        )
      }
    })

    insertTx()

    const job = this.getBatchJob(jobId)
    if (!job) {
      throw new Error('批处理任务创建失败')
    }
    return job
  }

  static listBatchJobs(input: BatchJobListQuery): BatchJobPageResult {
    const organizationId = input.organizationId.trim() || 'org_default'
    const safeLimit =
      Number.isFinite(input.limit) && (input.limit || 0) > 0
        ? Math.min(100, Math.floor(input.limit as number))
        : 20
    const decodedCursor = decodeStableCursor(input.cursor)
    const queryLimit = safeLimit + 1

    const whereParts: string[] = ['organization_id = ?']
    const params: string[] = [organizationId]

    const workflowRunId = String(input.workflowRunId || '').trim()
    if (workflowRunId) {
      whereParts.push('workflow_run_id = ?')
      params.push(workflowRunId)
    }

    const jobType = String(input.jobType || '').trim()
    if (jobType) {
      whereParts.push('job_type = ?')
      params.push(jobType)
    }

    const status = String(input.status || '').trim()
    if (status === 'queued' || status === 'completed' || status === 'failed') {
      whereParts.push('status = ?')
      params.push(status)
    }

    if (decodedCursor && decodedCursor.id !== null) {
      whereParts.push('(created_at < ? OR (created_at = ? AND id < ?))')
      params.push(decodedCursor.createdAt, decodedCursor.createdAt, decodedCursor.id)
    } else if (decodedCursor) {
      whereParts.push('created_at < ?')
      params.push(decodedCursor.createdAt)
    }

    const rows = getLocalDb()
      .prepare(
        `
      SELECT * FROM batch_jobs
      WHERE ${whereParts.join(' AND ')}
      ORDER BY created_at DESC, id DESC
      LIMIT ${queryLimit}
    `
      )
      .all(...params) as any[]

    const hasMore = rows.length > safeLimit
    const pageRows = hasMore ? rows.slice(0, safeLimit) : rows

    const jobIds = pageRows.map((row) => String(row.id)).filter(Boolean)
    const itemsByJobId = new Map<string, BatchJobItem[]>()

    if (jobIds.length > 0) {
      const placeholders = jobIds.map(() => '?').join(', ')
      const itemRows = getLocalDb()
        .prepare(
          `
        SELECT * FROM batch_job_items
        WHERE job_id IN (${placeholders})
        ORDER BY created_at ASC
      `
        )
        .all(...jobIds) as any[]

      for (const itemRow of itemRows) {
        const item = toBatchJobItem(itemRow)
        const existing = itemsByJobId.get(item.jobId)
        if (existing) {
          existing.push(item)
        } else {
          itemsByJobId.set(item.jobId, [item])
        }
      }
    }

    const jobs = pageRows.map((row) => toBatchJob(row, itemsByJobId.get(String(row.id)) || []))

    const nextCursor = hasMore
      ? encodeStableCursor(
          pageRows[pageRows.length - 1]?.created_at,
          pageRows[pageRows.length - 1]?.id
        )
      : null

    return {
      jobs,
      page: {
        limit: safeLimit,
        hasMore,
        nextCursor: nextCursor || null
      }
    }
  }

  static getBatchJob(jobId: string): BatchJob | null {
    const normalizedJobId = jobId.trim()
    if (!normalizedJobId) return null

    const row = getLocalDb()
      .prepare(
        `
      SELECT * FROM batch_jobs
      WHERE id = ?
      LIMIT 1
    `
      )
      .get(normalizedJobId)

    if (!row) return null

    const items = getLocalDb()
      .prepare(
        `
      SELECT * FROM batch_job_items
      WHERE job_id = ?
      ORDER BY created_at ASC
    `
      )
      .all(normalizedJobId)
      .map(toBatchJobItem)

    return toBatchJob(row, items)
  }

  static recordAssetReuse(input: AssetReuseCreateInput): AssetReuseRecord {
    const assetId = input.assetId.trim()
    if (!assetId) {
      throw new Error('assetId 不能为空')
    }

    const id = `reuse_${crypto.randomUUID()}`
    const timestamp = now()

    getLocalDb()
      .prepare(
        `
      INSERT INTO asset_reuse_records (
        id, organization_id, asset_id, source_project_id, target_project_id,
        reused_by, context_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        id,
        input.organizationId.trim() || 'org_default',
        assetId,
        input.sourceProjectId ? input.sourceProjectId.trim() || null : null,
        input.targetProjectId ? input.targetProjectId.trim() || null : null,
        input.reusedBy.trim() || 'system',
        JSON.stringify(input.context || {}),
        timestamp
      )

    const row = getLocalDb()
      .prepare(`SELECT * FROM asset_reuse_records WHERE id = ? LIMIT 1`)
      .get(id)
    if (!row) throw new Error('资产复用记录创建失败')
    return toAssetReuseRecord(row)
  }

  static listAssetReuseHistory(query: AssetReuseQuery = {}): AssetReuseRecord[] {
    const whereParts: string[] = []
    const params: string[] = []

    const organizationId = (query.organizationId || '').trim()
    if (organizationId) {
      whereParts.push('organization_id = ?')
      params.push(organizationId)
    }

    if (query.assetId?.trim()) {
      whereParts.push('asset_id = ?')
      params.push(query.assetId.trim())
    }

    if (query.sourceProjectId?.trim()) {
      whereParts.push('source_project_id = ?')
      params.push(query.sourceProjectId.trim())
    }

    if (query.targetProjectId?.trim()) {
      whereParts.push('target_project_id = ?')
      params.push(query.targetProjectId.trim())
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : ''

    const safeLimit =
      Number.isFinite(query.limit) && (query.limit || 0) > 0
        ? Math.min(200, Math.floor(query.limit as number))
        : 50
    const safeOffset =
      Number.isFinite(query.offset) && (query.offset || 0) >= 0
        ? Math.floor(query.offset as number)
        : 0

    return getLocalDb()
      .prepare(
        `
      SELECT * FROM asset_reuse_records
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${safeLimit}
      OFFSET ${safeOffset}
    `
      )
      .all(...params)
      .map(toAssetReuseRecord)
  }
}
