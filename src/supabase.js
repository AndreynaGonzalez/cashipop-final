import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null

// ── Check if deleted_at column exists (cached) ─────────────────────────────
let _hasDeletedAt = null
async function checkDeletedAtColumn() {
  if (_hasDeletedAt !== null) return _hasDeletedAt
  if (!supabase) return false
  const { error } = await supabase.from('gastos').select('deleted_at').limit(1)
  _hasDeletedAt = !error
  console.log('deleted_at column:', _hasDeletedAt ? 'EXISTS' : 'MISSING — papelera disabled, run ALTER TABLE')
  return _hasDeletedAt
}
export { checkDeletedAtColumn }

// ── Auth ────────────────────────────────────────────────────────────────────

export async function signUp(email, password) {
  if (!supabase) return { error: { message: 'Supabase no configurado' } }
  return supabase.auth.signUp({ email, password })
}

export async function signIn(email, password) {
  if (!supabase) return { error: { message: 'Supabase no configurado' } }
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  if (!supabase) return
  return supabase.auth.signOut()
}

export function onAuthChange(callback) {
  if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } }
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null)
  })
}

export async function getSession() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user || null
}

// ── Gastos ──────────────────────────────────────────────────────────────────

export async function fetchGastos() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('gastos').select('*')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) { console.error('fetchGastos:', error); return [] }
  return (data || []).filter(r => !r.deleted_at)
}

export async function fetchGastosTrash() {
  if (!supabase) return []
  const has = await checkDeletedAtColumn()
  if (!has) return []
  const { data, error } = await supabase
    .from('gastos').select('*')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
  if (error) { console.error('fetchGastosTrash:', error); return [] }
  return data || []
}

export async function insertGasto(gasto) {
  if (!supabase) return null
  const vzlaDate = (() => { const n = new Date(); return new Date(n.getTime() - 4*3600000).toISOString().split('T')[0] })()
  const row = {
    fecha: gasto.fecha || vzlaDate,
    concepto: gasto.concepto,
    monto: parseFloat(gasto.monto) || 0,
    moneda: gasto.moneda === 'BS' ? 'BS' : 'USD',
    categoria: gasto.categoria || 'Insumos',
    notas: gasto.notas || null,
  }
  const { data, error } = await supabase.from('gastos').insert(row).select()
  if (error) console.error('insertGasto:', error)
  return data?.[0] || null
}

export async function softDeleteGasto(id) {
  if (!supabase) return false
  const has = await checkDeletedAtColumn()
  if (!has) {
    console.error('softDeleteGasto: deleted_at column missing. Run: ALTER TABLE gastos ADD COLUMN deleted_at timestamptz;')
    return false
  }
  const { error } = await supabase.from('gastos').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) { console.error('softDeleteGasto:', error); return false }
  console.log('softDeleteGasto OK:', id)
  return true
}

export async function restoreGasto(id) {
  if (!supabase) return false
  const { error } = await supabase.from('gastos').update({ deleted_at: null }).eq('id', id)
  if (error) { console.error('restoreGasto:', error); return false }
  console.log('restoreGasto OK:', id)
  return true
}

export async function deleteGasto(id) {
  if (!supabase) return
  await supabase.from('gastos').delete().eq('id', id)
}

// ── Ingresos ────────────────────────────────────────────────────────────────

export async function fetchIngresos() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('ingresos').select('*')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) { console.error('fetchIngresos:', error); return [] }
  return (data || []).filter(r => !r.deleted_at)
}

export async function fetchIngresosTrash() {
  if (!supabase) return []
  const has = await checkDeletedAtColumn()
  if (!has) return []
  const { data, error } = await supabase
    .from('ingresos').select('*')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
  if (error) { console.error('fetchIngresosTrash:', error); return [] }
  return data || []
}

export async function softDeleteIngresosByFecha(fecha) {
  if (!supabase) return false
  const has = await checkDeletedAtColumn()
  if (!has) {
    console.error('softDeleteIngresosByFecha: deleted_at column missing')
    return false
  }
  const { error } = await supabase.from('ingresos').update({ deleted_at: new Date().toISOString() }).eq('fecha', fecha)
  if (error) { console.error('softDeleteIngresosByFecha:', error); return false }
  return true
}

export async function deleteIngresosByFecha(fecha) {
  if (!supabase) return
  await supabase.from('ingresos').delete().eq('fecha', fecha)
}

export async function deleteGastosByFecha(fecha) {
  if (!supabase) return
  await supabase.from('gastos').delete().eq('fecha', fecha)
}

export async function softDeleteGastosByFecha(fecha) {
  if (!supabase) return false
  const has = await checkDeletedAtColumn()
  if (!has) return false
  const { error } = await supabase.from('gastos').update({ deleted_at: new Date().toISOString() }).eq('fecha', fecha)
  if (error) { console.error('softDeleteGastosByFecha:', error); return false }
  return true
}

export async function restoreIngreso(id) {
  if (!supabase) return false
  const { error } = await supabase.from('ingresos').update({ deleted_at: null }).eq('id', id)
  if (error) { console.error('restoreIngreso:', error); return false }
  return true
}

export async function insertIngreso(ingreso) {
  if (!supabase) return null
  const vzlaDate = (() => { const n = new Date(); return new Date(n.getTime() - 4*3600000).toISOString().split('T')[0] })()
  const row = {
    fecha: ingreso.fecha || vzlaDate,
    concepto: ingreso.concepto,
    monto: parseFloat(ingreso.monto) || 0,
    moneda: ingreso.moneda || 'USD',
    categoria: ingreso.categoria || 'Ventas',
    notas: ingreso.notas || null,
  }
  const { data, error } = await supabase.from('ingresos').insert(row).select()
  if (error) console.error('insertIngreso:', error)
  return data?.[0] || null
}

export async function autoPurge() {
  if (!supabase) return
  const has = await checkDeletedAtColumn()
  if (!has) return
  const cutoff = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
  await supabase.from('gastos').delete().lt('deleted_at', cutoff)
  await supabase.from('ingresos').delete().lt('deleted_at', cutoff)
  console.log('Auto-purge: cleaned before', cutoff.slice(0, 10))
}
