import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null

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
    .from('gastos')
    .select('*')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) { console.error('fetchGastos:', error); return [] }
  // Filter soft-deleted in JS (safe if column doesn't exist yet)
  return (data || []).filter(r => !r.deleted_at)
}

export async function fetchGastosTrash() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('gastos')
    .select('*')
    .order('fecha', { ascending: false })
  if (error) { console.error('fetchGastosTrash:', error); return [] }
  return (data || []).filter(r => r.deleted_at)
}

export async function insertGasto(gasto) {
  if (!supabase) return null
  const row = {
    fecha: gasto.fecha || new Date().toISOString().slice(0, 10),
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

// Soft delete: set deleted_at (falls back to hard delete if column missing)
export async function softDeleteGasto(id) {
  if (!supabase) return
  const { error } = await supabase.from('gastos').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) {
    console.warn('softDeleteGasto fallback to hard delete:', error.message)
    await supabase.from('gastos').delete().eq('id', id)
  }
}

export async function restoreGasto(id) {
  if (!supabase) return
  const { error } = await supabase.from('gastos').update({ deleted_at: null }).eq('id', id)
  if (error) console.error('restoreGasto:', error)
}

// Hard delete (for auto-purge after 15 days)
export async function deleteGasto(id) {
  if (!supabase) return
  const { error } = await supabase.from('gastos').delete().eq('id', id)
  if (error) console.error('deleteGasto:', error)
}

// ── Ingresos ────────────────────────────────────────────────────────────────

export async function fetchIngresos() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('ingresos')
    .select('*')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) { console.error('fetchIngresos:', error); return [] }
  return (data || []).filter(r => !r.deleted_at)
}

export async function fetchIngresosTrash() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('ingresos')
    .select('*')
    .order('fecha', { ascending: false })
  if (error) { console.error('fetchIngresosTrash:', error); return [] }
  return (data || []).filter(r => r.deleted_at)
}

// Soft delete ingresos by fecha (falls back to hard delete if column missing)
export async function softDeleteIngresosByFecha(fecha) {
  if (!supabase) return
  const { error } = await supabase.from('ingresos').update({ deleted_at: new Date().toISOString() }).eq('fecha', fecha)
  if (error) {
    console.warn('softDeleteIngresosByFecha fallback:', error.message)
    await supabase.from('ingresos').delete().eq('fecha', fecha)
  }
}

// Hard delete ingresos by fecha (for upsert before re-insert)
export async function deleteIngresosByFecha(fecha) {
  if (!supabase) return
  const { error } = await supabase.from('ingresos').delete().eq('fecha', fecha)
  if (error) console.error('deleteIngresosByFecha:', error)
}

// Soft delete gastos by fecha
export async function softDeleteGastosByFecha(fecha) {
  if (!supabase) return
  const { error } = await supabase.from('gastos').update({ deleted_at: new Date().toISOString() }).eq('fecha', fecha)
  if (error) {
    console.warn('softDeleteGastosByFecha fallback:', error.message)
    await supabase.from('gastos').delete().eq('fecha', fecha)
  }
}

export async function deleteGastosByFecha(fecha) {
  if (!supabase) return
  const { error } = await supabase.from('gastos').delete().eq('fecha', fecha)
  if (error) console.error('deleteGastosByFecha:', error)
}

export async function restoreIngreso(id) {
  if (!supabase) return
  const { error } = await supabase.from('ingresos').update({ deleted_at: null }).eq('id', id)
  if (error) console.error('restoreIngreso:', error)
}

export async function insertIngreso(ingreso) {
  if (!supabase) return null
  const row = {
    fecha: ingreso.fecha || new Date().toISOString().slice(0, 10),
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

// ── Auto-purge: delete records with deleted_at > 15 days ago ────────────────

export async function autoPurge() {
  if (!supabase) return
  try {
    const cutoff = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('gastos').delete().lt('deleted_at', cutoff)
    await supabase.from('ingresos').delete().lt('deleted_at', cutoff)
    console.log('Auto-purge: cleaned records deleted before', cutoff.slice(0, 10))
  } catch (e) {
    // Safe to fail if deleted_at column doesn't exist yet
    console.log('Auto-purge skipped (column may not exist yet)')
  }
}
