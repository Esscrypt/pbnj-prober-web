const PROBER_URL = process.env.PROBER_URL ?? 'http://localhost:8099'
const PROBER_SECRET = process.env.PROBER_SECRET ?? ''

const RUN_ID = /^[0-9a-fA-F-]{36}$/

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
): Promise<Response> {
  const { runId } = await context.params

  if (!RUN_ID.test(runId)) {
    return Response.json({ error: 'malformed run id' }, { status: 400 })
  }

  try {
    const upstream = await fetch(`${PROBER_URL}/probe/${runId}`, {
      headers: {
        'content-type': 'application/json',
        ...(PROBER_SECRET === '' ? {} : { 'x-prober-secret': PROBER_SECRET }),
      },
      signal: AbortSignal.timeout(15_000),
    })
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { 'content-type': 'application/json' },
    })
  } catch (error) {
    return Response.json(
      {
        error: `could not reach the prober service: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 502 },
    )
  }
}
