/**
 * Migracion completa: Gastos.csv + Cierres de caja.csv → Supabase
 * Ejecutar: node migrate.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const SUPABASE_URL = 'https://ykjljfeihdopzntxxsul.supabase.co'
const SUPABASE_KEY = 'sb_publishable_-jZYZDmg33K5d-QGpUDvvA_ya_asi-D'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatConcept(str) {
  if (!str) return ''
  return str.trim().split(/\s+/).map(w =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join(' ')
}

function parseNum(s) {
  if (!s || s === '') return 0
  // CSV uses comma as decimal: "46380,45" → 46380.45
  // Also handles "1.952,82" (dot as thousands)
  const cleaned = String(s).replace(/\$/g, '').replace(/-/g, '').trim()
  if (!cleaned) return 0
  // If has both dot and comma: dot=thousands, comma=decimal (European)
  if (/\d\.\d{3},\d/.test(cleaned)) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'))
  }
  // If has comma followed by 1-2 digits at end: comma=decimal
  if (/,\d{1,2}$/.test(cleaned)) {
    return parseFloat(cleaned.replace(',', '.'))
  }
  return parseFloat(cleaned) || 0
}

function parseDate(s) {
  if (!s) return null
  // Format: "1/3/2026 10:54:19" → day/month/year
  const match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!match) return null
  const [, d, m, y] = match
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function splitCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue }
    if (ch === ',' && !inQuotes) { result.push(current); current = ''; continue }
    current += ch
  }
  result.push(current)
  return result
}

// ── Parse Gastos.csv ─────────────────────────────────────────────────────────

function parseGastos() {
  const raw = readFileSync('Seguimiento Andino POP - Gastos.csv', 'utf-8')
  const lines = raw.split('\n').filter(l => l.trim())
  const gastos = []

  for (let i = 1; i < lines.length; i++) { // skip header
    const cols = splitCSVLine(lines[i])
    const tipo = (cols[1] || '').trim()
    if (tipo !== 'Gasto') continue

    const fecha = parseDate(cols[0])
    if (!fecha) continue

    const categoria = formatConcept((cols[4] || '').trim()) || 'Varios'
    const concepto = formatConcept((cols[5] || '').trim()) || categoria
    const montoBs = parseNum(cols[6])   // "Monto" col 6
    const moneda = (cols[10] || '').trim() || 'Bs'
    const totalUSD = parseNum(cols[34]) // "Total Gastos USD" col 34

    if (totalUSD <= 0 && montoBs <= 0) continue

    gastos.push({
      fecha,
      concepto,
      monto: Math.round((totalUSD > 0 ? totalUSD : montoBs) * 100) / 100,
      moneda: totalUSD > 0 ? 'USD' : moneda,
      categoria,
      notas: montoBs > 0 && moneda === 'Bs' ? `Bs ${montoBs}` : null,
    })
  }

  return gastos
}

// ── Parse Cierres de caja.csv ────────────────────────────────────────────────

function parseCierres() {
  const raw = readFileSync('Seguimiento Andino POP - Cierres de caja.csv', 'utf-8')
  const lines = raw.split('\n').filter(l => l.trim())
  // Header: Marca temporal, Bicentenario (Bs), Bancamiga (Bs), Bancaribe (Bs),
  //         Banesco (Bs), Pagomóvil (Bs), Efectivo (Bs), Efectivo ($USD),
  //         Efectivo (Eur), Delivery (Bs), Pedidos Ya - Efectivo (USD),
  //         Pedidos Ya - Prepago (USD), Cuentas por cobrar (USD), ...
  //         TOTAL (USD) is col 15

  const campos = [
    { col: 1,  concepto: 'Bicentenario',             categoria: 'Bancos',        moneda: 'BS' },
    { col: 2,  concepto: 'Bancamiga',                 categoria: 'Bancos',        moneda: 'BS' },
    { col: 3,  concepto: 'Bancaribe',                 categoria: 'Bancos',        moneda: 'BS' },
    { col: 4,  concepto: 'Banesco',                   categoria: 'Bancos',        moneda: 'BS' },
    { col: 5,  concepto: 'Pagomovil',                 categoria: 'Pagos Del Dia', moneda: 'BS' },
    { col: 6,  concepto: 'Efectivo Bolivares',        categoria: 'Efectivo',      moneda: 'BS' },
    { col: 7,  concepto: 'Efectivo Dolares',          categoria: 'Efectivo',      moneda: 'USD' },
    { col: 8,  concepto: 'Efectivo Euros',            categoria: 'Efectivo',      moneda: 'USD' },
    { col: 9,  concepto: 'Delivery',                  categoria: 'Delivery',      moneda: 'BS' },
    { col: 10, concepto: 'Pedidos Ya Efectivo',       categoria: 'Delivery',      moneda: 'USD' },
    { col: 11, concepto: 'Pedidos Ya Prepago',        categoria: 'Delivery',      moneda: 'USD' },
    { col: 12, concepto: 'Cuentas Por Cobrar Usd',    categoria: 'Por Cobrar',    moneda: 'USD' },
    { col: 13, concepto: 'Cuentas Por Cobrar Bs',     categoria: 'Por Cobrar',    moneda: 'BS' },
  ]

  const ingresos = []

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i])
    const fecha = parseDate(cols[0])
    if (!fecha) continue

    for (const campo of campos) {
      const val = parseNum(cols[campo.col])
      if (val <= 0) continue

      ingresos.push({
        fecha,
        concepto: campo.concepto,
        monto: Math.round(val * 100) / 100,
        moneda: campo.moneda,
        categoria: campo.categoria,
        notas: `Cierre de caja ${fecha}`,
      })
    }
  }

  return ingresos
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Migracion Andino Pop - Datos completos ===\n')

  // 1. Parse CSVs
  const gastos = parseGastos()
  const ingresos = parseCierres()

  console.log(`Gastos parseados del CSV:   ${gastos.length}`)
  console.log(`Ingresos parseados del CSV: ${ingresos.length}`)
  console.log('')

  // 2. Clean previous migration data
  console.log('Limpiando datos previos...')
  await supabase.from('gastos').delete().neq('id', 0)
  await supabase.from('ingresos').delete().neq('id', 0)
  console.log('Tablas limpiadas.\n')

  // 3. Insert gastos in batches of 50
  let insertedGastos = 0
  for (let i = 0; i < gastos.length; i += 50) {
    const batch = gastos.slice(i, i + 50)
    const { data, error } = await supabase.from('gastos').insert(batch).select('id')
    if (error) {
      console.error(`Error gastos batch ${i}:`, error.message)
    } else {
      insertedGastos += data.length
    }
  }

  // 4. Insert ingresos in batches of 50
  let insertedIngresos = 0
  for (let i = 0; i < ingresos.length; i += 50) {
    const batch = ingresos.slice(i, i + 50)
    const { data, error } = await supabase.from('ingresos').insert(batch).select('id')
    if (error) {
      console.error(`Error ingresos batch ${i}:`, error.message)
    } else {
      insertedIngresos += data.length
    }
  }

  console.log('\n=== RESULTADO FINAL ===')
  console.log(`Gastos insertados:   ${insertedGastos}`)
  console.log(`Ingresos insertados: ${insertedIngresos}`)
  console.log(`Total registros:     ${insertedGastos + insertedIngresos}`)

  // 5. Verify
  const { count: gCount } = await supabase.from('gastos').select('*', { count: 'exact', head: true })
  const { count: iCount } = await supabase.from('ingresos').select('*', { count: 'exact', head: true })
  console.log(`\nVerificacion en Supabase:`)
  console.log(`  gastos:   ${gCount}`)
  console.log(`  ingresos: ${iCount}`)
}

main().catch(console.error)
