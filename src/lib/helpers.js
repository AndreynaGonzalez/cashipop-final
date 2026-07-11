// ─── Numeric Helpers ─────────────────────────────────────────────────────────
export function normMonto(val) {
  let s = String(val).replace(/[^0-9.,]/g, '')
  const parts = s.split(/[.,]/)
  if (parts.length > 2) s = parts.slice(0, -1).join('') + '.' + parts.at(-1)
  else if (parts.length === 2) s = parts[0] + '.' + parts[1]
  if (s.startsWith('.')) s = '0' + s
  const dotIdx = s.indexOf('.')
  if (dotIdx >= 0) s = s.slice(0, dotIdx + 3)
  return s
}

export function toCents(v) { return Math.round((parseFloat(v) || 0) * 100) }
export function fromCents(c) { return c / 100 }
export function redondear(v) { return fromCents(toCents(v)) }

export const n = s => { const v = parseFloat(String(s).replace(',', '.')); return isNaN(v) ? 0 : v }
export const bs = (s, t) => fromCents(Math.round(toCents(n(s)) / t))
export const us = s => redondear(n(s))

// ─── Currency Conversion ─────────────────────────────────────────────────────
export function toUSD(monto, moneda, tasa) {
  const cents = toCents(Number(monto) || 0)
  return moneda === 'BS' ? fromCents(Math.round(cents / tasa)) : fromCents(cents)
}

// ─── Formatting ──────────────────────────────────────────────────────────────
export function formatMoney(v) {
  const raw = Number(v) || 0
  const num = Math.abs(Math.round(raw * 100) / 100)
  const fixed = num.toFixed(2)
  const [int, dec] = fixed.split('.')
  const miles = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${miles},${dec}`
}

export const fUSD = v => `$ ${formatMoney(v)}`
export const fBS  = v => `Bs ${formatMoney(v)}`

export const fDate = iso => {
  const [y,m,d] = iso.split('-')
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${+d} ${months[+m-1]} ${y}`
}

export function formatConcept(str) {
  if (!str) return ''
  const FILLER_WORDS = /^(pago|gasto|compra|compras|gastos|pagos|de|del|para|por|en|el|la|los|las|un|una)$/i
  let words = str.trim().split(/\s+/).map(w =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  )
  while (words.length > 1 && FILLER_WORDS.test(words[0])) words.shift()
  return words.join(' ')
}

export const capitalizar = formatConcept
