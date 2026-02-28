import type { StorageProviderType } from '@veomuse/shared'

export interface UploadTokenRequest {
  workspaceId?: string
  projectId?: string
  fileName: string
  contentType?: string
}

export interface UploadTokenResult {
  provider: StorageProviderType
  objectKey: string
  uploadUrl: string
  publicUrl: string
  expiresInSec: number
  headers?: Record<string, string>
  metadata?: Record<string, unknown>
}

export interface StorageProvider {
  type: StorageProviderType
  issueUploadToken(req: UploadTokenRequest): UploadTokenResult
}
