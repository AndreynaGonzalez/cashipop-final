// ─── BCV Rate Fetcher ────────────────────────────────────────────────────────
export async function fetchTasaBCV() {
  try {
    const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
      signal: AbortSignal.timeout(2000),
    })
    const json = await res.json()
    const v = parseFloat(json.promedio)
    if (v > 10 && v < 9999) return Math.round(v * 100) / 100
  } catch {}
  return null
}

export function getCachedTasa() {
  try {
    const raw = localStorage.getItem('CP_TASA')
    if (!raw) return 481.21
    const r = JSON.parse(raw)
    return typeof r === 'number' ? r : (r?.v || r?.valor || 481.21)
  } catch {
    return parseFloat(localStorage.getItem('CP_TASA')) || 481.21
  }
}

export function cacheTasa(value) {
  localStorage.setItem('CP_TASA', JSON.stringify(value))
}
