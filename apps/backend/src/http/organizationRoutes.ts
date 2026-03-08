import { Elysia, t } from 'elysia'
import { OrganizationGovernanceService } from '../services/OrganizationGovernanceService'
import { OrganizationService } from '../services/OrganizationService'
import { authorizeOrganizationRole, parseBoundedLimit, requireAuthenticatedUser } from './context'
import { resolveErrorMessage } from './errors'

const ORGANIZATION_MEMBER_ROLE_SCHEMA = t.Union([
  t.Literal('owner'),
  t.Literal('admin'),
  t.Literal('member')
])

export const organizationRoutes = () =>
  new Elysia()
    .post(
      '/api/organizations',
      ({ request, body, set }) => {
        const user = requireAuthenticatedUser(request, set)
        if (!user) return { success: false, status: 'error', error: 'Unauthorized' }
        try {
          const organization = OrganizationService.createOrganization(body.name, user.id)
          return { success: true, organization }
        } catch (error: unknown) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: resolveErrorMessage(error, '创建组织失败')
          }
        }
      },
      {
        body: t.Object({
          name: t.String()
        })
      }
    )
    .get('/api/organizations', ({ request, set }) => {
      const user = requireAuthenticatedUser(request, set)
      if (!user) return { success: false, status: 'error', error: 'Unauthorized' }
      return {
        success: true,
        organizations: OrganizationService.listOrganizationsForUser(user.id)
      }
    })
    .get(
      '/api/organizations/:id',
      ({ params, request, set }) => {
        const authorized = authorizeOrganizationRole(params.id, request, set, 'member')
        if (!authorized) return { success: false, status: 'error', error: 'Forbidden' }
        const organization = OrganizationService.getOrganization(params.id)
        if (!organization) {
          set.status = 404
          return { success: false, status: 'error', error: 'Organization not found' }
        }
        return { success: true, organization, role: authorized.role }
      },
      {
        params: t.Object({ id: t.String() })
      }
    )
    .get(
      '/api/organizations/:id/members',
      ({ params, request, set }) => {
        const authorized = authorizeOrganizationRole(params.id, request, set, 'member')
        if (!authorized) return { success: false, status: 'error', error: 'Forbidden' }
        return {
          success: true,
          members: OrganizationService.listMembers(params.id)
        }
      },
      {
        params: t.Object({ id: t.String() })
      }
    )
    .post(
      '/api/organizations/:id/members',
      ({ params, request, body, set }) => {
        const authorized = authorizeOrganizationRole(params.id, request, set, 'admin')
        if (!authorized) return { success: false, status: 'error', error: 'Forbidden' }
        try {
          const member = OrganizationService.addMemberByEmail(params.id, body.email, body.role)
          return { success: true, member }
        } catch (error: unknown) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: resolveErrorMessage(error, '添加成员失败')
          }
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          email: t.String(),
          role: ORGANIZATION_MEMBER_ROLE_SCHEMA
        })
      }
    )
    .get(
      '/api/organizations/:id/quota',
      ({ params, request, set }) => {
        const authorized = authorizeOrganizationRole(params.id, request, set, 'member')
        if (!authorized) return { success: false, status: 'error', error: 'Forbidden' }
        return {
          success: true,
          quota: OrganizationGovernanceService.getQuota(params.id),
          usage: OrganizationGovernanceService.getUsage(params.id)
        }
      },
      {
        params: t.Object({ id: t.String() })
      }
    )
    .put(
      '/api/organizations/:id/quota',
      ({ params, request, body, set }) => {
        const authorized = authorizeOrganizationRole(params.id, request, set, 'admin')
        if (!authorized) return { success: false, status: 'error', error: 'Forbidden' }
        try {
          const quota = OrganizationGovernanceService.upsertQuota({
            organizationId: params.id,
            requestLimit: body.requestLimit,
            storageLimitBytes: body.storageLimitBytes,
            concurrencyLimit: body.concurrencyLimit,
            updatedBy: authorized.user.id
          })
          return {
            success: true,
            quota,
            usage: OrganizationGovernanceService.getUsage(params.id)
          }
        } catch (error: unknown) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: resolveErrorMessage(error, '组织配额更新失败')
          }
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          requestLimit: t.Optional(t.Number({ minimum: 0 })),
          storageLimitBytes: t.Optional(t.Number({ minimum: 0 })),
          concurrencyLimit: t.Optional(t.Number({ minimum: 0 }))
        })
      }
    )
    .get(
      '/api/organizations/:id/audits/export',
      ({ params, query, request, set }) => {
        const authorized = authorizeOrganizationRole(params.id, request, set, 'admin')
        if (!authorized) return { success: false, status: 'error', error: 'Forbidden' }

        const result = OrganizationGovernanceService.exportAudits(params.id, {
          from: query.from,
          to: query.to,
          scope: query.scope,
          format: query.format,
          limit: parseBoundedLimit(query.limit, 1000, 5000)
        })

        if (result.format === 'csv') {
          const fileName = `veomuse-audits-${params.id}-${Date.now()}.csv`
          return new Response(result.csv || '', {
            headers: {
              'content-type': 'text/csv; charset=utf-8',
              'content-disposition': `attachment; filename=\"${fileName}\"`
            }
          })
        }

        return {
          success: true,
          ...result
        }
      },
      {
        params: t.Object({ id: t.String() }),
        query: t.Object({
          from: t.Optional(t.String()),
          to: t.Optional(t.String()),
          scope: t.Optional(
            t.Union([t.Literal('all'), t.Literal('channel'), t.Literal('workspace')])
          ),
          format: t.Optional(t.Union([t.Literal('json'), t.Literal('csv')])),
          limit: t.Optional(t.String())
        })
      }
    )
