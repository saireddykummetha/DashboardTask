export function formatINR(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value))
}

export function formatPct(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const n = Number(value)
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

export function shortSymbol(symbol) {
  if (!symbol) return ''
  return symbol.replace(/\.NS$/, '').replace(/^\^/, '')
}
