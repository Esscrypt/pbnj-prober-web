# pbnj prober — web

The frontend for the JAMNP node tester. A JAM team enters their node's IPv6
address and port, and gets back spec-citing findings about how it behaves
under probing. Audience is hardening, not assessment: no scores, no
leaderboard.

Standalone Next.js app (not a member of the pbnj bun workspace), deployed to
Vercel. In the pbnj monorepo it is a git submodule at `web/`.

```bash
bun install
bun run dev     # http://localhost:3000
bun run build
```

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Submit a target, see setup guidance and the probe report |
| `/admin` | Password-gated: start/stop the five validator seats and read their logs |

Every route proxies the prober service through `app/api/*` so the shared
secret stays server-side. The browser never sees it.

## Environment

| Variable | Meaning |
| --- | --- |
| `PROBER_URL` | Base URL of the prober service (e.g. `https://probe.example`) |
| `PROBER_SECRET` | Shared secret sent as `x-prober-secret`; must match the box |
| `ADMIN_PASSWORD` | Password for `/admin` |
| `ADMIN_SESSION_KEY` | HMAC key for the admin session cookie |

Set all four in the Vercel project. `/admin` returns 503 until the admin
variables exist, so the public page works without them.

## The chain is served, not hardcoded

The spec download, the genesis hash, the ALPN we offer and the setup
instructions all come from the service's `/chain` at request time, because
they depend on which implementation the seats are currently running. Nothing
about the chain is baked into this app.
