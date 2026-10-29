'use client'

import { useEffect, useState } from 'react'

interface Finding {
  scenarioId: string
  category: string
  severity: 'violation' | 'observation' | 'error'
  title: string
  detail: string
  specRef?: string
}

interface ProbeReport {
  target: { host: string; port: number; negotiatedAlpn: string | null }
  peerPublicKey: string | null
  startedAt: string
  finishedAt: string
  findings: Finding[]
  counts: Record<string, number>
}

interface ChainValidator {
  index: number
  peerId: string
  netAddr: string
  role: 'tester' | 'ours'
}

interface ChainInfo {
  chainId: string
  implementation: string
  specFile: string
  genesisHeaderHash: string
  alpn: string[]
  testerSeat: number
  ourSeats: number[]
  validators: ChainValidator[]
  setup: string[]
}

export default function Page() {
  const [host, setHost] = useState('')
  const [port, setPort] = useState('40000')
  const [running, setRunning] = useState(false)
  const [report, setReport] = useState<ProbeReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [chain, setChain] = useState<ChainInfo | null>(null)
  const [chainError, setChainError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/chain')
      .then((response) => response.json())
      .then((payload: ChainInfo & { error?: string }) => {
        if (payload.error) {
          setChainError(payload.error)
        } else {
          setChain(payload)
        }
      })
      .catch((caught) => setChainError(String(caught)))
  }, [])

  // The run is started by one request and collected by another: a probe takes
  // longer than a serverless function is allowed to live, so the page polls.
  async function run(event: React.FormEvent) {
    event.preventDefault()
    setRunning(true)
    setError(null)
    setReport(null)

    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms))

    try {
      const started = await fetch('/api/probe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ host, port }),
      })
      const startPayload = (await started.json()) as {
        runId?: string
        error?: string
      }
      if (!startPayload.runId) {
        setError(
          startPayload.error ?? `could not start a run (${started.status})`,
        )
        return
      }

      const deadline = Date.now() + 300_000
      while (Date.now() < deadline) {
        await sleep(1500)
        const polled = await fetch(`/api/probe/${startPayload.runId}`)
        const payload = (await polled.json()) as {
          status?: string
          report?: ProbeReport
          error?: string
        }
        if (payload.status === 'done' && payload.report) {
          setReport(payload.report)
          return
        }
        if (payload.status === 'error' || payload.error) {
          setError(payload.error ?? 'the run failed')
          return
        }
      }
      setError('the run did not finish within five minutes')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setRunning(false)
    }
  }

  const elapsed = report
    ? (new Date(report.finishedAt).getTime() -
        new Date(report.startedAt).getTime()) /
      1000
    : 0

  return (
    <main>
      <h1>JAMNP Node Tester</h1>
      <p className="lede">
        Point this at a JAM node you run. It dials your node over JAMNP-S as an
        ordinary peer and reports what it saw. Conformance findings quote the
        sentence of the spec they rest on; resilience findings only describe
        what happened, because the spec does not say what should.
      </p>

      <section className="panel">
        <h2>Before you run it</h2>
        {chainError ? (
          <p className="error">
            Could not load the chain details: {chainError}
          </p>
        ) : !chain ? (
          <p className="detail">Loading chain details…</p>
        ) : (
          <>
            <ol className="steps">
              {chain.setup.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>

            <div className="facts">
              <div>
                <span>Chain</span>
                <code>{chain.chainId}</code>
              </div>
              <div>
                <span>Your seat</span>
                <code>dev validator {chain.testerSeat}</code>
              </div>
              <div>
                <span>Our seats</span>
                <code>{chain.ourSeats.join(', ')}</code>
              </div>
              <div className="wide">
                <span>Genesis header hash (you do not need to enter this)</span>
                <code>{chain.genesisHeaderHash}</code>
              </div>
              <div className="wide">
                <span>ALPN we offer</span>
                <code>{chain.alpn.join('  ·  ')}</code>
              </div>
            </div>

            <p>
              <a className="download" href="/api/chain/spec" download>
                ↓ Download {chain.specFile}
              </a>
            </p>

            <details>
              <summary>Validator seats on this chain</summary>
              <table>
                <thead>
                  <tr>
                    <th>Seat</th>
                    <th>Who</th>
                    <th>Peer id (certificate alternative name)</th>
                  </tr>
                </thead>
                <tbody>
                  {chain.validators.map((validator) => (
                    <tr key={validator.index}>
                      <td>{validator.index}</td>
                      <td>{validator.role === 'tester' ? 'you' : 'us'}</td>
                      <td>
                        <code className="small">{validator.peerId}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        )}
      </section>

      <form onSubmit={run}>
        <div>
          <label htmlFor="host">Your node&rsquo;s IPv6 address</label>
          <input
            id="host"
            value={host}
            onChange={(event) => setHost(event.target.value)}
            placeholder="2001:db8::1"
            required
          />
        </div>
        <div>
          <label htmlFor="port">UDP port</label>
          <input
            id="port"
            value={port}
            onChange={(event) => setPort(event.target.value)}
            inputMode="numeric"
            required
          />
        </div>
        <button type="submit" disabled={running}>
          {running ? 'Probing…' : 'Run probe'}
        </button>
      </form>

      {error ? <p className="error">{error}</p> : null}

      {report ? (
        <>
          <div className="summary">
            <div>
              <span>Target</span>
              <strong>
                {report.target.host}:{report.target.port}
              </strong>
            </div>
            <div>
              <span>Negotiated ALPN</span>
              <strong>{report.target.negotiatedAlpn ?? 'unknown'}</strong>
            </div>
            <div>
              <span>Violations</span>
              <strong>{report.counts.violation ?? 0}</strong>
            </div>
            <div>
              <span>Observations</span>
              <strong>{report.counts.observation ?? 0}</strong>
            </div>
            <div>
              <span>Took</span>
              <strong>{elapsed.toFixed(1)}s</strong>
            </div>
          </div>

          {report.peerPublicKey ? (
            <p className="note">
              Your node presented Ed25519 key{' '}
              <code>{report.peerPublicKey}</code>
            </p>
          ) : null}

          {report.findings.length === 0 ? (
            <p className="note clean">
              Nothing to report — every scenario ran and found nothing notable.
            </p>
          ) : (
            <ul>
              {report.findings.map((finding, index) => (
                <li
                  key={`${finding.scenarioId}-${index}`}
                  data-severity={finding.severity}
                >
                  <div className="sev">
                    {finding.severity} · {finding.category}
                  </div>
                  <div className="title">{finding.title}</div>
                  <div className="detail">{finding.detail}</div>
                  {finding.specRef ? (
                    <div className="ref">{finding.specRef}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </main>
  )
}
