const PROBER_URL = process.env.PROBER_URL ?? 'http://localhost:8099'
const PROBER_SECRET = process.env.PROBER_SECRET ?? ''

export async function GET(): Promise<Response> {
  try {
    const upstream = await fetch(`${PROBER_URL}/chain/spec`, {
      headers: PROBER_SECRET === '' ? {} : { 'x-prober-secret': PROBER_SECRET },
      signal: AbortSignal.timeout(20_000),
      cache: 'no-store',
    })
    // The spec file depends on which implementation the seats are running, so
    // the name comes from upstream rather than being fixed here. Constrained
    // to a bare filename before it reaches a download header.
    const offered = upstream.headers
      .get('content-disposition')
      ?.match(/filename="([^"]+)"/)?.[1]
    const filename =
      offered && /^[A-Za-z0-9._-]+$/.test(offered) ? offered : 'chain-spec.json'

    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        'content-type': 'application/json',
        'content-disposition': `attachment; filename="${filename}"`,
      },
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
