export interface DbHealthSummary {
  status?: string
  mode?: string
  checkedAt?: string
  messages?: string[]
}

export interface DbRuntimeConfig {
  autoRepairEnabled?: boolean
  runtimeHealthcheckEnabled?: boolean
  runtimeHealthcheckIntervalMs?: number
  dbPath?: string
}

export interface DbRepairRecord {
  status?: string
  reason?: string
  timestamp?: string
  salvage?: {
    copiedRows?: number
  }
  actions?: unknown[]
}
