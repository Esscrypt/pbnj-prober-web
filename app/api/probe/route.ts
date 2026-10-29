const PROBER_URL = process.env.PROBER_URL ?? 'http://localhost:8099'
const PROBER_SECRET = process.env.PROBER_SECRET ?? ''

/// A probe outlives any single serverless invocation — Vercel caps a function
/// well under a run's length, and the spam lanes will be longer again. So this
/// route only STARTS a run and hands back its id; the client polls
/// /api/probe/<runId> for the report.
function proberHeaders(): Record<string, string> {
  return {
    'content-type': 'application/json',
    ...(PROBER_SECRET === '' ? {} : { 'x-prober-secret': PROBER_SECRET }),
  }
}

function unreachable(error: unknown): Response {
  return Response.json(
    {
      error: `could not reach the prober service: ${
        error instanceof Error ? error.message : String(error)
      }`,
    },
    { status: 502 },
  )
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'body must be JSON' }, { status: 400 })
  }

  try {
    const upstream = await fetch(`${PROBER_URL}/probe`, {
      method: 'POST',
      headers: proberHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    })
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { 'content-type': 'application/json' },
    })
  } catch (error) {
    return unreachable(error)
  }
}

export async function GET(): Promise<Response> {
  try {
    const upstream = await fetch(`${PROBER_URL}/health`, {
      headers: proberHeaders(),
      signal: AbortSignal.timeout(10_000),
    })
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { 'content-type': 'application/json' },
    })
  } catch (error) {
    return unreachable(error)
  }
}
