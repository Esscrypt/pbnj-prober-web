import { createHmac, timingSafeEqual } from 'node:crypto'

export const ADMIN_COOKIE = 'pbnj_admin'

const SESSION_MS = 8 * 60 * 60 * 1000

function secret(): string | null {
  const password = process.env.ADMIN_PASSWORD
  return password === undefined || password === '' ? null : password
}

function sign(payload: string, key: string): string {
  return createHmac('sha256', key).update(payload).digest('base64url')
}

/// Compared with timingSafeEqual rather than ===, so a wrong password cannot be
/// narrowed down by how long the comparison takes. Lengths are checked first
/// because timingSafeEqual throws on a mismatch.
function equals(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) {
    return false
  }
  return timingSafeEqual(left, right)
}

export function checkPassword(candidate: unknown): boolean {
  const key = secret()
  if (key === null || typeof candidate !== 'string') {
    return false
  }
  return equals(candidate, key)
}

export function issueToken(now = Date.now()): string | null {
  const key = secret()
  if (key === null) {
    return null
  }
  const expiry = String(now + SESSION_MS)
  return `${Buffer.from(expiry).toString('base64url')}.${sign(expiry, key)}`
}

/// The cookie carries only an expiry and its signature — no password, and
/// nothing an attacker could replay past the expiry without the key.
export function tokenIsValid(token: unknown, now = Date.now()): boolean {
  const key = secret()
  if (key === null || typeof token !== 'string') {
    return false
  }

  const [encodedExpiry, signature] = token.split('.')
  if (!encodedExpiry || !signature) {
    return false
  }

  let expiry: string
  try {
    expiry = Buffer.from(encodedExpiry, 'base64url').toString()
  } catch {
    return false
  }

  if (!equals(signature, sign(expiry, key))) {
    return false
  }

  const expiresAt = Number(expiry)
  return Number.isFinite(expiresAt) && expiresAt > now
}

export function adminConfigured(): boolean {
  return secret() !== null
}
