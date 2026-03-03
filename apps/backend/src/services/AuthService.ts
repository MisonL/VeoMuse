import { createHash, createHmac, randomBytes } from 'crypto'
import { getLocalDb } from './LocalDatabaseService'

export interface AuthUser {
  id: string
  email: string
  status: 'active' | 'disabled'
  createdAt: string
  updatedAt: string
}

export interface AuthSession {
  accessToken: string
  refreshToken: string
  expiresAt: string
  user: AuthUser
}

interface AccessTokenPayload {
  sub: string
  email: string
  iat: number
  exp: number
}

const ACCESS_EXPIRES_SECONDS = 15 * 60
const REFRESH_EXPIRES_SECONDS = 7 * 24 * 60 * 60
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const nowIso = () => new Date().toISOString()
const toUnix = (date: Date) => Math.floor(date.getTime() / 1000)
const runtimeFallbackJwtSecret = randomBytes(48).toString('hex')

const base64UrlEncode = (value: Buffer | string) =>
  Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')

const base64UrlDecode = (value: string) => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const remainder = padded.length % 4
  const finalValue = remainder ? `${padded}${'='.repeat(4 - remainder)}` : padded
  return Buffer.from(finalValue, 'base64')
}

const getJwtSecret = () => {
  const fromEnv = process.env.JWT_SECRET?.trim()
  if (fromEnv) return fromEnv
  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
    throw new Error('JWT_SECRET 未配置，生产环境禁止使用默认密钥')
  }
  return runtimeFallbackJwtSecret
}

const signJwt = (payload: AccessTokenPayload) => {
  const header = { alg: 'HS256', typ: 'JWT' }
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signature = createHmac('sha256', getJwtSecret())
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest()
  return `${encodedHeader}.${encodedPayload}.${base64UrlEncode(signature)}`
}

const verifyJwt = (token: string): AccessTokenPayload | null => {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [encodedHeader, encodedPayload, encodedSignature] = parts
  if (!encodedHeader || !encodedPayload || !encodedSignature) return null
  const expected = createHmac('sha256', getJwtSecret())
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest()
  if (base64UrlEncode(expected) !== encodedSignature) return null

  try {
    const payload = JSON.parse(
      base64UrlDecode(encodedPayload).toString('utf8')
    ) as AccessTokenPayload
    if (!payload?.sub || !payload?.email || !payload?.exp) return null
    if (payload.exp <= toUnix(new Date())) return null
    return payload
  } catch {
    return null
  }
}

const hashRefreshToken = (token: string) => createHash('sha256').update(token).digest('hex')

const normalizeUser = (row: any): AuthUser => ({
  id: row.id,
  email: row.email,
  status: row.status === 'disabled' ? 'disabled' : 'active',
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

export class AuthService {
  static normalizeEmail(email: string) {
    return (email || '').trim().toLowerCase()
  }

  static async register(email: string, password: string): Promise<AuthUser> {
    const normalizedEmail = this.normalizeEmail(email)
    const normalizedPassword = String(password || '')
    if (!EMAIL_RE.test(normalizedEmail)) {
      throw new Error('邮箱格式不正确')
    }
    if (normalizedPassword.length < 8) {
      throw new Error('密码长度至少 8 位')
    }

    const db = getLocalDb()
    const existing = db.prepare(`SELECT id FROM users WHERE email = ? LIMIT 1`).get(normalizedEmail)
    if (existing) {
      throw new Error('该邮箱已注册')
    }

    const now = nowIso()
    const userId = `usr_${crypto.randomUUID()}`
    const passwordHash = await Bun.password.hash(normalizedPassword)
    db.prepare(
      `
      INSERT INTO users (id, email, password_hash, status, created_at, updated_at)
      VALUES (?, ?, ?, 'active', ?, ?)
    `
    ).run(userId, normalizedEmail, passwordHash, now, now)

    const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId)
    return normalizeUser(row)
  }

  static async login(email: string, password: string): Promise<AuthUser> {
    const normalizedEmail = this.normalizeEmail(email)
    const db = getLocalDb()
    const row = db
      .prepare(`SELECT * FROM users WHERE email = ? LIMIT 1`)
      .get(normalizedEmail) as any
    if (!row) throw new Error('账号或密码错误')
    if (row.status !== 'active') throw new Error('账号已停用')
    const ok = await Bun.password.verify(password, row.password_hash)
    if (!ok) throw new Error('账号或密码错误')
    return normalizeUser(row)
  }

  static createSession(user: AuthUser): AuthSession {
    const now = new Date()
    const accessExp = new Date(now.getTime() + ACCESS_EXPIRES_SECONDS * 1000)
    const refreshExp = new Date(now.getTime() + REFRESH_EXPIRES_SECONDS * 1000)
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      iat: toUnix(now),
      exp: toUnix(accessExp)
    }
    const accessToken = signJwt(payload)
    const refreshToken = base64UrlEncode(randomBytes(36))
    const refreshTokenHash = hashRefreshToken(refreshToken)
    const db = getLocalDb()
    db.prepare(
      `
      INSERT INTO auth_refresh_tokens (id, user_id, token_hash, expires_at, revoked_at, created_at)
      VALUES (?, ?, ?, ?, NULL, ?)
    `
    ).run(
      `rt_${crypto.randomUUID()}`,
      user.id,
      refreshTokenHash,
      refreshExp.toISOString(),
      now.toISOString()
    )
    return {
      accessToken,
      refreshToken,
      expiresAt: accessExp.toISOString(),
      user
    }
  }

  static verifyAccessToken(token: string): AuthUser | null {
    const payload = verifyJwt((token || '').trim())
    if (!payload) return null
    const row = getLocalDb()
      .prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`)
      .get(payload.sub) as any
    if (!row || row.status !== 'active') return null
    return normalizeUser(row)
  }

  static rotateSession(refreshToken: string): AuthSession {
    const tokenHash = hashRefreshToken((refreshToken || '').trim())
    const now = nowIso()
    const db = getLocalDb()
    const tx = db.transaction(() => {
      const row = db
        .prepare(
          `
        SELECT * FROM auth_refresh_tokens
        WHERE token_hash = ? AND revoked_at IS NULL
        LIMIT 1
      `
        )
        .get(tokenHash) as any
      if (!row) throw new Error('刷新令牌无效')
      if (new Date(row.expires_at).getTime() <= Date.now()) {
        db.prepare(`UPDATE auth_refresh_tokens SET revoked_at = ? WHERE id = ?`).run(now, row.id)
        throw new Error('刷新令牌已过期')
      }
      const userRow = db.prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`).get(row.user_id) as any
      if (!userRow || userRow.status !== 'active') {
        db.prepare(`UPDATE auth_refresh_tokens SET revoked_at = ? WHERE id = ?`).run(now, row.id)
        throw new Error('用户不可用')
      }
      const revoked = db
        .prepare(
          `
        UPDATE auth_refresh_tokens
        SET revoked_at = ?
        WHERE id = ? AND revoked_at IS NULL
      `
        )
        .run(now, row.id)
      if ((revoked.changes || 0) !== 1) {
        throw new Error('刷新令牌已失效')
      }
      return normalizeUser(userRow)
    })
    const user = tx()
    return this.createSession(user)
  }

  static revokeRefreshToken(refreshToken: string) {
    const tokenHash = hashRefreshToken((refreshToken || '').trim())
    getLocalDb()
      .prepare(
        `
      UPDATE auth_refresh_tokens
      SET revoked_at = COALESCE(revoked_at, ?)
      WHERE token_hash = ?
    `
      )
      .run(nowIso(), tokenHash)
  }
}
