import type { CreativeFeedbackPayload, CreativeRun, CreativeScene } from '@veomuse/shared'
import { getLocalDb } from './LocalDatabaseService'

const toIso = () => new Date().toISOString()
const normalizeOrganizationId = (value: unknown) => {
  const normalized = String(value || '').trim()
  return normalized || 'org_default'
}

const parseJson = <T>(raw: unknown, fallback: T): T => {
  try {
    if (typeof raw !== 'string') return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

interface StoryboardSceneRow {
  id: string
  run_id: string
  order_idx: number
  title: string
  video_prompt: string
  audio_prompt: string
  voiceover_text: string
  duration: number
  status: string
  revision?: number
  last_feedback?: string
  generation_meta_json?: unknown
  created_at: string
  updated_at: string
}

interface CreativeRunRow {
  id: string
  script: string
  style: string
  status: string
  version?: number
  parent_run_id?: string | null
  quality_score?: number
  notes_json?: unknown
  created_at: string
  updated_at: string
}

const sceneFromRow = (row: StoryboardSceneRow): CreativeScene => {
  const status: CreativeScene['status'] =
    row.status === 'draft' ? 'draft' : row.status === 'regenerated' ? 'regenerated' : 'generated'
  return {
    id: row.id,
    runId: row.run_id,
    order: row.order_idx,
    title: row.title,
    videoPrompt: row.video_prompt,
    audioPrompt: row.audio_prompt,
    voiceoverText: row.voiceover_text,
    duration: row.duration,
    status,
    revision: row.revision || 1,
    lastFeedback: row.last_feedback || '',
    generationMeta: parseJson<Record<string, unknown>>(row.generation_meta_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

const runFromRow = (row: CreativeRunRow, scenes: CreativeScene[]): CreativeRun => {
  const status: CreativeRun['status'] =
    row.status === 'draft' ? 'draft' : row.status === 'completed' ? 'completed' : 'generated'
  return {
    id: row.id,
    script: row.script,
    style: row.style,
    status,
    version: row.version || 1,
    parentRunId: row.parent_run_id || null,
    qualityScore: Number(row.quality_score || 0),
    notes: parseJson<Record<string, unknown>>(row.notes_json, {}),
    scenes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

const parseScenesFromScript = (script: string) => {
  const chunks = script
    .split(/\n|。|\.|!|！|\?|？/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 8)
  const source = chunks.length ? chunks : [script.trim() || '默认场景']
  return source.map((line, index) => ({
    order: index + 1,
    title: `分镜 ${index + 1}`,
    videoPrompt: line,
    audioPrompt: `环境音与情绪配乐：${line}`,
    voiceoverText: line,
    duration: Math.max(3, Math.min(12, Math.round(line.length / 8)))
  }))
}

export class CreativePipelineService {
  private static insertFeedbackEvent(
    organizationId: string,
    runId: string,
    scope: 'run' | 'scene',
    feedback: Record<string, unknown>,
    sceneId?: string
  ) {
    getLocalDb()
      .prepare(
        `
      INSERT INTO creative_feedback_events (id, organization_id, run_id, scene_id, scope, feedback_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        `feedback_${crypto.randomUUID()}`,
        organizationId,
        runId,
        sceneId || null,
        scope,
        JSON.stringify(feedback),
        toIso()
      )
  }

  private static cloneRunWithScenes(
    runId: string,
    organizationId: string,
    runFeedback: string = ''
  ) {
    const base = this.getRun(runId, organizationId)
    if (!base) return null

    const nextRunId = `run_${crypto.randomUUID()}`
    const createdAt = toIso()
    const notes = {
      ...(base.notes || {}),
      inheritedFromRunId: base.id,
      versionReason: runFeedback || 'creative-feedback',
      createdBy: 'feedback-loop'
    }

    getLocalDb()
      .prepare(
        `
      INSERT INTO creative_runs (
        id, organization_id, script, style, status, version, parent_run_id, quality_score, notes_json, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        nextRunId,
        organizationId,
        base.script,
        base.style,
        'generated',
        (base.version || 1) + 1,
        base.id,
        base.qualityScore || 0,
        JSON.stringify(notes),
        createdAt,
        createdAt
      )

    const insertScene = getLocalDb().prepare(`
      INSERT INTO storyboard_scenes (
        id, organization_id, run_id, order_idx, title, video_prompt, audio_prompt, voiceover_text, duration, status,
        revision, last_feedback, generation_meta_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    base.scenes.forEach((scene) => {
      const inheritedMeta =
        scene.generationMeta && typeof scene.generationMeta === 'object' ? scene.generationMeta : {}
      insertScene.run(
        `scene_${crypto.randomUUID()}`,
        organizationId,
        nextRunId,
        scene.order,
        scene.title,
        scene.videoPrompt,
        scene.audioPrompt,
        scene.voiceoverText,
        scene.duration,
        scene.status,
        scene.revision || 1,
        scene.lastFeedback || '',
        JSON.stringify({
          ...inheritedMeta,
          sourceSceneId: scene.id,
          sourceRunId: base.id
        }),
        createdAt,
        createdAt
      )
    })

    return this.getRun(nextRunId, organizationId)
  }

  static createRun(
    script: string,
    style: string = 'cinematic',
    context?: Record<string, unknown>
  ): CreativeRun {
    const runId = `run_${crypto.randomUUID()}`
    const createdAt = toIso()
    const organizationId = normalizeOrganizationId(context?.organizationId)
    const notes = context && Object.keys(context).length > 0 ? { context } : {}
    getLocalDb()
      .prepare(
        `
      INSERT INTO creative_runs (
        id, organization_id, script, style, status, version, parent_run_id, quality_score, notes_json, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        runId,
        organizationId,
        script,
        style,
        'generated',
        1,
        null,
        0,
        JSON.stringify(notes),
        createdAt,
        createdAt
      )

    const insertScene = getLocalDb().prepare(`
      INSERT INTO storyboard_scenes (
        id, organization_id, run_id, order_idx, title, video_prompt, audio_prompt, voiceover_text, duration, status,
        revision, last_feedback, generation_meta_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const scenes = parseScenesFromScript(script).map((scene) => {
      const id = `scene_${crypto.randomUUID()}`
      insertScene.run(
        id,
        organizationId,
        runId,
        scene.order,
        scene.title,
        scene.videoPrompt,
        scene.audioPrompt,
        scene.voiceoverText,
        scene.duration,
        'generated',
        1,
        '',
        JSON.stringify({ source: 'script-parser', style }),
        createdAt,
        createdAt
      )
      return {
        id,
        runId,
        order: scene.order,
        title: scene.title,
        videoPrompt: scene.videoPrompt,
        audioPrompt: scene.audioPrompt,
        voiceoverText: scene.voiceoverText,
        duration: scene.duration,
        status: 'generated' as const,
        revision: 1,
        lastFeedback: '',
        generationMeta: { source: 'script-parser', style },
        createdAt,
        updatedAt: createdAt
      }
    })

    return {
      id: runId,
      script,
      style,
      status: 'generated',
      version: 1,
      parentRunId: null,
      qualityScore: 0,
      notes,
      scenes,
      createdAt,
      updatedAt: createdAt
    }
  }

  static getRun(runId: string, organizationId: string = 'org_default'): CreativeRun | null {
    const orgId = normalizeOrganizationId(organizationId)
    const run = getLocalDb()
      .prepare(
        `
      SELECT * FROM creative_runs WHERE id = ? AND organization_id = ? LIMIT 1
    `
      )
      .get(runId, orgId) as CreativeRunRow | null
    if (!run) return null
    const sceneRows = getLocalDb()
      .prepare(
        `
        SELECT * FROM storyboard_scenes
        WHERE run_id = ? AND organization_id = ?
        ORDER BY order_idx ASC
      `
      )
      .all(runId, orgId) as StoryboardSceneRow[]
    const scenes = sceneRows.map(sceneFromRow)
    return runFromRow(run, scenes)
  }

  static getRunVersions(runId: string, organizationId: string = 'org_default'): CreativeRun[] {
    const orgId = normalizeOrganizationId(organizationId)
    const base = this.getRun(runId, orgId)
    if (!base) return []
    let rootId = base.id
    let currentParentId = base.parentRunId
    let guard = 0
    while (currentParentId && guard < 128) {
      guard += 1
      const parent = getLocalDb()
        .prepare(
          `
          SELECT id, parent_run_id
          FROM creative_runs
          WHERE id = ? AND organization_id = ?
          LIMIT 1
        `
        )
        .get(currentParentId, orgId) as { id: string; parent_run_id: string | null } | null
      if (!parent) break
      rootId = parent.id
      currentParentId = parent.parent_run_id
    }

    const rows = getLocalDb()
      .prepare(
        `
        WITH RECURSIVE run_chain(id) AS (
          SELECT id FROM creative_runs WHERE id = ? AND organization_id = ?
          UNION ALL
          SELECT child.id
          FROM creative_runs child
          JOIN run_chain parent ON child.parent_run_id = parent.id
          WHERE child.organization_id = ?
        )
        SELECT *
        FROM creative_runs
        WHERE id IN (SELECT id FROM run_chain) AND organization_id = ?
        ORDER BY version ASC, created_at ASC
      `
      )
      .all(rootId, orgId, orgId, orgId) as Array<{ id: string }>
    return rows
      .map((row) => this.getRun(String((row as { id?: unknown }).id || ''), orgId))
      .filter((item): item is CreativeRun => Boolean(item))
  }

  static regenerateScene(
    runId: string,
    sceneId: string,
    feedback: string = '',
    organizationId: string = 'org_default'
  ) {
    const orgId = normalizeOrganizationId(organizationId)
    const row = getLocalDb()
      .prepare(
        `
        SELECT * FROM storyboard_scenes
        WHERE id = ? AND run_id = ? AND organization_id = ?
      `
      )
      .get(sceneId, runId, orgId) as StoryboardSceneRow | null
    if (!row) return null

    const updatedAt = toIso()
    const normalizedFeedback = feedback.trim() || '强化视觉冲击与镜头层次'
    const enhancedPrompt = `${row.video_prompt}\n\n创意反馈：${normalizedFeedback}`
    const audioPrompt = `${row.audio_prompt}\n\n补充：节奏与情绪变化更明显`
    const generationMeta = parseJson<Record<string, unknown>>(row.generation_meta_json, {})

    getLocalDb()
      .prepare(
        `
      UPDATE storyboard_scenes
      SET video_prompt = ?, audio_prompt = ?, status = ?, revision = ?, last_feedback = ?, generation_meta_json = ?, updated_at = ?
      WHERE id = ? AND run_id = ? AND organization_id = ?
    `
      )
      .run(
        enhancedPrompt,
        audioPrompt,
        'regenerated',
        (row.revision || 1) + 1,
        normalizedFeedback,
        JSON.stringify({
          ...generationMeta,
          source: 'scene-regenerate',
          regeneratedAt: updatedAt
        }),
        updatedAt,
        sceneId,
        runId,
        orgId
      )

    getLocalDb()
      .prepare(
        `
      UPDATE creative_runs SET status = ?, updated_at = ? WHERE id = ? AND organization_id = ?
    `
      )
      .run('generated', updatedAt, runId, orgId)

    this.insertFeedbackEvent(
      orgId,
      runId,
      'scene',
      {
        feedback: normalizedFeedback,
        sceneId
      },
      sceneId
    )

    return this.getRun(runId, orgId)
  }

  static applyFeedback(
    runId: string,
    payload: CreativeFeedbackPayload,
    organizationId: string = 'org_default'
  ) {
    const orgId = normalizeOrganizationId(organizationId)
    const nextRun = this.cloneRunWithScenes(runId, orgId, payload.runFeedback || '')
    if (!nextRun) return null

    const updatedAt = toIso()

    if (payload.runFeedback?.trim()) {
      this.insertFeedbackEvent(orgId, nextRun.id, 'run', {
        feedback: payload.runFeedback.trim()
      })
      const notes = {
        ...(nextRun.notes || {}),
        runFeedback: payload.runFeedback.trim()
      }
      getLocalDb()
        .prepare(
          `
        UPDATE creative_runs SET notes_json = ?, updated_at = ? WHERE id = ?
      `
        )
        .run(JSON.stringify(notes), updatedAt, nextRun.id)
    }

    const sceneFeedbacks = Array.isArray(payload.sceneFeedbacks)
      ? payload.sceneFeedbacks.filter(
          (item) => item && item.sceneId && item.feedback && item.feedback.trim()
        )
      : []

    sceneFeedbacks.forEach((item) => {
      let row = getLocalDb()
        .prepare(
          `
          SELECT * FROM storyboard_scenes
          WHERE id = ? AND run_id = ? AND organization_id = ?
        `
        )
        .get(item.sceneId, nextRun.id, orgId) as StoryboardSceneRow | null
      if (!row) {
        const rows = getLocalDb()
          .prepare(
            `
            SELECT * FROM storyboard_scenes
            WHERE run_id = ? AND organization_id = ?
          `
          )
          .all(nextRun.id, orgId) as StoryboardSceneRow[]
        row =
          rows.find((candidate) => {
            const meta = parseJson<Record<string, unknown>>(candidate.generation_meta_json, {})
            return meta.sourceSceneId === item.sceneId
          }) || null
      }
      if (!row) return
      const meta = parseJson<Record<string, unknown>>(row.generation_meta_json, {})
      const nextVideoPrompt = `${row.video_prompt}\n\n反馈优化：${item.feedback.trim()}`
      getLocalDb()
        .prepare(
          `
        UPDATE storyboard_scenes
        SET video_prompt = ?, status = ?, revision = ?, last_feedback = ?, generation_meta_json = ?, updated_at = ?
        WHERE id = ? AND run_id = ? AND organization_id = ?
      `
        )
        .run(
          nextVideoPrompt,
          'regenerated',
          (row.revision || 1) + 1,
          item.feedback.trim(),
          JSON.stringify({
            ...meta,
            source: 'run-feedback',
            feedbackAppliedAt: updatedAt
          }),
          updatedAt,
          row.id,
          nextRun.id,
          orgId
        )

      this.insertFeedbackEvent(
        orgId,
        nextRun.id,
        'scene',
        {
          feedback: item.feedback.trim(),
          sceneId: row.id,
          sourceSceneId: item.sceneId
        },
        row.id
      )
    })

    getLocalDb()
      .prepare(
        `
      UPDATE creative_runs SET status = ?, updated_at = ? WHERE id = ? AND organization_id = ?
    `
      )
      .run('generated', updatedAt, nextRun.id, orgId)

    return {
      previousRunId: runId,
      run: this.getRun(nextRun.id, orgId)
    }
  }

  static commitRun(
    runId: string,
    options?: { qualityScore?: number; notes?: Record<string, unknown> },
    organizationId: string = 'org_default'
  ) {
    const orgId = normalizeOrganizationId(organizationId)
    const current = this.getRun(runId, orgId)
    if (!current) return null
    const updatedAt = toIso()
    const qualityScore =
      options?.qualityScore === undefined
        ? current.qualityScore || 0
        : Math.max(0, Math.min(1, Number(options.qualityScore)))
    const notes = {
      ...(current.notes || {}),
      ...(options?.notes || {}),
      committedAt: updatedAt
    }

    getLocalDb()
      .prepare(
        `
      UPDATE creative_runs
      SET status = ?, quality_score = ?, notes_json = ?, updated_at = ?
      WHERE id = ? AND organization_id = ?
    `
      )
      .run('completed', qualityScore, JSON.stringify(notes), updatedAt, runId, orgId)

    this.insertFeedbackEvent(orgId, runId, 'run', {
      type: 'commit',
      qualityScore
    })

    return this.getRun(runId, orgId)
  }
}
