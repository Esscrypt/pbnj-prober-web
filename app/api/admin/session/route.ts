import {
  ADMIN_COOKIE,
  adminConfigured,
  checkPassword,
  issueToken,
} from '../../../../lib/admin-session'

export async function POST(request: Request): Promise<Response> {
  if (!adminConfigured()) {
    return Response.json(
      { error: 'the admin area is not configured on this deployment' },
      { status: 503 },
    )
  }

  let body: { password?: unknown }
  try {
    body = (await request.json()) as { password?: unknown }
  } catch {
    return Response.json({ error: 'body must be JSON' }, { status: 400 })
  }

  if (!checkPassword(body.password)) {
    return Response.json({ error: 'wrong password' }, { status: 401 })
  }

  const token = issueToken()
  if (token === null) {
    return Response.json(
      { error: 'could not issue a session' },
      { status: 500 },
    )
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'set-cookie': `${ADMIN_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${8 * 60 * 60}`,
    },
  })
}

export async function DELETE(): Promise<Response> {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'set-cookie': `${ADMIN_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
    },
  })
}
