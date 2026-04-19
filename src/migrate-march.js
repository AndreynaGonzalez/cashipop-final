/**
 * Migración de datos de marzo 2026 desde el CSV de Seguimiento.
 * Ejecutar después de crear las tablas en Supabase.
 *
 * Uso: importar y llamar migrateMarch(supabase) desde la consola del navegador
 * o desde un useEffect temporal.
 */

const MARCH_INGRESOS = [
  { concepto: 'Bicentenario',    monto: 3028.68,  categoria: 'Bancos' },
  { concepto: 'Bancamiga',       monto: 789.65,   categoria: 'Bancos' },
  { concepto: 'Bancaribe',       monto: 21037.67, categoria: 'Bancos' },
  { concepto: 'Banesco',         monto: 8842.61,  categoria: 'Bancos' },
  { concepto: 'Pagomovil',       monto: 3300.19,  categoria: 'Pagos Del Dia' },
  { concepto: 'Efectivo Bs',     monto: 229.48,   categoria: 'Efectivo' },
  { concepto: 'Efectivo Usd',    monto: 1500.00,  categoria: 'Efectivo' },
  { concepto: 'Efectivo Eur',    monto: 10.00,    categoria: 'Efectivo' },
  { concepto: 'Delivery',        monto: 603.83,   categoria: 'Delivery' },
  { concepto: 'Otros Ingresos',  monto: 1181.91,  categoria: 'Otros' },
]

const MARCH_GASTOS = [
  // Gastos variables
  { concepto: 'Comisiones',             monto: 554.98,   categoria: 'Comisiones' },
  { concepto: 'Proveedores',            monto: 1952.82,  categoria: 'Proveedores' },
  { concepto: 'Insumos',                monto: 13502.24, categoria: 'Insumos' },
  { concepto: 'Articulos De Limpieza',  monto: 106.05,   categoria: 'Insumos' },
  { concepto: 'Honorarios',             monto: 1165.79,  categoria: 'Honorarios' },
  { concepto: 'Transporte Empleados',   monto: 123.64,   categoria: 'Varios' },
  { concepto: 'Carlos',                 monto: 338.32,   categoria: 'Carlos' },
  { concepto: 'Eduardo',                monto: 2115.41,  categoria: 'Eduardo' },
  { concepto: 'Arcelia',                monto: 2148.84,  categoria: 'Arcelia' },
  { concepto: 'Acreedores',             monto: 7593.16,  categoria: 'Proveedores' },
  // Gastos fijos
  { concepto: 'Sueldos',                monto: 5776.66,  categoria: 'Sueldos' },
  { concepto: 'Servicios',              monto: 2886.40,  categoria: 'Servicios' },
  { concepto: 'Alquiler',               monto: 1908.29,  categoria: 'Alquiler' },
  { concepto: 'Publicidad',             monto: 185.71,   categoria: 'Varios' },
  // Impuestos
  { concepto: 'Impuestos',              monto: 10.39,    categoria: 'Varios' },
]

export async function migrateMarch(supabase) {
  if (!supabase) { console.error('No supabase client'); return }

  const fecha = '2026-03-31'

  // Ingresos
  const ingRows = MARCH_INGRESOS.map(r => ({
    fecha,
    concepto: r.concepto,
    monto: r.monto,
    moneda: 'USD',
    categoria: r.categoria,
    notas: 'Migracion marzo 2026',
  }))

  const { error: errIng } = await supabase.from('ingresos').insert(ingRows)
  if (errIng) console.error('Error insertando ingresos:', errIng)
  else console.log(`${ingRows.length} ingresos de marzo insertados`)

  // Gastos
  const gasRows = MARCH_GASTOS.map(r => ({
    fecha,
    concepto: r.concepto,
    monto: r.monto,
    moneda: 'USD',
    categoria: r.categoria,
    notas: 'Migracion marzo 2026',
  }))

  const { error: errGas } = await supabase.from('gastos').insert(gasRows)
  if (errGas) console.error('Error insertando gastos:', errGas)
  else console.log(`${gasRows.length} gastos de marzo insertados`)

  return { ingresos: ingRows.length, gastos: gasRows.length }
}
