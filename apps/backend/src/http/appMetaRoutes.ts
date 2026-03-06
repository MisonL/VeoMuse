import { Elysia, t } from 'elysia'
import { getCapabilities } from './context'

export const appMetaRoutes = (storageProviderType: string) =>
  new Elysia()
    .get('/', () => 'VeoMuse Backend Active')
    .get('/api/health', () => ({ status: 'ok' }))
    .get(
      '/api/capabilities',
      ({ request, query }) => {
        const workspaceId = query.workspaceId?.trim() || undefined
        return getCapabilities(request, workspaceId, storageProviderType)
      },
      {
        query: t.Object({
          workspaceId: t.Optional(t.String())
        })
      }
    )
