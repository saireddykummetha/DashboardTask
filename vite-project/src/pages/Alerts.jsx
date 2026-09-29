import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { alertsApi, marketApi, portfolioApi } from '../api'
import Layout from '../components/Layout'
import { formatINR, shortSymbol } from '../utils'

export default function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [portfolio, setPortfolio] = useState([])
  const [quotes, setQuotes] = useState([])
  const [symbol, setSymbol] = useState('')
  const [threshold, setThreshold] = useState('')
  const [direction, setDirection] = useState('above')
  const [mode, setMode] = useState('recurring')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try {
      const [a, p, m] = await Promise.all([alertsApi.list(), portfolioApi.get(), marketApi.quotes()])
      setAlerts(a || [])
      setPortfolio(p.symbols || [])
      setQuotes(m.quotes || [])
      if (!symbol && p.symbols?.length) setSymbol(p.symbols[0])
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const quoteMap = useMemo(() => Object.fromEntries(quotes.map((q) => [q.symbol, q])), [quotes])

  const onCreate = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await alertsApi.create({
        symbol,
        threshold: Number(threshold),
        direction,
        mode,
      })
      setThreshold('')
      setMessage('Alert created')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async (id) => {
    try {
      await alertsApi.remove(id)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Layout>
      <div className="page-head">
        <div>
          <h1>Price alerts</h1>
          <p className="muted">
            Alert when a followed stock goes above or below your price. Recurring alerts re-arm after
            the price crosses back (no spam). One-time alerts disable after firing.
          </p>
        </div>
      </div>

      {message && <div className="banner ok">{message}</div>}
      {error && <div className="banner error">{error}</div>}

      {!portfolio.length && (
        <div className="banner info">
          Add stocks to your <Link to="/portfolio">portfolio</Link> before creating alerts.
        </div>
      )}

      <section className="grid-2">
        <form className="panel form-panel" onSubmit={onCreate}>
          <h2>New alert</h2>
          <label>
            Stock
            <select required value={symbol} onChange={(e) => setSymbol(e.target.value)}>
              {portfolio.map((s) => (
                <option key={s} value={s}>
                  {shortSymbol(s)}
                  {quoteMap[s] ? ` — ${formatINR(quoteMap[s].price)}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Threshold (₹)
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="e.g. 3000"
            />
          </label>
          <label>
            Direction
            <select value={direction} onChange={(e) => setDirection(e.target.value)}>
              <option value="above">Rises above</option>
              <option value="below">Falls below</option>
            </select>
          </label>
          <label>
            Mode
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="recurring">Recurring (re-arm after reverse cross)</option>
              <option value="one_time">One-time (disable after fire)</option>
            </select>
          </label>
          <button className="btn primary" type="submit" disabled={busy || !portfolio.length}>
            {busy ? 'Saving…' : 'Create alert'}
          </button>
        </form>

        <div className="panel">
          <div className="panel-head">
            <h2>Your alerts</h2>
          </div>
          <ul className="alert-list">
            {alerts.map((a) => (
              <li key={a.id}>
                <div>
                  <strong>
                    {shortSymbol(a.symbol)} {a.direction === 'above' ? '≥' : '≤'} {formatINR(a.threshold)}
                  </strong>
                  <span className="muted">
                    {a.mode} · {a.active ? (a.armed ? 'armed' : 'waiting to re-arm') : 'inactive'}
                    {a.last_triggered_at
                      ? ` · last fired ${new Date(a.last_triggered_at).toLocaleString()}`
                      : ''}
                  </span>
                  {quoteMap[a.symbol] && (
                    <span className="muted">Spot: {formatINR(quoteMap[a.symbol].price)}</span>
                  )}
                </div>
                <button type="button" className="btn ghost sm danger" onClick={() => onDelete(a.id)}>
                  Delete
                </button>
              </li>
            ))}
            {!alerts.length && <li className="muted">No alerts yet.</li>}
          </ul>
        </div>
      </section>
    </Layout>
  )
}
