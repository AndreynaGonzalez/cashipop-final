/**
 * Setup + Migration todo-en-uno para Cashipop
 *
 * REQUIERE la service_role key para crear tablas.
 * Uso: SUPABASE_SERVICE_KEY=sbp_xxx node setup-and-migrate.mjs
 *
 * Si no tienes la service_role key, crea las tablas manualmente
 * con supabase-migration.sql y luego ejecuta: node migrate.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const SUPABASE_URL = 'https://ykjljfeihdopzntxxsul.supabase.co'
const ANON_KEY = 'sb_publishable_-jZYZDmg33K5d-QGpUDvvA_ya_asi-D'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

if (!SERVICE_KEY) {
  console.log('=== INSTRUCCIONES ===')
  console.log('')
  console.log('No se detecto SUPABASE_SERVICE_KEY.')
  console.log('')
  console.log('OPCION 1: Pasa la service_role key como variable de entorno:')
  console.log('  SUPABASE_SERVICE_KEY=sbp_tu_key node setup-and-migrate.mjs')
  console.log('')
  console.log('OPCION 2: Crea las tablas manualmente:')
  console.log('  1. Ve a: https://supabase.com/dashboard/project/ykjljfeihdopzntxxsul/sql/new')
  console.log('  2. Pega el contenido de supabase-migration.sql')
  console.log('  3. Click "Run"')
  console.log('  4. Luego ejecuta: node migrate.mjs')
  console.log('')
  console.log('La service_role key esta en:')
  console.log('  Dashboard > Settings > API > service_role (Reveal)')
  process.exit(0)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY)
const anon = createClient(SUPABASE_URL, ANON_KEY)

// ── Create tables via SQL ────────────────────────────────────────────────────
const SQL = `
CREATE TABLE IF NOT EXISTS ingresos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  concepto text NOT NULL,
  monto numeric(12,2) NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'USD' CHECK (moneda IN ('USD', 'BS')),
  categoria text NOT NULL DEFAULT 'Ventas',
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gastos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  concepto text NOT NULL,
  monto numeric(12,2) NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'USD' CHECK (moneda IN ('USD', 'BS')),
  categoria text NOT NULL DEFAULT 'Insumos',
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE ingresos ENABLE ROW LEVEL SECURITY;
  ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "anon_all_ingresos" ON ingresos FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "anon_all_gastos" ON gastos FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
`

async function createTables() {
  console.log('Creando tablas...')
  const { error } = await admin.rpc('exec', { sql: SQL }).catch(() =>
    // Fallback: try direct SQL via pg endpoint
    fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
    })
  )

  // Verify tables exist
  const { error: e1 } = await anon.from('gastos').select('id').limit(1)
  const { error: e2 } = await anon.from('ingresos').select('id').limit(1)

  if (e1 || e2) {
    console.error('Las tablas aun no existen despues del intento.')
    console.error('Crealas manualmente con supabase-migration.sql')
    console.error('Luego ejecuta: node migrate.mjs')
    process.exit(1)
  }
  console.log('Tablas verificadas OK')
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatConcept(str) {
  if (!str) return ''
  return str.trim().split(/\s+/).map(w =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join(' ')
}

function parseNum(s) {
  if (!s || s === '') return 0
  const cleaned = String(s).replace(/[\$\-]/g, '').trim()
  if (!cleaned) return 0
  if (/\d\.\d{3},\d/.test(cleaned)) return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'))
  if (/,\d{1,2}$/.test(cleaned)) return parseFloat(cleaned.replace(',', '.'))
  return parseFloat(cleaned) || 0
}

function parseDate(s) {
  if (!s) return null
  const match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!match) return null
  const [, d, m, y] = match
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function splitCSVLine(line) {
  const result = []; let current = ''; let inQ = false
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue }
    if (ch === ',' && !inQ) { result.push(current); current = ''; continue }
    current += ch
  }
  result.push(current); return result
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Cashipop: Setup + Migracion ===\n')

  await createTables()

  // Clean
  console.log('\nLimpiando tablas...')
  await anon.from('gastos').delete().neq('id', 0)
  await anon.from('ingresos').delete().neq('id', 0)

  // ── Parse Gastos ─────────────────────────────────────────────────────────
  const gRaw = readFileSync('Seguimiento Andino POP - Gastos.csv', 'utf-8')
  const gLines = gRaw.split('\n').filter(l => l.trim())
  const gastos = []
  let skipped = 0

  for (let i = 1; i < gLines.length; i++) {
    const cols = splitCSVLine(gLines[i])
    if ((cols[1] || '').trim() !== 'Gasto') { skipped++; continue }
    const fecha = parseDate(cols[0])
    if (!fecha) { skipped++; continue }
    const totalUSD = parseNum(cols[34])
    if (totalUSD <= 0) { skipped++; continue }
    const categoria = formatConcept((cols[4] || '').trim()) || 'Varios'
    const concepto = formatConcept((cols[5] || '').trim()) || categoria
    const montoBs = parseNum(cols[6])
    const moneda = (cols[10] || '').trim() || 'Bs'

    gastos.push({
      fecha, concepto,
      monto: Math.round(totalUSD * 100) / 100,
      moneda: 'USD',
      categoria,
      notas: montoBs > 0 ? `${moneda} ${montoBs}` : null,
    })
  }

  console.log(`\nGastos parseados: ${gastos.length} (${skipped} filas ignoradas)`)

  // Insert gastos
  let insertedG = 0
  for (let i = 0; i < gastos.length; i += 50) {
    const batch = gastos.slice(i, i + 50)
    const { data, error } = await anon.from('gastos').insert(batch).select('id')
    if (error) console.error(`  ERROR batch ${i}: ${error.message}`)
    else { insertedG += data.length; process.stdout.write(`  Gastos: ${insertedG}/${gastos.length}\r`) }
  }
  console.log(`  Gastos insertados: ${insertedG}`)

  // ── Parse Cierres ────────────────────────────────────────────────────────
  const cRaw = readFileSync('Seguimiento Andino POP - Cierres de caja.csv', 'utf-8')
  const cLines = cRaw.split('\n').filter(l => l.trim())
  const campos = [
    { col: 1,  concepto: 'Bicentenario',         categoria: 'Bancos',        moneda: 'BS' },
    { col: 2,  concepto: 'Bancamiga',             categoria: 'Bancos',        moneda: 'BS' },
    { col: 3,  concepto: 'Bancaribe',             categoria: 'Bancos',        moneda: 'BS' },
    { col: 4,  concepto: 'Banesco',               categoria: 'Bancos',        moneda: 'BS' },
    { col: 5,  concepto: 'Pagomovil',             categoria: 'Pagos Del Dia', moneda: 'BS' },
    { col: 6,  concepto: 'Efectivo Bolivares',    categoria: 'Efectivo',      moneda: 'BS' },
    { col: 7,  concepto: 'Efectivo Dolares',      categoria: 'Efectivo',      moneda: 'USD' },
    { col: 8,  concepto: 'Efectivo Euros',        categoria: 'Efectivo',      moneda: 'USD' },
    { col: 9,  concepto: 'Delivery',              categoria: 'Delivery',      moneda: 'BS' },
    { col: 10, concepto: 'Pedidos Ya Efectivo',   categoria: 'Delivery',      moneda: 'USD' },
    { col: 11, concepto: 'Pedidos Ya Prepago',    categoria: 'Delivery',      moneda: 'USD' },
    { col: 12, concepto: 'Cuentas Por Cobrar',    categoria: 'Por Cobrar',    moneda: 'USD' },
    { col: 13, concepto: 'Cuentas Por Cobrar Bs', categoria: 'Por Cobrar',    moneda: 'BS' },
  ]

  const ingresos = []
  for (let i = 1; i < cLines.length; i++) {
    const cols = splitCSVLine(cLines[i])
    const fecha = parseDate(cols[0])
    if (!fecha) continue
    for (const c of campos) {
      const val = parseNum(cols[c.col])
      if (val <= 0) continue
      ingresos.push({
        fecha, concepto: c.concepto,
        monto: Math.round(val * 100) / 100,
        moneda: c.moneda, categoria: c.categoria,
        notas: `Cierre ${fecha}`,
      })
    }
  }

  console.log(`Ingresos parseados: ${ingresos.length}`)

  // Insert ingresos
  let insertedI = 0
  for (let i = 0; i < ingresos.length; i += 50) {
    const batch = ingresos.slice(i, i + 50)
    const { data, error } = await anon.from('ingresos').insert(batch).select('id')
    if (error) console.error(`  ERROR batch ${i}: ${error.message}`)
    else { insertedI += data.length; process.stdout.write(`  Ingresos: ${insertedI}/${ingresos.length}\r`) }
  }
  console.log(`  Ingresos insertados: ${insertedI}`)

  // Verify
  const { count: gc } = await anon.from('gastos').select('*', { count: 'exact', head: true })
  const { count: ic } = await anon.from('ingresos').select('*', { count: 'exact', head: true })

  console.log('\n=== RESULTADO FINAL ===')
  console.log(`Gastos en Supabase:   ${gc}`)
  console.log(`Ingresos en Supabase: ${ic}`)
  console.log(`Total:                ${(gc||0) + (ic||0)}`)

  if ((gc||0) > 0 && (ic||0) > 0) {
    console.log('\nMigracion completada exitosamente.')
  } else {
    console.log('\nALERTA: Conteo es 0. Revisa los errores arriba.')
  }
}

main().catch(console.error)
