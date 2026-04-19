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
  return data
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
  return data
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
