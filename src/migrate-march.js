/**
 * Migracion completa del CSV "Seguimiento Andino POP - Resumen"
 * Incluye TODOS los registros con monto > 0 para marzo y abril 2026.
 *
 * Uso: en la consola del navegador despues de crear las tablas:
 *   const { supabase } = await import('/src/supabase.js')
 *   const { migrateAll } = await import('/src/migrate-march.js')
 *   await migrateAll(supabase)
 */

// ── Marzo 2026 ──────────────────────────────────────────────────────────────

const MAR_INGRESOS = [
  { concepto: 'Bicentenario',       monto: 3028.68,  categoria: 'Bancos' },
  { concepto: 'Bancamiga',          monto: 789.65,   categoria: 'Bancos' },
  { concepto: 'Bancaribe',          monto: 21037.67, categoria: 'Bancos' },
  { concepto: 'Banesco',            monto: 8842.61,  categoria: 'Bancos' },
  { concepto: 'Pagomovil',          monto: 3300.19,  categoria: 'Pagos Del Dia' },
  { concepto: 'Efectivo Bolivares', monto: 229.48,   categoria: 'Efectivo' },
  { concepto: 'Efectivo Dolares',   monto: 1500.00,  categoria: 'Efectivo' },
  { concepto: 'Efectivo Euros',     monto: 10.00,    categoria: 'Efectivo' },
  { concepto: 'Delivery',           monto: 603.83,   categoria: 'Delivery' },
  { concepto: 'Otros Ingresos',     monto: 1181.91,  categoria: 'Otros' },
]
// Verificacion: suma = 3028.68+789.65+21037.67+8842.61+3300.19+229.48+1500+10+603.83+1181.91 = 40524.02 ≈ CSV $40,524.03

const MAR_GASTOS = [
  // Gastos variables
  { concepto: 'Comisiones',              monto: 554.98,   categoria: 'Comisiones' },
  { concepto: 'Proveedores',             monto: 1952.82,  categoria: 'Proveedores' },
  { concepto: 'Insumos',                 monto: 13502.24, categoria: 'Insumos' },
  { concepto: 'Articulos De Limpieza',   monto: 106.05,   categoria: 'Insumos' },
  { concepto: 'Honorarios',              monto: 1165.79,  categoria: 'Honorarios' },
  { concepto: 'Transporte Empleados',    monto: 123.64,   categoria: 'Varios' },
  { concepto: 'Carlos',                  monto: 338.32,   categoria: 'Carlos' },
  { concepto: 'Eduardo',                 monto: 2115.41,  categoria: 'Eduardo' },
  { concepto: 'Arcelia',                 monto: 2148.84,  categoria: 'Arcelia' },
  { concepto: 'Acreedores',              monto: 7593.16,  categoria: 'Proveedores' },
  // Gastos fijos
  { concepto: 'Sueldos',                 monto: 5776.66,  categoria: 'Sueldos' },
  { concepto: 'Servicios',               monto: 2886.40,  categoria: 'Servicios' },
  { concepto: 'Alquiler',                monto: 1908.29,  categoria: 'Alquiler' },
  { concepto: 'Publicidad',              monto: 185.71,   categoria: 'Varios' },
  // Impuestos
  { concepto: 'Impuestos',               monto: 10.39,    categoria: 'Impuestos' },
]
// Verificacion: variables 29601.25 + fijos 10757.06 + impuestos 10.39 = 40368.70 ≈ CSV $40,368.72

// ── Abril 2026 ──────────────────────────────────────────────────────────────

const ABR_INGRESOS = [
  { concepto: 'Bicentenario',       monto: 705.92,   categoria: 'Bancos' },
  { concepto: 'Bancaribe',          monto: 2780.33,  categoria: 'Bancos' },
  { concepto: 'Banesco',            monto: 901.43,   categoria: 'Bancos' },
  { concepto: 'Pagomovil',          monto: 561.48,   categoria: 'Pagos Del Dia' },
  { concepto: 'Efectivo Bolivares', monto: 10.49,    categoria: 'Efectivo' },
  { concepto: 'Efectivo Dolares',   monto: 168.00,   categoria: 'Efectivo' },
  { concepto: 'Otros Ingresos',     monto: 7146.21,  categoria: 'Otros' },
]
// Verificacion: 705.92+2780.33+901.43+561.48+10.49+168+7146.21 = 12273.86 ≈ CSV $12,273.87

const ABR_GASTOS = [
  // Gastos variables
  { concepto: 'Proveedores',             monto: 943.29,   categoria: 'Proveedores' },
  { concepto: 'Insumos',                 monto: 5024.42,  categoria: 'Insumos' },
  { concepto: 'Articulos De Limpieza',   monto: 124.16,   categoria: 'Insumos' },
  { concepto: 'Honorarios',              monto: 397.96,   categoria: 'Honorarios' },
  { concepto: 'Eduardo',                 monto: 2890.64,  categoria: 'Eduardo' },
  { concepto: 'Arcelia',                 monto: 541.97,   categoria: 'Arcelia' },
  { concepto: 'Acreedores',              monto: 537.82,   categoria: 'Proveedores' },
  // Gastos fijos
  { concepto: 'Sueldos',                 monto: 2233.67,  categoria: 'Sueldos' },
  { concepto: 'Servicios',               monto: 795.27,   categoria: 'Servicios' },
  { concepto: 'Publicidad',              monto: 115.27,   categoria: 'Varios' },
  // Impuestos
  { concepto: 'Impuestos',               monto: 10.01,    categoria: 'Impuestos' },
]
// Verificacion: variables 10460.26 + fijos 3144.21 + impuestos 10.01 = 13614.48 ≈ CSV $13,614.49

// ── Funcion de migracion ─────────────────────────────────────────────────────

async function insertBatch(supabase, table, rows, fecha, mes) {
  const formatted = rows.map(r => ({
    fecha,
    concepto: r.concepto,
    monto: r.monto,
    moneda: 'USD',
    categoria: r.categoria,
    notas: `Migracion ${mes} 2026 desde CSV`,
  }))

  const { data, error } = await supabase.from(table).insert(formatted).select()
  if (error) {
    console.error(`Error insertando ${table} ${mes}:`, error)
    return 0
  }
  console.log(`  ${data.length} registros en ${table} (${mes})`)
  return data.length
}

export async function migrateAll(supabase) {
  if (!supabase) { console.error('No supabase client'); return }

  console.log('=== Migracion Andino Pop ===')
  console.log('')

  // Limpiar datos previos de migracion
  console.log('Limpiando datos previos...')
  await supabase.from('ingresos').delete().like('notas', 'Migracion%')
  await supabase.from('gastos').delete().like('notas', 'Migracion%')

  let totalIng = 0, totalGas = 0

  // Marzo
  console.log('--- Marzo 2026 ---')
  totalIng += await insertBatch(supabase, 'ingresos', MAR_INGRESOS, '2026-03-31', 'marzo')
  totalGas += await insertBatch(supabase, 'gastos', MAR_GASTOS, '2026-03-31', 'marzo')

  // Abril
  console.log('--- Abril 2026 ---')
  totalIng += await insertBatch(supabase, 'ingresos', ABR_INGRESOS, '2026-04-19', 'abril')
  totalGas += await insertBatch(supabase, 'gastos', ABR_GASTOS, '2026-04-19', 'abril')

  console.log('')
  console.log(`=== RESULTADO ===`)
  console.log(`Ingresos insertados: ${totalIng}`)
  console.log(`Gastos insertados:   ${totalGas}`)
  console.log(`Total registros:     ${totalIng + totalGas}`)

  return { ingresos: totalIng, gastos: totalGas, total: totalIng + totalGas }
}

// Alias para compatibilidad
export const migrateMarch = migrateAll
