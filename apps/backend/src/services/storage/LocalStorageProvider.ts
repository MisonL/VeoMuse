import fs from 'fs'
import path from 'path'
import type { StorageProvider, UploadTokenRequest, UploadTokenResult } from './StorageProvider'

const sanitizeSegment = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '_')
const now = () => new Date().toISOString()
const LOCAL_KEY_SEGMENT = /^[a-zA-Z0-9._-]+$/

export class LocalStorageProvider implements StorageProvider {
  readonly type = 'local' as const
  private readonly rootDir: string

  constructor(rootDir?: string) {
    this.rootDir =
      rootDir ||
      process.env.LOCAL_STORAGE_ROOT?.trim() ||
      path.resolve(process.cwd(), '../../uploads/workspace')
    if (!fs.existsSync(this.rootDir)) {
      fs.mkdirSync(this.rootDir, { recursive: true })
    }
  }

  issueUploadToken(req: UploadTokenRequest): UploadTokenResult {
    const workspacePart = sanitizeSegment(req.workspaceId || 'global')
    const projectPart = sanitizeSegment(req.projectId || 'default')
    const filePart = sanitizeSegment(req.fileName || `file-${Date.now()}`)
    const objectKey = `${workspacePart}/${projectPart}/${Date.now()}-${filePart}`
    const fsPath = path.join(this.rootDir, objectKey)
    const fsDir = path.dirname(fsPath)
    if (!fs.existsSync(fsDir)) fs.mkdirSync(fsDir, { recursive: true })

    return {
      provider: this.type,
      objectKey,
      uploadUrl: `/api/storage/local-upload/${encodeURIComponent(objectKey)}`,
      publicUrl: `/uploads/workspace/${objectKey}`,
      expiresInSec: 600,
      metadata: {
        filesystemPath: fsPath,
        issuedAt: now(),
        contentType: req.contentType || 'application/octet-stream'
      }
    }
  }

  private resolveObjectPath(objectKey: string) {
    const normalizedKey = String(objectKey || '').trim()
    if (!normalizedKey) {
      throw new Error('objectKey is required')
    }
    const segments = normalizedKey
      .split('/')
      .map((item) => item.trim())
      .filter(Boolean)
    if (!segments.length) {
      throw new Error('objectKey is invalid')
    }
    if (!segments.every((segment) => LOCAL_KEY_SEGMENT.test(segment))) {
      throw new Error('objectKey contains invalid path segment')
    }
    const safeObjectKey = segments.join('/')
    const fsPath = path.join(this.rootDir, safeObjectKey)
    const rootPrefix = this.rootDir.endsWith(path.sep) ? this.rootDir : `${this.rootDir}${path.sep}`
    if (!(fsPath === this.rootDir || fsPath.startsWith(rootPrefix))) {
      throw new Error('objectKey escapes storage root')
    }
    return {
      fsPath,
      objectKey: safeObjectKey
    }
  }

  storeObject(objectKey: string, bytes: Uint8Array | ArrayBuffer | string) {
    const { fsPath, objectKey: safeObjectKey } = this.resolveObjectPath(objectKey)
    const fsDir = path.dirname(fsPath)
    if (!fs.existsSync(fsDir)) fs.mkdirSync(fsDir, { recursive: true })

    const buffer =
      typeof bytes === 'string'
        ? Buffer.from(bytes)
        : bytes instanceof Uint8Array
          ? Buffer.from(bytes)
          : Buffer.from(bytes)

    fs.writeFileSync(fsPath, buffer)
    return {
      objectKey: safeObjectKey,
      bytes: buffer.byteLength,
      publicUrl: `/uploads/workspace/${safeObjectKey}`,
      filesystemPath: fsPath
    }
  }
}
