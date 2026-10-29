import { ADMIN_COOKIE, tokenIsValid } from './admin-session'

export const PROBER_URL = process.env.PROBER_URL ?? 'http://localhost:8099'
const PROBER_SECRET = process.env.PROBER_SECRET ?? ''

function cookieToken(request: Request): string | undefined {
  return request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_COOKIE}=`))
    ?.slice(ADMIN_COOKIE.length + 1)
}

/// Checked HERE, on the server, before the shared secret is ever attached. A
/// client-side check would be decoration: the browser can call the route
/// directly whatever the page renders.
export function authorised(request: Request): boolean {
  return tokenIsValid(cookieToken(request))
}

export function proberHeaders(): Record<string, string> {
  return {
    'content-type': 'application/json',
    ...(PROBER_SECRET === '' ? {} : { 'x-prober-secret': PROBER_SECRET }),
  }
}

export function unreachable(error: unknown): Response {
  return Response.json(
    {
      error: `could not reach the prober service: ${
        error instanceof Error ? error.message : String(error)
      }`,
    },
    { status: 502 },
  )
}
