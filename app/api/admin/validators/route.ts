import {
  authorised,
  PROBER_URL,
  proberHeaders,
  unreachable,
} from '../../../../lib/admin-proxy'

export async function GET(request: Request): Promise<Response> {
  if (!authorised(request)) {
    return Response.json({ error: 'not signed in' }, { status: 401 })
  }

  try {
    const upstream = await fetch(`${PROBER_URL}/validators`, {
      headers: proberHeaders(),
      signal: AbortSignal.timeout(20_000),
      cache: 'no-store',
    })
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { 'content-type': 'application/json' },
    })
  } catch (error) {
    return unreachable(error)
  }
}
