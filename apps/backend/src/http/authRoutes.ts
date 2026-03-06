import { Elysia, t } from 'elysia'
import { AuthService } from '../services/AuthService'
import { OrganizationService } from '../services/OrganizationService'
import { requireAuthenticatedUser } from './context'
import { resolveErrorMessage } from './errors'

export const authRoutes = () =>
  new Elysia()
    .post(
      '/api/auth/register',
      async ({ body, set }) => {
        try {
          const user = await AuthService.register(body.email, body.password)
          const organization = OrganizationService.createOrganization(
            body.organizationName || `${user.email.split('@')[0]} 的组织`,
            user.id
          )
          const session = AuthService.createSession(user)
          return {
            success: true,
            session,
            organizations: [organization]
          }
        } catch (error: unknown) {
          set.status = 400
          return { success: false, status: 'error', error: resolveErrorMessage(error, '注册失败') }
        }
      },
      {
        body: t.Object({
          email: t.String(),
          password: t.String(),
          organizationName: t.Optional(t.String())
        })
      }
    )
    .post(
      '/api/auth/login',
      async ({ body, set }) => {
        try {
          const user = await AuthService.login(body.email, body.password)
          const session = AuthService.createSession(user)
          const organizations = OrganizationService.listOrganizationsForUser(user.id)
          return { success: true, session, organizations }
        } catch (error: unknown) {
          set.status = 401
          return { success: false, status: 'error', error: resolveErrorMessage(error, '登录失败') }
        }
      },
      {
        body: t.Object({
          email: t.String(),
          password: t.String()
        })
      }
    )
    .post(
      '/api/auth/refresh',
      ({ body, set }) => {
        try {
          const session = AuthService.rotateSession(body.refreshToken)
          const organizations = OrganizationService.listOrganizationsForUser(session.user.id)
          return { success: true, session, organizations }
        } catch (error: unknown) {
          set.status = 401
          return {
            success: false,
            status: 'error',
            error: resolveErrorMessage(error, '刷新会话失败')
          }
        }
      },
      {
        body: t.Object({
          refreshToken: t.String()
        })
      }
    )
    .post(
      '/api/auth/logout',
      ({ body }) => {
        AuthService.revokeRefreshToken(body.refreshToken || '')
        return { success: true }
      },
      {
        body: t.Object({
          refreshToken: t.Optional(t.String())
        })
      }
    )
    .get('/api/auth/me', ({ request, set }) => {
      const user = requireAuthenticatedUser(request, set)
      if (!user) return { success: false, status: 'error', error: 'Unauthorized' }
      return {
        success: true,
        user,
        organizations: OrganizationService.listOrganizationsForUser(user.id)
      }
    })
