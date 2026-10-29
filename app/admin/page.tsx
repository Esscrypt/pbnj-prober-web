'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface Implementation {
  id: string
  label: string
  available: boolean
  reason?: string
}

interface SeatState {
  seat: number
  port: number
  unit: string
  state: string
  implementation: string | null
  peerId: string
}

const LOG_REFRESH_MS = 5000

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [signedIn, setSignedIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [implementations, setImplementations] = useState<Implementation[]>([])
  const [seats, setSeats] = useState<SeatState[]>([])
  const [choice, setChoice] = useState<Record<number, string>>({})
  const [openLogs, setOpenLogs] = useState<number[]>([])
  const [logText, setLogText] = useState<Record<number, string>>({})
  const [lines, setLines] = useState(300)
  const [follow, setFollow] = useState(true)
  const panes = useRef<Record<number, HTMLPreElement | null>>({})

  const refresh = useCallback(async () => {
    const response = await fetch('/api/admin/validators', {
      cache: 'no-store',
    })
    if (response.status === 401) {
      setSignedIn(false)
      return
    }
    const payload = (await response.json()) as {
      implementations?: Implementation[]
      seats?: SeatState[]
      error?: string
    }
    if (payload.error) {
      setError(payload.error)
      return
    }
    setError(null)
    setSignedIn(true)
    setImplementations(payload.implementations ?? [])
    setSeats(payload.seats ?? [])
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const loadLogs = useCallback(
    async (seat: number) => {
      const response = await fetch(
        `/api/admin/validators/${seat}/logs?lines=${lines}`,
        { cache: 'no-store' },
      )
      const payload = (await response.json()) as {
        logs?: string
        error?: string
      }
      setLogText((current) => ({
        ...current,
        [seat]: payload.logs ?? payload.error ?? '(nothing)',
      }))
    },
    [lines],
  )

  useEffect(() => {
    if (!signedIn || !follow || openLogs.length === 0) {
      return
    }
    const timer = setInterval(() => {
      for (const seat of openLogs) {
        void loadLogs(seat)
      }
    }, LOG_REFRESH_MS)
    return () => clearInterval(timer)
  }, [signedIn, follow, openLogs, loadLogs])

  // Follow the tail the way a terminal would: only when the reader is already
  // at the bottom, so scrolling back to read something is not yanked away by
  // the next poll.
  useEffect(() => {
    for (const seat of openLogs) {
      const pane = panes.current[seat]
      if (!pane || logText[seat] === undefined) {
        continue
      }
      const distance = pane.scrollHeight - pane.scrollTop - pane.clientHeight
      if (follow && distance < 120) {
        pane.scrollTop = pane.scrollHeight
      }
    }
  }, [logText, openLogs, follow])

  async function signIn(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const response = await fetch('/api/admin/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const payload = (await response.json()) as { error?: string }
    if (payload.error) {
      setError(payload.error)
      return
    }
    setPassword('')
    await refresh()
  }

  async function signOut() {
    await fetch('/api/admin/session', { method: 'DELETE' })
    setSignedIn(false)
    setSeats([])
    setOpenLogs([])
    setLogText({})
  }

  function defaultChoice(seat: SeatState): string {
    return choice[seat.seat] ?? seat.implementation ?? 'pbnjam'
  }

  async function act(seat: SeatState, action: 'start' | 'stop') {
    setBusy(`${seat.seat}-${action}`)
    setError(null)
    try {
      const response = await fetch(
        `/api/admin/validators/${seat.seat}/${action}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body:
            action === 'start'
              ? JSON.stringify({ implementation: defaultChoice(seat) })
              : undefined,
        },
      )
      const payload = (await response.json()) as {
        error?: string
        seats?: SeatState[]
      }
      if (payload.error) {
        setError(payload.error)
      }
      if (payload.seats) {
        setSeats(payload.seats)
      } else {
        await refresh()
      }
      if (openLogs.includes(seat.seat)) {
        await loadLogs(seat.seat)
      }
    } finally {
      setBusy(null)
    }
  }

  function toggleLog(seat: number) {
    if (openLogs.includes(seat)) {
      setOpenLogs(openLogs.filter((candidate) => candidate !== seat))
      return
    }
    setOpenLogs([...openLogs, seat].sort((a, b) => a - b))
    void loadLogs(seat)
  }

  function showAllLogs() {
    const all = seats.map((seat) => seat.seat)
    setOpenLogs(all)
    for (const seat of all) {
      void loadLogs(seat)
    }
  }

  if (!signedIn) {
    return (
      <main>
        <h1>Validator control</h1>
        <p className="lede">
          The five validator seats we run on the probe chain. Sign in to start
          or stop them and read their logs.
        </p>
        <form onSubmit={signIn}>
          <div className="wide">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <button type="submit">Sign in</button>
        </form>
        {error ? <p className="error">{error}</p> : null}
      </main>
    )
  }

  return (
    <main>
      <h1>Validator control</h1>
      <p className="lede">
        Seats 1 to 5 on the probe chain. Seat 0 belongs to whoever is being
        tested, so it is not listed here.
      </p>

      <section className="panel">
        <h2>Implementations</h2>
        <ul className="impls">
          {implementations.map((implementation) => (
            <li
              key={implementation.id}
              data-available={implementation.available}
            >
              <strong>{implementation.label}</strong>{' '}
              {implementation.available ? (
                <span className="clean">available</span>
              ) : (
                <span className="detail">
                  unavailable — {implementation.reason}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {error ? <p className="error">{error}</p> : null}

      <table>
        <thead>
          <tr>
            <th>Seat</th>
            <th>Port</th>
            <th>State</th>
            <th>Current</th>
            <th>Start as</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {seats.map((seat) => (
            <tr key={seat.seat}>
              <td>{seat.seat}</td>
              <td>{seat.port}</td>
              <td>{seat.state}</td>
              <td>{seat.implementation ?? '—'}</td>
              <td>
                <select
                  value={defaultChoice(seat)}
                  onChange={(event) =>
                    setChoice({ ...choice, [seat.seat]: event.target.value })
                  }
                >
                  {implementations.map((implementation) => (
                    <option
                      key={implementation.id}
                      value={implementation.id}
                      disabled={!implementation.available}
                    >
                      {implementation.id}
                      {implementation.available ? '' : ' (unavailable)'}
                    </option>
                  ))}
                </select>
              </td>
              <td className="actions">
                <button
                  type="button"
                  onClick={() => act(seat, 'start')}
                  disabled={busy !== null}
                >
                  {busy === `${seat.seat}-start` ? '…' : 'Start'}
                </button>
                <button
                  type="button"
                  onClick={() => act(seat, 'stop')}
                  disabled={busy !== null}
                >
                  {busy === `${seat.seat}-stop` ? '…' : 'Stop'}
                </button>
                <button
                  type="button"
                  onClick={() => toggleLog(seat.seat)}
                  aria-pressed={openLogs.includes(seat.seat)}
                >
                  {openLogs.includes(seat.seat) ? 'Hide log' : 'Log'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="actions">
        <button type="button" onClick={() => void refresh()}>
          Refresh
        </button>
        <button type="button" onClick={showAllLogs}>
          Show all logs
        </button>
        <button
          type="button"
          onClick={() => setOpenLogs([])}
          disabled={openLogs.length === 0}
        >
          Hide all logs
        </button>
        <button type="button" onClick={signOut}>
          Sign out
        </button>
      </p>

      {openLogs.length > 0 ? (
        <section className="panel">
          <h2>Logs</h2>
          <div className="logcontrols">
            <label>
              <input
                type="checkbox"
                checked={follow}
                onChange={(event) => setFollow(event.target.checked)}
              />{' '}
              Follow the tail (every {LOG_REFRESH_MS / 1000}s)
            </label>
            <label>
              Lines{' '}
              <select
                value={lines}
                onChange={(event) => setLines(Number(event.target.value))}
              >
                {[100, 300, 1000, 2000].map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="logpanes">
            {openLogs.map((seat) => {
              const state = seats.find((candidate) => candidate.seat === seat)
              return (
                <article key={seat} className="logpane">
                  <h3>
                    Seat {seat}{' '}
                    <span className="detail">
                      port {state?.port} · {state?.implementation ?? 'stopped'}{' '}
                      · {state?.state}
                    </span>
                  </h3>
                  <pre
                    className="logs"
                    ref={(element) => {
                      panes.current[seat] = element
                    }}
                  >
                    {logText[seat] ?? 'loading…'}
                  </pre>
                </article>
              )
            })}
          </div>
        </section>
      ) : null}
    </main>
  )
}
