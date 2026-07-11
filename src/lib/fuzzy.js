// ─── Fuzzy Concept Grouping Engine ───────────────────────────────────────────
const SINONIMOS = {
  carne:'carne',carnes:'carne',carnne:'carne',res:'carne',
  pollo:'pollo',pollos:'pollo',
  verdura:'verdura',verduras:'verdura',vegetales:'verdura',
  queso:'queso',quesos:'queso',
  harina:'harina',harinas:'harina',
  viaje:'transporte',viajes:'transporte',flete:'transporte',taxi:'transporte',
  delivery:'delivery',deliverys:'delivery',
  sueldo:'sueldos',sueldos:'sueldos',salario:'sueldos',
  servicio:'servicios',servicios:'servicios',
  alquiler:'alquiler',arriendo:'alquiler',renta:'alquiler',
  cafe:'cafe',café:'cafe',
  hielo:'hielo',hielos:'hielo',
  mercado:'mercado',supermercado:'mercado',mercancia:'mercado',mercancía:'mercado',
  insumo:'insumos',insumos:'insumos',
}

export function normConcepto(texto) {
  const words = (texto || '').trim().toLowerCase().replace(/\s+/g,' ').split(' ')
  for (const w of words) {
    if (SINONIMOS[w]) return SINONIMOS[w]
    if (w.length >= 4) {
      const raiz = w.slice(0, 4)
      for (const [k, v] of Object.entries(SINONIMOS)) {
        if (k.slice(0, 4) === raiz) return v
      }
    }
  }
  return words.join(' ')
}

export function agruparConceptos(gastos, tasa, toUSD) {
  const map = {}
  for (const g of gastos) {
    const key = normConcepto(g.concepto)
    if (!map[key]) map[key] = { total: 0, count: 0 }
    map[key].total += toUSD(g.monto, g.moneda, tasa)
    map[key].count++
  }
  return Object.entries(map)
    .map(([name, d]) => ({ name, value: Math.round(d.total * 100) / 100, count: d.count }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)
}
