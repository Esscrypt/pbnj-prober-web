import {
  authorised,
  PROBER_URL,
  proberHeaders,
  unreachable,
} from '../../../../../../lib/admin-proxy'

const SEATS = new Set(['1', '2', '3', '4', '5'])
const ACTIONS = new Set(['start', 'stop', 'logs'])

type Context = { params: Promise<{ seat: string; action: string }> }

/// The seat and action are re-validated here even though the service validates
/// them again: this route interpolates them into the upstream URL, and the
/// service is what turns them into a unit name and a process.
async function forward(request: Request, context: Context): Promise<Response> {
  if (!authorised(request)) {
    return Response.json({ error: 'not signed in' }, { status: 401 })
  }

  const { seat, action } = await context.params
  if (!SEATS.has(seat) || !ACTIONS.has(action)) {
    return Response.json({ error: 'unknown seat or action' }, { status: 400 })
  }

  const method = action === 'logs' ? 'GET' : 'POST'
  if (request.method !== method) {
    return Response.json({ error: 'method not allowed' }, { status: 405 })
  }

  const lines = new URL(request.url).searchParams.get('lines')
  const query =
    action === 'logs' && lines ? `?lines=${Number(lines) || 200}` : ''

  const body =
    method === 'POST' && action === 'start' ? await request.text() : undefined

  try {
    const upstream = await fetch(
      `${PROBER_URL}/validators/${seat}/${action}${query}`,
      {
        method,
        headers: proberHeaders(),
        body,
        signal: AbortSignal.timeout(30_000),
        cache: 'no-store',
      },
    )
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { 'content-type': 'application/json' },
    })
  } catch (error) {
    return unreachable(error)
  }
}

export const GET = forward
export const POST = forward
