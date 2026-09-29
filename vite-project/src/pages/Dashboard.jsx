import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { marketApi } from '../api'
import Layout from '../components/Layout'
import { formatINR, formatPct, shortSymbol } from '../utils'

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState('change_percent')
  const [selected, setSelected] = useState(null)
  const [history, setHistory] = useState([])

  const load = async () => {
    try {
      setError('')
      const quotes = await marketApi.quotes()
      setData(quotes)
      if (!selected && quotes.quotes?.length) {
        setSelected(quotes.quotes[0].symbol)
      }
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!selected) return
    marketApi
      .history(selected, '1mo')
      .then((h) => setHistory(h.points || []))
      .catch(() => setHistory([]))
  }, [selected])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let rows = data?.quotes || []
    if (q) {
      rows = rows.filter(
        (r) =>
          r.symbol.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          shortSymbol(r.symbol).toLowerCase().includes(q),
      )
    }
    const sorted = [...rows].sort((a, b) => {
      if (sortKey === 'price') return b.price - a.price
      if (sortKey === 'name') return a.name.localeCompare(b.name)
      return b.change_percent - a.change_percent
    })
    return sorted
  }, [data, query, sortKey])

  const movers = useMemo(() => {
    const rows = [...(data?.quotes || [])].sort(
      (a, b) => Math.abs(b.change_percent) - Math.abs(a.change_percent),
    )
    return rows.slice(0, 12).map((r) => ({
      symbol: shortSymbol(r.symbol),
      change: r.change_percent,
      fill: r.change_percent >= 0 ? '#1a7f4b' : '#b42318',
    }))
  }, [data])

  return (
    <Layout>
      <div className="page-head">
        <div>
          <h1>NSE market dashboard</h1>
          <p className="muted">
            Top {data?.quotes?.length ?? '—'} stocks · prices in INR · auto-refresh every{' '}
            {data?.refresh_interval_minutes ?? 2} min
          </p>
        </div>
      </div>

      {data?.note && <div className="banner info">{data.note}</div>}
      {error && <div className="banner error">{error}</div>}

      <section className="grid-2">
        <div className="panel">
          <div className="panel-head">
            <h2>Session movers</h2>
            <span className="pill">{data?.market_open ? 'Market open' : 'Market closed / delayed'}</span>
          </div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={movers} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e2d6" />
                <XAxis dataKey="symbol" angle={-35} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v) => [`${Number(v).toFixed(2)}%`, 'Change']} />
                <Bar dataKey="change" radius={[4, 4, 0, 0]}>
                  {movers.map((entry) => (
                    <Cell key={entry.symbol} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>{selected ? shortSymbol(selected) : 'Select a stock'} · 1M close</h2>
          </div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e2d6" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={28} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} width={70} />
                <Tooltip formatter={(v) => [formatINR(v), 'Close']} />
                <Line type="monotone" dataKey="close" stroke="#0b5fff" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="panel table-panel">
        <div className="toolbar">
          <input
            className="search"
            placeholder="Search symbol or company…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
            <option value="change_percent">Sort by % change</option>
            <option value="price">Sort by price</option>
            <option value="name">Sort by name</option>
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Company</th>
                <th>Price (₹)</th>
                <th>Change</th>
                <th>%</th>
                <th>Volume</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.symbol}
                  className={selected === row.symbol ? 'selected' : ''}
                  onClick={() => setSelected(row.symbol)}
                >
                  <td>
                    <strong>{shortSymbol(row.symbol)}</strong>
                  </td>
                  <td>{row.name}</td>
                  <td>{formatINR(row.price)}</td>
                  <td className={row.change >= 0 ? 'up' : 'down'}>{formatINR(row.change)}</td>
                  <td className={row.change_percent >= 0 ? 'up' : 'down'}>{formatPct(row.change_percent)}</td>
                  <td>{row.volume != null ? Math.round(row.volume).toLocaleString('en-IN') : '—'}</td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={6} className="muted">
                    No quotes yet — prices refresh every few minutes in the background.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </Layout>
  )
}
