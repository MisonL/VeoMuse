import { Elysia, t } from 'elysia'
import fs from 'fs/promises'
import path from 'path'
import { OrganizationGovernanceService } from '../services/OrganizationGovernanceService'
import { WorkspaceService } from '../services/WorkspaceService'
import {
  authorizeWorkspaceRole,
  buildQuotaExceededResponse,
  resolveOrganizationContext,
  resolveRequestBytes
} from './context'
import { resolveErrorMessage } from './errors'

interface UploadTokenIssuer {
  issueUploadToken: (body: {
    workspaceId: string
    projectId?: string
    fileName: string
    contentType?: string
  }) => unknown
  storeObject: (
    objectKey: string,
    bytes: Uint8Array | ArrayBuffer | string
  ) => {
    objectKey: string
    bytes: number
    publicUrl: string
  }
}

const resolveImportDir = () => {
  const baseUploadsDir = process.env.UPLOADS_PATH
    ? path.resolve(process.env.UPLOADS_PATH)
    : path.resolve(process.cwd(), '../../uploads')
  return path.join(baseUploadsDir, 'imports')
}

const sanitizeImportFileName = (fileName: string) => {
  const base = path.basename(fileName || '').trim()
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, '_')
  if (safe) return safe
  return `asset-${Date.now()}.bin`
}

export const storageRoutes = (storageProvider: UploadTokenIssuer) =>
  new Elysia()
    .post(
      '/api/storage/local-import',
      async ({ body, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        try {
          const rawBase64 = (body.base64Data || '').trim()
          if (!rawBase64) {
            set.status = 400
            return { success: false, status: 'error', error: 'base64Data is required' }
          }

          const maxBytes = Number.parseInt(process.env.LOCAL_IMPORT_MAX_BYTES || '', 10)
          const hardLimit = Number.isFinite(maxBytes) && maxBytes > 0 ? maxBytes : 200 * 1024 * 1024
          const normalizedBase64 = rawBase64.replace(/\s+/g, '')
          const estimatedBytes = Math.ceil(normalizedBase64.length * 0.75)
          if (estimatedBytes > hardLimit) {
            set.status = 413
            return {
              success: false,
              status: 'error',
              error: `file is too large (estimated): ${estimatedBytes} bytes (max ${hardLimit} bytes)`
            }
          }

          const bytes = Buffer.from(normalizedBase64, 'base64')
          if (!bytes.length) {
            set.status = 400
            return { success: false, status: 'error', error: 'base64Data is invalid' }
          }

          if (bytes.length > hardLimit) {
            set.status = 413
            return {
              success: false,
              status: 'error',
              error: `file is too large: ${bytes.length} bytes (max ${hardLimit} bytes)`
            }
          }

          const storageCheck = OrganizationGovernanceService.checkStorageAllowed(
            organizationContext.organizationId,
            bytes.length
          )
          if (!storageCheck.allowed) {
            set.status = 429
            return buildQuotaExceededResponse('storage', storageCheck)
          }

          const importDir = resolveImportDir()
          await fs.mkdir(importDir, { recursive: true })
          const safeName = sanitizeImportFileName(body.fileName)
          const filePath = path.join(
            importDir,
            `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`
          )
          await fs.writeFile(filePath, bytes)
          const usage = OrganizationGovernanceService.addStorageUsage(
            organizationContext.organizationId,
            bytes.length
          )

          return {
            success: true,
            imported: {
              localPath: filePath,
              bytes: bytes.length
            },
            usage
          }
        } catch (error: unknown) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: resolveErrorMessage(error, 'local import failed')
          }
        }
      },
      {
        body: t.Object({
          fileName: t.String(),
          base64Data: t.String(),
          contentType: t.Optional(t.String())
        })
      }
    )
    .post(
      '/api/storage/upload-token',
      ({ body, request, set }) => {
        const workspaceId = body.workspaceId.trim()
        const authorized = authorizeWorkspaceRole(workspaceId, request, set, 'editor')
        if (!authorized) {
          return { success: false, status: 'error', error: 'Forbidden: editor membership required' }
        }
        if (
          body.projectId &&
          !WorkspaceService.projectBelongsToWorkspace(workspaceId, body.projectId)
        ) {
          set.status = 403
          return { success: false, status: 'error', error: 'Project does not belong to workspace' }
        }
        return {
          success: true,
          token: storageProvider.issueUploadToken(body)
        }
      },
      {
        body: t.Object({
          workspaceId: t.String(),
          projectId: t.Optional(t.String()),
          fileName: t.String(),
          contentType: t.Optional(t.String())
        })
      }
    )
    .put(
      '/api/storage/local-upload/:objectKey',
      async ({ params, request, set, body }) => {
        try {
          const decodedObjectKey = decodeURIComponent(params.objectKey || '').trim()
          if (!decodedObjectKey) {
            set.status = 400
            return { success: false, status: 'error', error: 'objectKey is required' }
          }
          const workspaceId = decodedObjectKey
            .split('/')
            .map((segment) => segment.trim())
            .filter(Boolean)[0]
          if (!workspaceId) {
            set.status = 400
            return {
              success: false,
              status: 'error',
              error: 'workspaceId is required in objectKey'
            }
          }
          const workspace = WorkspaceService.getWorkspace(workspaceId)
          if (!workspace) {
            set.status = 404
            return { success: false, status: 'error', error: 'Workspace not found' }
          }

          const maxUploadBytesRaw = Number.parseInt(process.env.LOCAL_UPLOAD_MAX_BYTES || '', 10)
          const maxUploadBytes =
            Number.isFinite(maxUploadBytesRaw) && maxUploadBytesRaw > 0
              ? maxUploadBytesRaw
              : 200 * 1024 * 1024
          const contentLength = Number.parseInt(request.headers.get('content-length') || '0', 10)
          if (Number.isFinite(contentLength) && contentLength > maxUploadBytes) {
            set.status = 413
            return {
              success: false,
              status: 'error',
              error: `payload too large: ${contentLength} bytes (max ${maxUploadBytes})`
            }
          }

          const authorized = authorizeWorkspaceRole(workspaceId, request, set, 'editor')
          if (!authorized) {
            return {
              success: false,
              status: 'error',
              error: 'Forbidden: editor membership required'
            }
          }
          const bytes = await resolveRequestBytes(request, body)
          if (bytes.byteLength > maxUploadBytes) {
            set.status = 413
            return {
              success: false,
              status: 'error',
              error: `payload too large: ${bytes.byteLength} bytes (max ${maxUploadBytes})`
            }
          }
          const storageCheck = OrganizationGovernanceService.checkStorageAllowed(
            workspace.organizationId,
            bytes.byteLength
          )
          if (!storageCheck.allowed) {
            set.status = 429
            return buildQuotaExceededResponse('storage', storageCheck)
          }
          const result = storageProvider.storeObject(decodedObjectKey, bytes)
          const usage = OrganizationGovernanceService.addStorageUsage(
            workspace.organizationId,
            result.bytes
          )
          set.status = 201
          return {
            success: true,
            uploaded: {
              objectKey: result.objectKey,
              bytes: result.bytes,
              publicUrl: result.publicUrl
            },
            usage
          }
        } catch (error: unknown) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: resolveErrorMessage(error, 'local upload failed')
          }
        }
      },
      {
        params: t.Object({
          objectKey: t.String()
        })
      }
    )
