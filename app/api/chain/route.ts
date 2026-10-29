const PROBER_URL = process.env.PROBER_URL ?? 'http://localhost:8099'
const PROBER_SECRET = process.env.PROBER_SECRET ?? ''

export async function GET(): Promise<Response> {
  try {
    const upstream = await fetch(`${PROBER_URL}/chain`, {
      headers: PROBER_SECRET === '' ? {} : { 'x-prober-secret': PROBER_SECRET },
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
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
