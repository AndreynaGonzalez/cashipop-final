// ─── Storage Keys ────────────────────────────────────────────────────────────
const ONBOARDING_KEY = 'CASHIPOP_ONBOARDING'
const PROFILE_KEY    = 'CASHIPOP_PROFILE'
const KEY            = 'CASHIPOP_V4'
const HIST_KEY       = 'CASHIPOP_HIST'

// ─── Venezuela Date (UTC-4) ──────────────────────────────────────────────────
export function getVzlaDate() {
  const now = new Date()
  const vzla = new Date(now.getTime() - (4 * 60 * 60 * 1000))
  return vzla.toISOString().split('T')[0]
}
export const hoy = getVzlaDate

// ─── Onboarding State ────────────────────────────────────────────────────────
export function getOnboardingState() {
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function saveOnboardingState(state) {
  localStorage.setItem(ONBOARDING_KEY, JSON.stringify(state))
}

export function clearOnboardingState() {
  localStorage.removeItem(ONBOARDING_KEY)
}

// ─── Profile Config ──────────────────────────────────────────────────────────
export function getProfileConfig() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function saveProfileConfig(config) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(config))
}

export function clearProfileConfig() {
  localStorage.removeItem(PROFILE_KEY)
}

// ─── Legacy Data (Caja Diaria) ───────────────────────────────────────────────
export function cargarData() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

export function guardarData(d) {
  localStorage.setItem(KEY, JSON.stringify(d))
}

export function archivarData(d) {
  try {
    if (!d?.fecha) return
    const hist = JSON.parse(localStorage.getItem(HIST_KEY) || '[]')
    if (!hist.find(h => h.fecha === d.fecha)) {
      hist.unshift(d)
      if (hist.length > 60) hist.splice(60)
      localStorage.setItem(HIST_KEY, JSON.stringify(hist))
    }
  } catch {}
}

export function cargarHistorial() {
  try { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]') }
  catch { return [] }
}
