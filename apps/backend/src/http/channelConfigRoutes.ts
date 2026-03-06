import { Elysia, t } from 'elysia'
import { ChannelConfigService } from '../services/ChannelConfigService'
import { WorkspaceService } from '../services/WorkspaceService'
import {
  authorizeOrganizationRole,
  authorizeWorkspaceRole,
  getCapabilities,
  resolveOrganizationContext,
  resolveRequestTraceId
} from './context'
import { resolveErrorMessage } from './errors'

const CHANNEL_CONFIG_BODY_SCHEMA = t.Object({
  baseUrl: t.Optional(t.String()),
  apiKey: t.Optional(t.String()),
  enabled: t.Optional(t.Boolean()),
  extra: t.Optional(t.Record(t.String(), t.Any()))
})

export const channelConfigRoutes = (storageProviderType: string) =>
  new Elysia()
    .get('/api/channel/providers', () => ({
      success: true,
      providers: ChannelConfigService.listProviders()
    }))
    .post(
      '/api/channels/test',
      async ({ request, body, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        const requestedWorkspaceId = body.workspaceId?.trim() || ''
        let resolvedWorkspaceId: string | undefined
        if (requestedWorkspaceId) {
          const workspace = WorkspaceService.getWorkspace(requestedWorkspaceId)
          if (!workspace || workspace.organizationId !== organizationContext.organizationId) {
            set.status = 404
            return { success: false, status: 'error', error: 'Workspace not found' }
          }
          const authorized = authorizeWorkspaceRole(requestedWorkspaceId, request, set, 'viewer')
          if (!authorized) return { success: false, status: 'error', error: 'Forbidden' }
          resolvedWorkspaceId = requestedWorkspaceId
        }
        return await ChannelConfigService.testConfig({
          ...body,
          organizationId: organizationContext.organizationId,
          workspaceId: resolvedWorkspaceId
        })
      },
      {
        body: t.Object({
          providerId: t.String(),
          baseUrl: t.Optional(t.String()),
          apiKey: t.Optional(t.String()),
          workspaceId: t.Optional(t.String()),
          extra: t.Optional(t.Record(t.String(), t.Any()))
        })
      }
    )
    .get(
      '/api/organizations/:id/channels',
      ({ params, request, set }) => {
        const authorized = authorizeOrganizationRole(params.id, request, set, 'member')
        if (!authorized) return { success: false, status: 'error', error: 'Forbidden' }
        return {
          success: true,
          configs: ChannelConfigService.listConfigs(params.id),
          capabilities: getCapabilities(request, undefined, storageProviderType)
        }
      },
      {
        params: t.Object({ id: t.String() })
      }
    )
    .put(
      '/api/organizations/:id/channels/:providerId',
      ({ params, request, body, set }) => {
        const authorized = authorizeOrganizationRole(params.id, request, set, 'admin')
        if (!authorized) return { success: false, status: 'error', error: 'Forbidden' }
        try {
          const config = ChannelConfigService.upsertConfig({
            organizationId: params.id,
            providerId: params.providerId,
            baseUrl: body.baseUrl,
            apiKey: body.apiKey,
            enabled: body.enabled,
            extra: body.extra,
            actorUserId: authorized.user.id,
            traceId: resolveRequestTraceId(request, 'trace_channel')
          })
          return { success: true, config }
        } catch (error: unknown) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: resolveErrorMessage(error, '渠道配置保存失败')
          }
        }
      },
      {
        params: t.Object({ id: t.String(), providerId: t.String() }),
        body: CHANNEL_CONFIG_BODY_SCHEMA
      }
    )
    .get(
      '/api/workspaces/:id/channels',
      ({ params, request, set }) => {
        const workspace = WorkspaceService.getWorkspace(params.id)
        if (!workspace) {
          set.status = 404
          return { success: false, status: 'error', error: 'Workspace not found' }
        }
        const authorized = authorizeWorkspaceRole(workspace.id, request, set, 'viewer')
        if (!authorized) return { success: false, status: 'error', error: 'Forbidden' }
        return {
          success: true,
          configs: ChannelConfigService.listConfigs(workspace.organizationId, workspace.id),
          capabilities: getCapabilities(request, workspace.id, storageProviderType)
        }
      },
      {
        params: t.Object({ id: t.String() })
      }
    )
    .put(
      '/api/workspaces/:id/channels/:providerId',
      ({ params, request, body, set }) => {
        const workspace = WorkspaceService.getWorkspace(params.id)
        if (!workspace) {
          set.status = 404
          return { success: false, status: 'error', error: 'Workspace not found' }
        }
        const authorized = authorizeWorkspaceRole(workspace.id, request, set, 'owner')
        if (!authorized) return { success: false, status: 'error', error: 'Forbidden' }
        try {
          const config = ChannelConfigService.upsertConfig({
            organizationId: workspace.organizationId,
            workspaceId: workspace.id,
            providerId: params.providerId,
            baseUrl: body.baseUrl,
            apiKey: body.apiKey,
            enabled: body.enabled,
            extra: body.extra,
            actorUserId: authorized.user.id,
            traceId: resolveRequestTraceId(request, 'trace_channel')
          })
          return { success: true, config }
        } catch (error: unknown) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: resolveErrorMessage(error, '渠道配置保存失败')
          }
        }
      },
      {
        params: t.Object({ id: t.String(), providerId: t.String() }),
        body: CHANNEL_CONFIG_BODY_SCHEMA
      }
    )
