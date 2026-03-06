import { Database } from 'bun:sqlite'

const hasColumn = (db: Database, table: string, column: string) => {
  const rows = db.prepare(`PRAGMA table_info(${table});`).all() as Array<{ name: string }>
  return rows.some((row) => row.name === column)
}

const ensureColumn = (db: Database, table: string, column: string, ddl: string) => {
  if (hasColumn(db, table, column)) return
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl};`)
}

export const createDbConnection = (dbPath: string) => {
  const db = new Database(dbPath, { create: true })
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec('PRAGMA foreign_keys = ON;')
  db.exec('PRAGMA synchronous = NORMAL;')
  return db
}

export const migrate = (db: Database) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS organization_members (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      created_at TEXT NOT NULL,
      FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS organization_quotas (
      organization_id TEXT PRIMARY KEY,
      request_limit INTEGER NOT NULL DEFAULT 0,
      storage_limit_bytes INTEGER NOT NULL DEFAULT 0,
      concurrency_limit INTEGER NOT NULL DEFAULT 0,
      updated_by TEXT NOT NULL DEFAULT 'system',
      updated_at TEXT NOT NULL,
      FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS organization_usage_counters (
      organization_id TEXT PRIMARY KEY,
      request_count INTEGER NOT NULL DEFAULT 0,
      storage_bytes INTEGER NOT NULL DEFAULT 0,
      last_request_at TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_channel_configs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      workspace_id TEXT,
      provider_id TEXT NOT NULL,
      base_url TEXT NOT NULL DEFAULT '',
      secret_encrypted TEXT NOT NULL DEFAULT '',
      extra_json TEXT NOT NULL DEFAULT '{}',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_channel_audits (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      workspace_id TEXT,
      actor_user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      detail_json TEXT NOT NULL DEFAULT '{}',
      trace_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );
  `)
  ensureColumn(db, 'ai_channel_audits', 'trace_id', 'TEXT')

  db.exec(`
    CREATE TABLE IF NOT EXISTS model_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      capabilities_json TEXT NOT NULL,
      cost_per_second REAL NOT NULL DEFAULT 0,
      max_duration_sec INTEGER NOT NULL DEFAULT 8,
      supports_4k INTEGER NOT NULL DEFAULT 0,
      supports_audio INTEGER NOT NULL DEFAULT 0,
      supports_stylization INTEGER NOT NULL DEFAULT 0,
      region TEXT NOT NULL DEFAULT 'global',
      enabled INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS model_runtime_metrics (
      model_id TEXT PRIMARY KEY,
      window_minutes INTEGER NOT NULL DEFAULT 1440,
      total_requests INTEGER NOT NULL DEFAULT 0,
      success_rate REAL NOT NULL DEFAULT 1,
      p95_latency_ms INTEGER NOT NULL DEFAULT 0,
      avg_cost_usd REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS request_metrics (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      route_key TEXT NOT NULL,
      method TEXT NOT NULL,
      category TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      success INTEGER NOT NULL DEFAULT 0,
      duration_ms REAL NOT NULL,
      created_at TEXT NOT NULL
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS routing_policies (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      priority TEXT NOT NULL,
      max_budget_usd REAL NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      allowed_models_json TEXT NOT NULL DEFAULT '[]',
      weights_json TEXT NOT NULL DEFAULT '{}',
      fallback_policy_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
  ensureColumn(db, 'routing_policies', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)
  ensureColumn(db, 'routing_policies', 'enabled', 'INTEGER NOT NULL DEFAULT 1')
  ensureColumn(db, 'routing_policies', 'allowed_models_json', `TEXT NOT NULL DEFAULT '[]'`)
  ensureColumn(db, 'routing_policies', 'weights_json', `TEXT NOT NULL DEFAULT '{}'`)
  ensureColumn(db, 'routing_policies', 'fallback_policy_id', 'TEXT')

  db.exec(`
    CREATE TABLE IF NOT EXISTS routing_executions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      policy_id TEXT NOT NULL,
      prompt TEXT NOT NULL,
      priority TEXT NOT NULL,
      recommended_model_id TEXT NOT NULL,
      estimated_cost_usd REAL NOT NULL DEFAULT 0,
      estimated_latency_ms INTEGER NOT NULL DEFAULT 0,
      confidence REAL NOT NULL DEFAULT 0,
      reason TEXT NOT NULL,
      candidates_json TEXT NOT NULL DEFAULT '[]',
      score_breakdown_json TEXT NOT NULL DEFAULT '[]',
      fallback_used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY(policy_id) REFERENCES routing_policies(id) ON DELETE CASCADE
    );
  `)
  ensureColumn(db, 'routing_executions', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS policy_alert_configs (
      policy_id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      enabled INTEGER NOT NULL DEFAULT 1,
      channels_json TEXT NOT NULL DEFAULT '["dashboard"]',
      warning_threshold_ratio REAL NOT NULL DEFAULT 0.8,
      critical_threshold_ratio REAL NOT NULL DEFAULT 1.0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(policy_id) REFERENCES routing_policies(id) ON DELETE CASCADE
    );
  `)
  ensureColumn(db, 'policy_alert_configs', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS policy_alert_events (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      policy_id TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      prompt TEXT NOT NULL DEFAULT '',
      recommended_model_id TEXT NOT NULL DEFAULT '',
      estimated_cost_usd REAL NOT NULL DEFAULT 0,
      budget_usd REAL NOT NULL DEFAULT 0,
      meta_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY(policy_id) REFERENCES routing_policies(id) ON DELETE CASCADE
    );
  `)
  ensureColumn(db, 'policy_alert_events', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS creative_runs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      script TEXT NOT NULL,
      style TEXT NOT NULL DEFAULT 'cinematic',
      status TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      parent_run_id TEXT,
      quality_score REAL NOT NULL DEFAULT 0,
      notes_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(parent_run_id) REFERENCES creative_runs(id) ON DELETE SET NULL
    );
  `)
  ensureColumn(db, 'creative_runs', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)
  ensureColumn(db, 'creative_runs', 'version', 'INTEGER NOT NULL DEFAULT 1')
  ensureColumn(db, 'creative_runs', 'parent_run_id', 'TEXT')
  ensureColumn(db, 'creative_runs', 'quality_score', 'REAL NOT NULL DEFAULT 0')
  ensureColumn(db, 'creative_runs', 'notes_json', `TEXT NOT NULL DEFAULT '{}'`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS storyboard_scenes (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      run_id TEXT NOT NULL,
      order_idx INTEGER NOT NULL,
      title TEXT NOT NULL,
      video_prompt TEXT NOT NULL,
      audio_prompt TEXT NOT NULL,
      voiceover_text TEXT NOT NULL,
      duration REAL NOT NULL DEFAULT 5,
      status TEXT NOT NULL DEFAULT 'draft',
      revision INTEGER NOT NULL DEFAULT 1,
      last_feedback TEXT NOT NULL DEFAULT '',
      generation_meta_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(run_id) REFERENCES creative_runs(id) ON DELETE CASCADE
    );
  `)
  ensureColumn(db, 'storyboard_scenes', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)
  ensureColumn(db, 'storyboard_scenes', 'revision', 'INTEGER NOT NULL DEFAULT 1')
  ensureColumn(db, 'storyboard_scenes', 'last_feedback', `TEXT NOT NULL DEFAULT ''`)
  ensureColumn(db, 'storyboard_scenes', 'generation_meta_json', `TEXT NOT NULL DEFAULT '{}'`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS creative_feedback_events (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      run_id TEXT NOT NULL,
      scene_id TEXT,
      scope TEXT NOT NULL,
      feedback_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(run_id) REFERENCES creative_runs(id) ON DELETE CASCADE
    );
  `)
  ensureColumn(
    db,
    'creative_feedback_events',
    'organization_id',
    `TEXT NOT NULL DEFAULT 'org_default'`
  )

  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
  ensureColumn(db, 'workspaces', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS workspace_members (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      user_id TEXT,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );
  `)
  ensureColumn(db, 'workspace_members', 'user_id', 'TEXT')

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );
  `)
  ensureColumn(db, 'projects', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      workspace_id TEXT,
      project_id TEXT,
      actor_name TEXT NOT NULL,
      action TEXT NOT NULL,
      detail_json TEXT NOT NULL,
      trace_id TEXT,
      created_at TEXT NOT NULL
    );
  `)
  ensureColumn(db, 'audit_logs', 'organization_id', 'TEXT')
  ensureColumn(db, 'audit_logs', 'trace_id', 'TEXT')

  db.exec(`
    CREATE TABLE IF NOT EXISTS workspace_invites (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      workspace_id TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      inviter TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      expires_at TEXT NOT NULL,
      accepted_by TEXT,
      accepted_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );
  `)
  ensureColumn(db, 'workspace_invites', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS workspace_action_idempotency (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      workspace_id TEXT,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
    );
  `)
  ensureColumn(
    db,
    'workspace_action_idempotency',
    'organization_id',
    `TEXT NOT NULL DEFAULT 'org_default'`
  )

  db.exec(`
    CREATE TABLE IF NOT EXISTS workspace_presence (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      workspace_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      member_name TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );
  `)
  ensureColumn(db, 'workspace_presence', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS project_snapshots (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      project_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      content_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `)
  ensureColumn(db, 'project_snapshots', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS project_comments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      project_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      anchor TEXT,
      content TEXT NOT NULL,
      mentions_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'open',
      resolved_by TEXT,
      resolved_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `)
  ensureColumn(db, 'project_comments', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS project_reviews (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      project_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      decision TEXT NOT NULL,
      summary TEXT NOT NULL,
      score REAL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `)
  ensureColumn(db, 'project_reviews', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS project_templates (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      template_json TEXT NOT NULL DEFAULT '{}',
      created_by TEXT NOT NULL DEFAULT 'system',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `)
  ensureColumn(db, 'project_templates', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS collab_events (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      workspace_id TEXT NOT NULL,
      project_id TEXT,
      actor_name TEXT NOT NULL,
      session_id TEXT,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );
  `)
  ensureColumn(db, 'collab_events', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS comment_replies (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      project_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      content TEXT NOT NULL,
      mentions_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(thread_id) REFERENCES project_comments(id) ON DELETE CASCADE
    );
  `)
  ensureColumn(db, 'comment_replies', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS workspace_role_permissions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      workspace_id TEXT NOT NULL,
      role TEXT NOT NULL,
      permission_key TEXT NOT NULL,
      allowed INTEGER NOT NULL DEFAULT 1,
      updated_by TEXT NOT NULL DEFAULT 'system',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );
  `)
  ensureColumn(
    db,
    'workspace_role_permissions',
    'organization_id',
    `TEXT NOT NULL DEFAULT 'org_default'`
  )

  db.exec(`
    CREATE TABLE IF NOT EXISTS timeline_merge_records (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      workspace_id TEXT,
      project_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      source_revision TEXT NOT NULL DEFAULT '',
      target_revision TEXT NOT NULL DEFAULT '',
      conflict_json TEXT NOT NULL DEFAULT '[]',
      result_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'merged',
      created_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `)
  ensureColumn(
    db,
    'timeline_merge_records',
    'organization_id',
    `TEXT NOT NULL DEFAULT 'org_default'`
  )

  db.exec(`
    CREATE TABLE IF NOT EXISTS reliability_policies (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL DEFAULT 'global',
      target_slo REAL NOT NULL DEFAULT 0.99,
      window_days INTEGER NOT NULL DEFAULT 30,
      warning_threshold_ratio REAL NOT NULL DEFAULT 0.7,
      alert_threshold_ratio REAL NOT NULL DEFAULT 0.9,
      freeze_deploy_on_breach INTEGER NOT NULL DEFAULT 0,
      updated_by TEXT NOT NULL DEFAULT 'system',
      meta_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS rollback_drills (
      id TEXT PRIMARY KEY,
      policy_id TEXT,
      environment TEXT NOT NULL DEFAULT 'production',
      status TEXT NOT NULL DEFAULT 'scheduled',
      trigger_type TEXT NOT NULL DEFAULT 'manual',
      initiated_by TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      plan_json TEXT NOT NULL DEFAULT '{}',
      result_json TEXT NOT NULL DEFAULT '{}',
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(policy_id) REFERENCES reliability_policies(id) ON DELETE SET NULL
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS reliability_alerts (
      id TEXT PRIMARY KEY,
      policy_id TEXT,
      level TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'error_budget',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      payload_json TEXT NOT NULL DEFAULT '{}',
      triggered_at TEXT NOT NULL,
      acknowledged_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(policy_id) REFERENCES reliability_policies(id) ON DELETE SET NULL
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS prompt_workflows (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      definition_json TEXT NOT NULL DEFAULT '{}',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
  ensureColumn(db, 'prompt_workflows', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS prompt_workflow_runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      trigger_type TEXT NOT NULL DEFAULT 'manual',
      status TEXT NOT NULL DEFAULT 'queued',
      input_json TEXT NOT NULL DEFAULT '{}',
      output_json TEXT NOT NULL DEFAULT '{}',
      error_message TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(workflow_id) REFERENCES prompt_workflows(id) ON DELETE CASCADE
    );
  `)
  ensureColumn(db, 'prompt_workflow_runs', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS video_generation_jobs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      workspace_id TEXT,
      model_id TEXT NOT NULL,
      generation_mode TEXT NOT NULL DEFAULT 'text_to_video',
      request_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'queued',
      provider_status TEXT NOT NULL DEFAULT 'ok',
      operation_name TEXT,
      result_json TEXT NOT NULL DEFAULT '{}',
      error_message TEXT,
      error_code TEXT,
      output_url TEXT,
      started_at TEXT,
      finished_at TEXT,
      duration_ms REAL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      cancel_requested_at TEXT,
      last_synced_at TEXT,
      created_by TEXT NOT NULL DEFAULT 'system',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
  ensureColumn(
    db,
    'video_generation_jobs',
    'organization_id',
    `TEXT NOT NULL DEFAULT 'org_default'`
  )
  ensureColumn(db, 'video_generation_jobs', 'workspace_id', 'TEXT')
  ensureColumn(
    db,
    'video_generation_jobs',
    'generation_mode',
    `TEXT NOT NULL DEFAULT 'text_to_video'`
  )
  ensureColumn(db, 'video_generation_jobs', 'request_json', `TEXT NOT NULL DEFAULT '{}'`)
  ensureColumn(db, 'video_generation_jobs', 'status', `TEXT NOT NULL DEFAULT 'queued'`)
  ensureColumn(db, 'video_generation_jobs', 'provider_status', `TEXT NOT NULL DEFAULT 'ok'`)
  ensureColumn(db, 'video_generation_jobs', 'operation_name', 'TEXT')
  ensureColumn(db, 'video_generation_jobs', 'result_json', `TEXT NOT NULL DEFAULT '{}'`)
  ensureColumn(db, 'video_generation_jobs', 'error_message', 'TEXT')
  ensureColumn(db, 'video_generation_jobs', 'error_code', 'TEXT')
  ensureColumn(db, 'video_generation_jobs', 'output_url', 'TEXT')
  ensureColumn(db, 'video_generation_jobs', 'started_at', 'TEXT')
  ensureColumn(db, 'video_generation_jobs', 'finished_at', 'TEXT')
  ensureColumn(db, 'video_generation_jobs', 'duration_ms', 'REAL')
  ensureColumn(db, 'video_generation_jobs', 'retry_count', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn(db, 'video_generation_jobs', 'cancel_requested_at', 'TEXT')
  ensureColumn(db, 'video_generation_jobs', 'last_synced_at', 'TEXT')
  ensureColumn(db, 'video_generation_jobs', 'created_by', `TEXT NOT NULL DEFAULT 'system'`)
  ensureColumn(db, 'video_generation_jobs', 'updated_at', `TEXT NOT NULL DEFAULT ''`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS batch_jobs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      workflow_run_id TEXT,
      job_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      total_items INTEGER NOT NULL DEFAULT 0,
      completed_items INTEGER NOT NULL DEFAULT 0,
      failed_items INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(workflow_run_id) REFERENCES prompt_workflow_runs(id) ON DELETE SET NULL
    );
  `)
  ensureColumn(db, 'batch_jobs', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS batch_job_items (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      item_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      input_json TEXT NOT NULL DEFAULT '{}',
      output_json TEXT NOT NULL DEFAULT '{}',
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(job_id) REFERENCES batch_jobs(id) ON DELETE CASCADE
    );
  `)
  ensureColumn(db, 'batch_job_items', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS asset_reuse_records (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      asset_id TEXT NOT NULL,
      source_project_id TEXT,
      target_project_id TEXT,
      reused_by TEXT NOT NULL,
      context_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
  `)
  ensureColumn(db, 'asset_reuse_records', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS journey_runs (
      id TEXT PRIMARY KEY,
      flow_type TEXT NOT NULL,
      source TEXT NOT NULL,
      user_id TEXT,
      organization_id TEXT,
      workspace_id TEXT,
      session_id TEXT,
      idempotency_key TEXT,
      step_count INTEGER NOT NULL DEFAULT 0,
      success INTEGER NOT NULL DEFAULT 0,
      duration_ms REAL NOT NULL DEFAULT 0,
      meta_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
  `)
  ensureColumn(db, 'journey_runs', 'idempotency_key', 'TEXT')

  db.exec(`
    CREATE TABLE IF NOT EXISTS db_repair_logs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      reason TEXT NOT NULL,
      forced INTEGER NOT NULL DEFAULT 0,
      repaired INTEGER NOT NULL DEFAULT 0,
      db_path TEXT NOT NULL,
      copied_rows INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      report_json TEXT NOT NULL
    );
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_db_repair_logs_created_at
    ON db_repair_logs(created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_db_repair_logs_status
    ON db_repair_logs(status);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_db_repair_logs_reason
    ON db_repair_logs(reason);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_request_metrics_created_at
    ON request_metrics(created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_request_metrics_category_created
    ON request_metrics(category, created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_request_metrics_route_created
    ON request_metrics(route_key, created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_journey_runs_created_at
    ON journey_runs(created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_journey_runs_flow_created
    ON journey_runs(flow_type, created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_journey_runs_source_created
    ON journey_runs(source, created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_journey_runs_flow_success_created
    ON journey_runs(flow_type, success, created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_journey_runs_idempotency_lookup
    ON journey_runs(organization_id, flow_type, session_id, idempotency_key, created_at DESC);
  `)

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_journey_runs_org_flow_session_idempotency
    ON journey_runs(organization_id, flow_type, session_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL
      AND idempotency_key != ''
      AND session_id IS NOT NULL
      AND session_id != '';
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_routing_executions_policy_created
    ON routing_executions(policy_id, created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_policy_alert_configs_org_updated
    ON policy_alert_configs(organization_id, updated_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_policy_alert_events_policy_created
    ON policy_alert_events(policy_id, created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_policy_alert_events_status_created
    ON policy_alert_events(status, created_at DESC);
  `)

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_members_unique_user
    ON organization_members(organization_id, user_id);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_organization_members_user
    ON organization_members(user_id, created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_organization_quotas_updated
    ON organization_quotas(updated_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_organization_usage_updated
    ON organization_usage_counters(updated_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user
    ON auth_refresh_tokens(user_id, created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_expires
    ON auth_refresh_tokens(expires_at DESC);
  `)

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_channel_configs_unique_scope
    ON ai_channel_configs(organization_id, IFNULL(workspace_id, ''), provider_id);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ai_channel_configs_org_provider
    ON ai_channel_configs(organization_id, provider_id, workspace_id);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ai_channel_audits_org_created
    ON ai_channel_audits(organization_id, created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_creative_feedback_events_run_created
    ON creative_feedback_events(run_id, created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace_status
    ON workspace_invites(workspace_id, status, created_at DESC);
  `)

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_action_idempotency_unique
    ON workspace_action_idempotency(user_id, action, idempotency_key);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_workspace_action_idempotency_created
    ON workspace_action_idempotency(created_at DESC);
  `)

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_presence_unique_session
    ON workspace_presence(workspace_id, session_id);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_user
    ON workspace_members(workspace_id, user_id, created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_name
    ON workspace_members(workspace_id, name, created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_workspace_presence_workspace_expires
    ON workspace_presence(workspace_id, expires_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_project_snapshots_project_created
    ON project_snapshots(project_id, created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_project_comments_project_created
    ON project_comments(project_id, created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_project_comments_project_status_created
    ON project_comments(project_id, status, created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_project_reviews_project_created
    ON project_reviews(project_id, created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_project_templates_project_updated
    ON project_templates(project_id, updated_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_collab_events_workspace_created
    ON collab_events(workspace_id, created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_comment_replies_thread_created
    ON comment_replies(thread_id, created_at ASC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_comment_replies_project_created
    ON comment_replies(project_id, created_at DESC);
  `)

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_role_permissions_unique
    ON workspace_role_permissions(workspace_id, role, permission_key);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_workspace_role_permissions_workspace_role
    ON workspace_role_permissions(workspace_id, role, updated_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_timeline_merge_records_project_created
    ON timeline_merge_records(project_id, created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_reliability_policies_updated
    ON reliability_policies(updated_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_rollback_drills_created
    ON rollback_drills(created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_rollback_drills_status_created
    ON rollback_drills(status, created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_reliability_alerts_status_triggered
    ON reliability_alerts(status, triggered_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_reliability_alerts_policy_triggered
    ON reliability_alerts(policy_id, triggered_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_prompt_workflows_org_updated
    ON prompt_workflows(organization_id, updated_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_prompt_workflow_runs_workflow_created
    ON prompt_workflow_runs(workflow_id, created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_prompt_workflow_runs_org_created
    ON prompt_workflow_runs(organization_id, created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_org_created
    ON video_generation_jobs(organization_id, created_at DESC, id DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_status_updated
    ON video_generation_jobs(status, updated_at DESC, id DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_workspace_created
    ON video_generation_jobs(workspace_id, created_at DESC, id DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_operation_name
    ON video_generation_jobs(operation_name);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_batch_jobs_org_created
    ON batch_jobs(organization_id, created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_batch_jobs_status_updated
    ON batch_jobs(status, updated_at DESC);
  `)

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_batch_job_items_unique_key
    ON batch_job_items(job_id, item_key);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_batch_job_items_job_status
    ON batch_job_items(job_id, status, updated_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_asset_reuse_records_asset_created
    ON asset_reuse_records(asset_id, created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_asset_reuse_records_org_created
    ON asset_reuse_records(organization_id, created_at DESC);
  `)

  db.exec(`
    INSERT OR IGNORE INTO organizations (id, name, owner_user_id, created_at, updated_at)
    VALUES ('org_default', '默认组织', 'system', datetime('now'), datetime('now'));
  `)
}
