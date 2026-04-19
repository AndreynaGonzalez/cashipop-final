/* ── Categorías por palabras clave ── */
const KEYWORDS = {
  Insumos: [
    'carne','pollo','cerdo','res','pescado','atún','atun','sardina','jamón','jamon',
    'pan','arroz','pasta','harina','azúcar','azucar','sal','aceite','café','cafe',
    'leche','queso','tomate','cebolla','ajo','pimiento','verdura','fruta','aguacate',
    'mercado','bodega','supermercado','comida','ingrediente','insumo',
    'huevo','huevos','mantequilla','margarina','caraotas','lentejas',
    'papas','yuca','plátano','platano','cambur','refresco','gaseosa',
    'jugo','agua mineral','servilleta','bolsa',
  ],
  Sueldos: [
    'sueldo','salario','pago','personal','empleado','trabajador',
    'quincena','semana','nómina','nomina','obrero','ayudante',
  ],
  Servicios: [
    'luz','agua','gas','internet','teléfono','telefono','electricidad',
    'corpoelec','hidrocapital','hidro','movilnet','digitel','cantv','cable',
    'servicio','factura','recibo',
  ],
  Alquiler: ['alquiler','local','arriendo','arrendamiento','renta'],
  Arcelia:  ['arcelia'],
  Eduardo:  ['eduardo'],
  Carlos:   ['carlos'],
}

export function detectarCategoria(texto) {
  const t = (texto || '').toLowerCase()
  for (const [cat, words] of Object.entries(KEYWORDS)) {
    if (words.some(w => t.includes(w))) return cat
  }
  return 'Insumos'
}

function limpiarConcepto(str) {
  return str
    .split(' ')
    .filter(w => w.length > 1)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .trim() || 'Varios'
}

/* ════════════════════════════════════════
   parsearTicket — extrae el TOTAL de un
   ticket OCR. Devuelve hasta 3 candidatos
   ordenados por probabilidad.
════════════════════════════════════════ */

// Palabras que indican que esa línea tiene el total
const KW_TOTAL = [
  'TOTAL', 'GRAN TOTAL', 'A PAGAR', 'SUBTOTAL',
  'NETO', 'SUMA', 'AMOUNT', 'IMPORTE',
]

function normalizarNumero(raw) {
  // Soporta: 1.234,56 (europeo) | 1,234.56 (US) | 1234.56 | 1234,56
  const s = raw.trim()
  if (/^\d+$/.test(s)) return parseInt(s)
  // Si termina en ,XX → decimal con coma (europeo)
  if (/^\d{1,3}(?:\.\d{3})*,\d{2}$/.test(s))
    return parseFloat(s.replace(/\./g,'').replace(',','.'))
  // Si termina en .XX → decimal con punto
  if (/^\d{1,3}(?:,\d{3})*\.\d{2}$/.test(s))
    return parseFloat(s.replace(/,/g,''))
  // Fallback: quitar comas, parsear
  return parseFloat(s.replace(',','.').replace(/[^0-9.]/g,''))
}

function extraerMontosDeLinea(linea) {
  // Captura números como: 15, 15.50, 15,50, 1.234,56, 1,234.56
  const regex = /\b(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d{1,6}(?:[.,]\d{2})?)\b/g
  const result = []
  let m
  while ((m = regex.exec(linea)) !== null) {
    const num = normalizarNumero(m[1])
    if (isNaN(num) || num <= 0 || num > 999999) continue
    // Filtrar años (2020-2030)
    if (num >= 2020 && num <= 2030 && Number.isInteger(num)) continue
    // Filtrar números de 7+ dígitos enteros (teléfonos, facturas)
    if (Number.isInteger(num) && m[1].replace(/\D/g,'').length >= 7) continue
    result.push(num)
  }
  return [...new Set(result)]
}

export function parsearTicket(texto) {
  if (!texto?.trim()) return []

  const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean)
  const candidatos = []

  // Detectar moneda global del ticket
  const esBS = /\bbs\.?\b|bolívar|bolivar/i.test(texto)
  const moneda = esBS ? 'BS' : 'USD'

  // PASADA 1: líneas con palabra clave de total
  for (let i = 0; i < lineas.length; i++) {
    const lineaUp = lineas[i].toUpperCase()
    const kwIdx = KW_TOTAL.findIndex(kw => lineaUp.includes(kw))
    if (kwIdx < 0) continue

    // Buscar número en la misma línea o en la línea siguiente/anterior
    const vecinas = [lineas[i], lineas[i-1], lineas[i+1]].filter(Boolean)
    for (const v of vecinas) {
      for (const num of extraerMontosDeLinea(v)) {
        candidatos.push({ monto: num, prioridad: kwIdx, moneda })
      }
    }
  }

  // PASADA 2: si no hubo keywords, tomar números con decimales de las últimas 8 líneas
  if (candidatos.length === 0) {
    const ultimas = lineas.slice(-8)
    for (const linea of ultimas) {
      for (const num of extraerMontosDeLinea(linea)) {
        if (!Number.isInteger(num)) // preferir los que tienen decimales
          candidatos.push({ monto: num, prioridad: 99, moneda })
      }
    }
    // Si aún nada, tomar cualquier número de las últimas líneas
    if (candidatos.length === 0) {
      for (const linea of ultimas) {
        for (const num of extraerMontosDeLinea(linea)) {
          candidatos.push({ monto: num, prioridad: 100, moneda })
        }
      }
    }
  }

  // Ordenar: primero los de mayor prioridad (menor índice),
  // luego los que tienen decimales, luego los más grandes
  candidatos.sort((a, b) => {
    if (a.prioridad !== b.prioridad) return a.prioridad - b.prioridad
    const aD = !Number.isInteger(a.monto)
    const bD = !Number.isInteger(b.monto)
    if (aD !== bD) return aD ? -1 : 1
    return b.monto - a.monto
  })

  // Deduplicar y devolver top 3
  const vistos = new Set()
  const top3 = []
  for (const c of candidatos) {
    const key = c.monto.toFixed(2)
    if (!vistos.has(key)) { vistos.add(key); top3.push(c) }
    if (top3.length >= 3) break
  }
  return top3
}

export function parsearTexto(texto) {
  if (!texto?.trim()) return []

  const normalizado = texto.replace(/\s+/g, ' ').trim()

  // Separar por comas, " y ", " también ", " además "
  const segmentos = normalizado
    .split(/,\s*|\s+y\s+|\s*;\s*|\s+también\s+|\s+además\s+/i)
    .map(s => s.trim())
    .filter(s => s.length > 3 && /\d/.test(s))

  const items = []
  let id = Date.now()
  for (const seg of segmentos) {
    const item = extraerItem(seg, id++)
    if (item) items.push(item)
  }
  return items
}

function extraerItem(seg, idBase) {
  const montoMatch = seg.match(/\b(\d{1,7}(?:[.,]\d{1,2})?)\b/)
  if (!montoMatch) return null
  const monto = parseFloat(montoMatch[1].replace(',', '.'))
  if (!monto || monto <= 0) return null

  const segLow = seg.toLowerCase()
  const moneda = /bolívar|bolivar|\bbs\b/.test(segLow) ? 'BS' : 'USD'

  let concepto = seg
    .replace(/\b\d{1,7}(?:[.,]\d{1,2})?\b/, '')
    .replace(/bolívares?|bolivares?|\bbs\.?\b/gi, '')
    .replace(/dólares?|dolares?|\busd\b|\$/gi, '')
    .replace(
      /\b(de|en|para|que|le|di|a|los|las|el|la|un|una|me|por|con|del|al|anotame|anotar|hay|son|fueron|esto|ese|eso|esta|unos|unas)\b/gi,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim()

  concepto = limpiarConcepto(concepto)
  const categoria = detectarCategoria(concepto + ' ' + segLow)

  return {
    id: `${idBase}-${Math.random().toString(36).slice(2)}`,
    concepto,
    monto,
    moneda,
    categoria,
    tipo: 'gasto',
    confirmado: false,
  }
}
