import { useEffect, useMemo, useState } from 'react'
import { marketApi, portfolioApi } from '../api'
import Layout from '../components/Layout'
import { formatINR, formatPct, shortSymbol } from '../utils'

const MAX_PICKS = 15

export default function Portfolio() {
  const [symbols, setSymbols] = useState([])
  const [universe, setUniverse] = useState([])
  const [quotes, setQuotes] = useState([])
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try {
      const [pf, syms, mkt] = await Promise.all([
        portfolioApi.get(),
        marketApi.symbols(),
        marketApi.quotes(),
      ])
      setSymbols(pf.symbols || [])
      setUniverse(syms || [])
      setQuotes(mkt.quotes || [])
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const quoteMap = useMemo(() => Object.fromEntries(quotes.map((q) => [q.symbol, q])), [quotes])

  const available = useMemo(() => {
    const q = query.trim().toLowerCase()
    return universe.filter((s) => {
      if (symbols.includes(s.symbol)) return false
      if (!q) return true
      return (
        s.symbol.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        shortSymbol(s.symbol).toLowerCase().includes(q)
      )
    })
  }, [universe, symbols, query])

  const add = (symbol) => {
    if (symbols.length >= MAX_PICKS) {
      setError(`You can follow up to ${MAX_PICKS} stocks`)
      return
    }
    setSymbols((prev) => [...prev, symbol])
    setError('')
  }

  const remove = (symbol) => {
    setSymbols((prev) => prev.filter((s) => s !== symbol))
  }

  const save = async () => {
    if (symbols.length < 1) {
      setError('Select about 10–15 stocks for your portfolio')
      return
    }
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const pf = await portfolioApi.update(symbols)
      setSymbols(pf.symbols)
      setMessage('Portfolio saved')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout>
      <div className="page-head">
        <div>
          <h1>Your portfolio</h1>
          <p className="muted">Select roughly 10–15 NSE stocks to follow (max {MAX_PICKS}).</p>
        </div>
        <button type="button" className="btn primary" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : `Save (${symbols.length}/${MAX_PICKS})`}
        </button>
      </div>

      {message && <div className="banner ok">{message}</div>}
      {error && <div className="banner error">{error}</div>}

      <section className="grid-2">
        <div className="panel">
          <div className="panel-head">
            <h2>My stocks</h2>
          </div>
          <ul className="watch-list">
            {symbols.map((sym) => {
              const q = quoteMap[sym]
              return (
                <li key={sym}>
                  <div>
                    <strong>{shortSymbol(sym)}</strong>
                    <span className="muted">{q?.name || sym}</span>
                  </div>
                  <div className="watch-meta">
                    <span>{q ? formatINR(q.price) : '—'}</span>
                    <span className={q && q.change_percent >= 0 ? 'up' : 'down'}>
                      {q ? formatPct(q.change_percent) : ''}
                    </span>
                    <button type="button" className="btn ghost sm" onClick={() => remove(sym)}>
                      Remove
                    </button>
                  </div>
                </li>
              )
            })}
            {!symbols.length && <li className="muted">No stocks selected yet.</li>}
          </ul>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Add stocks</h2>
          </div>
          <input
            className="search"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="pick-list">
            {available.slice(0, 40).map((s) => (
              <li key={s.symbol}>
                <div>
                  <strong>{shortSymbol(s.symbol)}</strong>
                  <span className="muted">{s.name}</span>
                </div>
                <button type="button" className="btn secondary sm" onClick={() => add(s.symbol)}>
                  Add
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </Layout>
  )
}
