import type {
  MarketplaceModel,
  ModelProfile,
  RoutingDecision,
  RoutingPolicy
} from '@veomuse/shared'
import {
  getAllProfiles,
  getProfile,
  listMarketplace as listMarketplaceRecords,
  collectAndPersistMetrics as collectMarketplaceMetrics,
  ensureDefaultProfiles
} from './model-marketplace/metrics'
import {
  DEFAULT_FALLBACK_POLICY,
  createPolicy,
  ensureDefaultAutoPolicy,
  getPolicy,
  listPolicies,
  listPolicyExecutions,
  updatePolicy
} from './model-marketplace/policies'
import {
  getPolicyAlertConfig,
  listPolicyAlerts,
  recordPolicyAlertEvent,
  updatePolicyAlertConfig
} from './model-marketplace/alerts'
import {
  executeDecision,
  simulateDecision,
  simulateDecisionBatch
} from './model-marketplace/decisions'
import {
  type PolicyAlertConfigPatch,
  type PolicyExecutionQuery,
  type PolicyMutationPayload,
  type SimulatePayload
} from './modelMarketplaceShared'

export class ModelMarketplaceService {
  private static initialized = false

  private static readonly defaultFallbackPolicy: RoutingPolicy = DEFAULT_FALLBACK_POLICY

  static ensureInitialized() {
    if (this.initialized) return

    ensureDefaultProfiles()
    ensureDefaultAutoPolicy()
    this.initialized = true
    this.collectAndPersistMetrics()
  }

  static collectAndPersistMetrics(windowMinutes: number = 1440) {
    if (!this.initialized) this.ensureInitialized()
    collectMarketplaceMetrics(windowMinutes)
  }

  static getAllProfiles(): ModelProfile[] {
    this.ensureInitialized()
    return getAllProfiles()
  }

  static getProfile(modelId: string): ModelProfile | null {
    this.ensureInitialized()
    return getProfile(modelId)
  }

  static listMarketplace(options: { refreshMetrics?: boolean } = {}): MarketplaceModel[] {
    this.ensureInitialized()
    if (options.refreshMetrics !== false) {
      this.collectAndPersistMetrics()
    }
    return listMarketplaceRecords({ refreshMetrics: false })
  }

  static listPolicies(organizationId: string = 'org_default'): RoutingPolicy[] {
    this.ensureInitialized()
    return listPolicies(organizationId)
  }

  static getPolicy(policyId: string, organizationId: string = 'org_default'): RoutingPolicy | null {
    this.ensureInitialized()
    return getPolicy(policyId, organizationId)
  }

  static createPolicy(organizationId: string, payload: PolicyMutationPayload) {
    this.ensureInitialized()
    return createPolicy(organizationId, payload)
  }

  static updatePolicy(organizationId: string, policyId: string, patch: PolicyMutationPayload) {
    this.ensureInitialized()
    return updatePolicy(organizationId, policyId, patch)
  }

  static listPolicyExecutions(
    organizationId: string,
    policyId: string,
    query: PolicyExecutionQuery = {}
  ) {
    this.ensureInitialized()
    return listPolicyExecutions(organizationId, policyId, query)
  }

  static getPolicyAlertConfig(organizationId: string, policyId: string) {
    this.ensureInitialized()
    return getPolicyAlertConfig(organizationId, policyId)
  }

  static updatePolicyAlertConfig(
    organizationId: string,
    policyId: string,
    patch: PolicyAlertConfigPatch
  ) {
    this.ensureInitialized()
    return updatePolicyAlertConfig(organizationId, policyId, patch, getPolicy)
  }

  static listPolicyAlerts(organizationId: string, policyId: string, limit?: number) {
    this.ensureInitialized()
    return listPolicyAlerts(organizationId, policyId, limit)
  }

  static simulateDecisionBatch(
    organizationId: string,
    policyId: string,
    scenarios: Array<{
      prompt: string
      budgetUsd?: number
      priority?: 'quality' | 'speed' | 'cost'
    }>
  ) {
    this.ensureInitialized()
    return simulateDecisionBatch(organizationId, policyId, scenarios, {
      listMarketplace: (options) => this.listMarketplace(options),
      getPolicy,
      listPolicies,
      recordPolicyAlertEvent,
      defaultFallbackPolicy: this.defaultFallbackPolicy
    })
  }

  static simulateDecision(
    payload: SimulatePayload,
    specificPolicyId?: string,
    organizationId: string = 'org_default'
  ): RoutingDecision {
    this.ensureInitialized()
    return simulateDecision(
      payload,
      {
        listMarketplace: (options) => this.listMarketplace(options),
        getPolicy,
        listPolicies,
        recordPolicyAlertEvent,
        defaultFallbackPolicy: this.defaultFallbackPolicy
      },
      specificPolicyId,
      organizationId
    )
  }

  static executeDecision(
    payload: SimulatePayload,
    specificPolicyId?: string,
    organizationId: string = 'org_default'
  ): RoutingDecision {
    this.ensureInitialized()
    return executeDecision(
      payload,
      {
        listMarketplace: (options) => this.listMarketplace(options),
        getPolicy,
        listPolicies,
        recordPolicyAlertEvent,
        defaultFallbackPolicy: this.defaultFallbackPolicy
      },
      specificPolicyId,
      organizationId
    )
  }

  static resetAfterDatabaseRecovery() {
    this.initialized = false
    this.ensureInitialized()
  }
}
