import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabase, fetchGastos, fetchIngresos, fetchGastosTrash, fetchIngresosTrash, insertGasto, softDeleteGasto, restoreGasto, deleteGasto, deleteIngresosByFecha, softDeleteIngresosByFecha, deleteGastosByFecha, softDeleteGastosByFecha, insertIngreso, restoreIngreso, signIn, signUp, signOut, onAuthChange, getSession, autoPurge } from './supabase'
import {
  Home, Receipt, BarChart3, CalendarDays, PieChart as PieIcon,
  DollarSign, Landmark, Smartphone, Banknote, Bike, Zap,
  TrendingUp, TrendingDown, CheckCircle, AlertCircle,
  Camera, Mic, MicOff, Lock, Plus, Trash2, ArrowLeft,
  RefreshCw, ChevronRight, Edit3, CreditCard, Package,
  X, Lightbulb, Calendar, RotateCcw, Trash,
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts'

// ─── Tokens de diseño — Cashipop Brand ──────────────────────────────────────
const T = {
  bg:          '#FFF1DC',    // fondo cálido oficial
  surface:     '#FFFFFF',
  border:      'rgba(94,64,91,0.08)',
  navy:        '#5E405B',    // texto principal (brand)
  sub:         '#7D6279',
  muted:       '#B8A3B5',
  forest:      '#2D6A4F',
  forestLight: '#E8F5EE',
  cobalt:      '#5E405B',    // primario = brand
  cobaltLight: '#F5ECF4',
  rose:        '#FF7752',    // alertas/errores
  roseLight:   '#FFF0EB',
  amber:       '#FFB752',    // acentos/acciones
  amberLight:  '#FFF7E8',
  wa:          '#25D366',
  brand:       '#5E405B',
  brandGold:   '#FFB752',
  alert:       '#FF7752',
  // Sombras boutique
  shadowCard:  '0 2px 32px rgba(94,64,91,0.06)',
  shadowNav:   '0 -1px 0 rgba(94,64,91,0.05)',
}

// ─── Storage ──────────────────────────────────────────────────────────────────
const KEY      = 'CASHIPOP_V4'
const HIST_KEY = 'CASHIPOP_HIST'
const hoy = () => new Date().toISOString().slice(0, 10)

function cargarData() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

function guardarData(d) { localStorage.setItem(KEY, JSON.stringify(d)) }

function archivarData(d) {
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

function cargarHistorial() {
  try { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]') }
  catch { return [] }
}

const FRASES_PODER = [
  'Cashipop brilla hoy gracias a ti, Arcelia.',
  'Tu esfuerzo construye el futuro.',
  'Eres la jefa de tu destino, preparando tus numeros...',
  'Cada dia es una oportunidad para crecer.',
  'Los numeros no mienten, y los tuyos van bien.',
  'Orden y constancia, la receta del exito.',
]

function dataVacia(tasa = 481.21) {
  return {
    fecha: hoy(), tasa,
    ingresos: {
      bicentenario:'', bancaribe:'', banesco:'', bancamiga:'',
      pagos_dia:'', efectivo_bs:'', delivery:'',
      pedidosya_usd:'', pedidosya_bs:'', divisas_usd:'', cuentas_cobrar:'',
    },
    gastos: [], cerrada: false,
  }
}

// ─── BCV ─────────────────────────────────────────────────────────────────────
async function fetchTasaBCV() {
  const url = 'https://www.bcv.org.ve/glosario/cambio-oficial'
  const proxies = [
    u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  ]
  for (const px of proxies) {
    try {
      const res  = await fetch(px(url), { signal: AbortSignal.timeout(7000) })
      const html = await res.text()
      for (const m of html.matchAll(/(\d{3,})[,.](\d{2})\b/g)) {
        const v = parseFloat(`${m[1]}.${m[2]}`)
        if (v > 100 && v < 2000) return Math.round(v * 100) / 100
      }
    } catch {}
  }
  return null
}

// ─── OCR con Gemini via OpenRouter ────────────────────────────────────────────
const OCR_SYSTEM = `Eres un lector de libretas de cierre de caja para Cashipop.
Extrae los valores de la foto. Responde SOLO JSON valido, sin markdown:
{
  "fecha": "",
  "tasa": 0,
  "bicentenario": 0, "bancaribe": 0, "banesco": 0, "bancamiga": 0,
  "pagos_dia": 0, "efectivo_bs": 0, "delivery": 0,
  "pedidosya_usd": 0, "pedidosya_bs": 0,
  "divisas_usd": 0, "cuentas_cobrar": 0,
  "cierre_total": 0
}
Reglas:
- "fecha" es la fecha escrita en el cuaderno en formato YYYY-MM-DD. Si no se ve, deja "".
- "tasa" es la tasa del dolar BCV anotada (ej: 479,77 → 479.77).
- Los montos en Bs van tal cual. Los montos en $ van en los campos _usd.
- "cierre_total" es el total general en USD que ella anoto.
- Si un campo no aparece, dejalo en 0.
- Usa punto decimal, no coma.`

async function procesarFotoConIA(file) {
  const base64 = await new Promise((res) => {
    const reader = new FileReader()
    reader.onload = () => res(reader.result.split(',')[1])
    reader.readAsDataURL(file)
  })

  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
    },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: OCR_SYSTEM },
        { role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
          { type: 'text', text: 'Lee esta libreta de cierre de caja y extrae los valores.' },
        ]},
      ],
      max_tokens: 500,
      temperature: 0,
    }),
  })

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '')
    console.error('OpenRouter OCR error:', resp.status, errBody)
    throw new Error(`${resp.status} ${errBody.slice(0, 100)}`)
  }

  const json = await resp.json()
  if (json.error) {
    console.error('OpenRouter OCR response error:', json.error)
    throw new Error(json.error.message || JSON.stringify(json.error))
  }

  const raw = json.choices?.[0]?.message?.content || '{}'
  console.log('OCR IA response:', raw)
  const match = raw.match(/\{[\s\S]*\}/)
  return match ? JSON.parse(match[0]) : null
}

// ─── Helpers de texto y números ───────────────────────────────────────────────
const FILLER_WORDS = /^(pago|gasto|compra|compras|gastos|pagos|de|del|para|por|en|el|la|los|las|un|una)$/i
function formatConcept(str) {
  if (!str) return ''
  // Capitalize each word
  let words = str.trim().split(/\s+/).map(w =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  )
  // Remove filler words at the start
  while (words.length > 1 && FILLER_WORDS.test(words[0])) words.shift()
  // Deduplicate consecutive repeated words ("Cafe Cafe" → "Cafe")
  words = words.filter((w, i) => i === 0 || w.toLowerCase() !== words[i - 1].toLowerCase())
  return words.join(' ') || 'Varios'
}
const capitalizar = formatConcept

function redondear(v) {
  return Math.round((parseFloat(v) || 0) * 100) / 100
}

// ─── Cálculos ─────────────────────────────────────────────────────────────────
const n  = s => parseFloat(s) || 0
const bs = (s, t) => redondear(n(s) / t)
const us = s => n(s)

function totalUSD(ing, tasa) {
  return bs(ing.bicentenario,tasa) + bs(ing.bancaribe,tasa) + bs(ing.banesco,tasa) +
         bs(ing.bancamiga,tasa)    + bs(ing.pagos_dia,tasa) + bs(ing.efectivo_bs,tasa) +
         bs(ing.delivery,tasa)     + us(ing.pedidosya_usd)   + bs(ing.pedidosya_bs,tasa) +
         us(ing.divisas_usd)
  // cuentas_cobrar excluida siempre
}

function totalGastosUSD(gastos, tasa) {
  return redondear(gastos.reduce((a,g)=>{
    const m=n(g.monto); return a+(g.moneda==='USD'?m:redondear(m/tasa))
  },0))
}

// ─── Categorías ───────────────────────────────────────────────────────────────
const CATS = [
  {id:'insumos',     label:'Insumos',     c:'#1D4ED8'},
  {id:'sueldos',     label:'Sueldos',     c:'#7C3AED'},
  {id:'honorarios',  label:'Honorarios',  c:'#BE185D'},
  {id:'proveedores', label:'Proveedores', c:'#C2410C'},
  {id:'varios',      label:'Varios',      c:'#374151'},
]

// ─── Parser de voz — números en español ───────────────────────────────────────
const NUMS_ES = {
  'cero':0,'un':1,'uno':1,'una':1,'dos':2,'tres':3,'cuatro':4,'cinco':5,'seis':6,
  'siete':7,'ocho':8,'nueve':9,'diez':10,'once':11,'doce':12,'trece':13,'catorce':14,
  'quince':15,'dieciséis':16,'dieciseis':16,'diecisiete':17,'dieciocho':18,'diecinueve':19,
  'veinte':20,'veintiuno':21,'veintidós':22,'veintidos':22,'veintitrés':23,'veintitres':23,
  'veinticuatro':24,'veinticinco':25,'veintiséis':26,'veintiseis':26,
  'veintisiete':27,'veintiocho':28,'veintinueve':29,
  'treinta':30,'cuarenta':40,'cincuenta':50,'sesenta':60,'setenta':70,
  'ochenta':80,'noventa':90,
  'cien':100,'ciento':100,'doscientos':200,'doscientas':200,
  'trescientos':300,'trescientas':300,'cuatrocientos':400,'cuatrocientas':400,
  'quinientos':500,'quinientas':500,'seiscientos':600,'seiscientas':600,
  'setecientos':700,'setecientas':700,'ochocientos':800,'ochocientas':800,
  'novecientos':900,'novecientas':900,'medio':500,'media':500,
}
const MIL_KW = /^mil(?:lones?|lón|lon)?$/i

function resolverNumES(tokens) {
  let total = 0, sub = 0
  for (const tok of tokens) {
    const t = tok.replace(/[^a-záéíóúüñ\d]/gi,'').toLowerCase()
    if (NUMS_ES[t] !== undefined)        { sub += NUMS_ES[t] }
    else if (/^\d+$/.test(t))            { sub += parseInt(t, 10) }
    else if (t === 'mil')                { sub = sub||1; total += sub*1_000;     sub = 0 }
    else if (/^millon/.test(t))          { sub = sub||1; total += sub*1_000_000; sub = 0 }
  }
  return total + sub
}

// Parsea la parte decimal después de "con" → "con cincuenta" = .50, "con setenta y cinco" = .75
function parsearDecimalCon(tokens, startIdx) {
  const decToks = []
  let i = startIdx
  while (i < tokens.length) {
    const t = tokens[i].replace(/[^a-záéíóúüñ\d]/gi,'').toLowerCase()
    if (NUMS_ES[t] !== undefined || /^\d+$/.test(t) || t === 'y') {
      decToks.push(tokens[i]); i++
    } else break
  }
  if (!decToks.length) return null
  const dec = resolverNumES(decToks)
  return dec > 0 ? { decimal: dec / 100, consumed: i - startIdx } : null
}

function extraerNumero(tokens) {
  // ── Digit-based: "100", "10.000", "10,5" ────────────────────────────────
  if (tokens[0] && /^\d[\d.,]*$/.test(tokens[0])) {
    const raw = tokens[0]
    // Venezuela: "10.000" = 10 000 (punto=miles); "10,5" = 10.5 (coma=decimal)
    let val = /\d\.\d{3}/.test(raw)
      ? parseFloat(raw.replace(/\./g,''))
      : parseFloat(raw.replace(',','.'))
    let consumed = 1
    // Absorber multiplicadores
    if (tokens[consumed] && /^millones?$|^millón$|^millon$/.test(tokens[consumed])) { val *= 1_000_000; consumed++ }
    else if (tokens[consumed] === 'mil') { val *= 1_000; consumed++ }
    // Decimales: "con cincuenta", "con setenta y cinco"
    if (tokens[consumed] === 'con') {
      const d = parsearDecimalCon(tokens, consumed + 1)
      if (d) { val = Math.round((val + d.decimal) * 100) / 100; consumed += 1 + d.consumed }
    }
    return { amount: val, consumed }
  }

  // ── Word-based: "diez mil con cincuenta" ────────────────────────────────
  const numToks = []; let i = 0
  while (i < tokens.length) {
    const t = tokens[i].replace(/[^a-záéíóúüñ\d]/gi,'').toLowerCase()
    if (NUMS_ES[t] !== undefined || t === 'mil' || /^millon/.test(t) || /^\d+$/.test(t) || t === 'y') {
      numToks.push(tokens[i]); i++
    } else break
  }
  if (!numToks.length) return null
  let amount   = resolverNumES(numToks)
  let consumed = i
  // Decimales: "con cincuenta"
  if (tokens[consumed] === 'con') {
    const d = parsearDecimalCon(tokens, consumed + 1)
    if (d) { amount = Math.round((amount + d.decimal) * 100) / 100; consumed += 1 + d.consumed }
  }
  return amount > 0 ? { amount, consumed } : null
}

// Detectores de moneda
const RE_BS  = /bolívar|bolivar|soberan|bs(?:\s|$|,)|local|nacionale|criollo/i
const RE_USD = /dólar|dolar|verde|pavo|usd|divisa|bill/i

function parsearSegmentoVoz(seg, tasa) {
  let t = seg.toLowerCase()
    .replace(/^(?:anótame|anota|registra|también|además|y)\s+/i,'').trim()

  const esBS  = RE_BS.test(t)
  const esUSD = RE_USD.test(t)

  // Quitar palabras de moneda para limpiar el texto
  const sinMon = t
    .replace(/bolívares?|bolivares?/gi,'').replace(/soberanos?/gi,'')
    .replace(/dólares?|dolares?/gi,'').replace(/verdes?/gi,'')
    .replace(/pavos?/gi,'').replace(/\busd\b/gi,'')
    .replace(/\bbs\b/gi,'').replace(/divisas?/gi,'').replace(/bills?/gi,'')
    .replace(/\s{2,}/g,' ').trim()

  const tokens = sinMon.split(/\s+/).filter(Boolean)
  const numR   = extraerNumero(tokens)
  if (!numR || !numR.amount) return null

  // Concepto = lo que queda después del número (y el separador "de/para/en")
  const rest = tokens.slice(numR.consumed).join(' ')
    .replace(/^(?:de|para|en|del|a|por|con)\s+/i,'').trim()

  if (!rest) return null  // sin concepto = ignorar

  const rawAmt = numR.amount
  let montoUSD, bsOrig

  if (esUSD) {
    montoUSD = redondear(rawAmt); bsOrig = null
  } else {
    bsOrig   = Math.round(rawAmt)
    montoUSD = redondear(rawAmt / tasa)
  }

  return {
    concepto:  capitalizar(rest),
    monto:     String(montoUSD),
    moneda:    'USD',          // siempre USD después de la conversión
    bsOrig,                   // monto BS original (null si era USD)
    categoria: 'insumos',
    id:        Date.now() + Math.random(),
  }
}

// Separadores de gastos múltiples
const RE_SEP = /\s+y\s+también\s+|\s+y\s+además\s+|\s+también\s+|\s+además\s+/i

function parsearVozMultiple(texto, tasa) {
  return texto
    .split(RE_SEP)
    .flatMap(seg => seg.split(/\s*,\s+/))
    .map(s => s.replace(/^(?:anótame|anota|registra|también|y|además)\s+/i,'').trim())
    .filter(s => s.length > 3)
    .map(seg => parsearSegmentoVoz(seg, tasa))
    .filter(Boolean)
}

// ─── OpenRouter IA ────────────────────────────────────────────────────────────
const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_KEY || ''
const SYSTEM_PROMPT = 'Contador Cashipop. Tasa: 481.21. ESTO ES UN GASTO/EGRESO, nunca un ingreso. Si dice Bs, divide entre tasa y redondea a 2 decimales. Si dice $, mantiene. Numeros redondos se quedan redondos. Capitaliza cada palabra del concepto. Si el monto original era en Bs, incluyelo en "bs". Responde solo JSON: [{"c":"Concepto","m":0.00,"bs":0}] donde "bs" es el monto original en bolivares (0 si era en dolares).'

const FACTURA_SYSTEM = `Eres un extractor de gastos/egresos para el restaurante Cashipop.
La foto es una FACTURA DE PROVEEDOR o TICKET DE COMPRA. Esto es siempre un GASTO, nunca un ingreso.
Extrae cada item o el total. Tasa: 481.21. Si el monto esta en Bs, divide entre la tasa.
Capitaliza cada palabra. Responde SOLO JSON:
[{"c":"Concepto","m":0.00,"bs":0}]
- "c" = concepto/descripcion del gasto
- "m" = monto en USD (si era Bs, ya dividido entre tasa)
- "bs" = monto original en Bs (0 si era en dolares)
Si solo hay un total, devuelve un solo item con el concepto del proveedor/tienda.`

async function procesarGastoConIA(texto, tasa) {
  const prompt = SYSTEM_PROMPT.replace('481.21', String(tasa))
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
    },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: texto },
      ],
      max_tokens: 200,
      temperature: 0,
    }),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    console.error('OpenRouter API error:', res.status, errBody)
    throw new Error(`${res.status} ${errBody.slice(0, 100)}`)
  }

  const json = await res.json()
  if (json.error) {
    console.error('OpenRouter response error:', json.error)
    throw new Error(json.error.message || JSON.stringify(json.error))
  }

  const raw = json.choices?.[0]?.message?.content || '[]'
  console.log('IA response:', raw)
  const match = raw.match(/\[[\s\S]*\]/)
  return match ? JSON.parse(match[0]) : []
}

async function procesarFotoComoGasto(file, tasa) {
  const base64 = await new Promise((res) => {
    const reader = new FileReader()
    reader.onload = () => res(reader.result.split(',')[1])
    reader.readAsDataURL(file)
  })

  const prompt = FACTURA_SYSTEM.replace('481.21', String(tasa))
  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
    },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
          { type: 'text', text: 'Extrae los gastos de esta factura o ticket de compra.' },
        ]},
      ],
      max_tokens: 500,
      temperature: 0,
    }),
  })

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '')
    throw new Error(`${resp.status} ${errBody.slice(0, 100)}`)
  }
  const json = await resp.json()
  if (json.error) throw new Error(json.error.message || JSON.stringify(json.error))
  const raw = json.choices?.[0]?.message?.content || '[]'
  console.log('Factura IA response:', raw)
  const match = raw.match(/\[[\s\S]*\]/)
  return match ? JSON.parse(match[0]) : []
}

// ─── Formato ──────────────────────────────────────────────────────────────────
function formatMoney(v) {
  const raw = Number(v) || 0
  const num = Math.abs(Math.round(raw * 100) / 100)
  const fixed = num.toFixed(2)
  const [int, dec] = fixed.split('.')
  const miles = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${miles},${dec}`
}

const fUSD = v => `$ ${formatMoney(v)}`
const fBS  = v => `Bs ${formatMoney(v)}`

// Convierte un monto de DB a USD segun su moneda
function toUSD(monto, moneda, tasa) {
  const m = Number(monto) || 0
  return moneda === 'BS' ? redondear(m / tasa) : redondear(m)
}
const fDate = iso => {
  const [y,m,d] = iso.split('-')
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${+d} ${months[+m-1]} ${y}`
}

// ═════════════════════════════════════════════════════════════════
// ÁTOMOS UI
// ═════════════════════════════════════════════════════════════════

function Confetti({ active }) {
  if (!active) return null
  const ps = Array.from({length:36},(_,i)=>({id:i,left:`${Math.random()*100}%`,color:[T.forest,T.brand,T.brandGold,T.alert,'#7C3AED'][i%5],delay:`${Math.random()*.6}s`,dur:`${1.4+Math.random()*.8}s`,w:`${6+Math.random()*7}px`}))
  return (
    <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:9999,overflow:'hidden'}}>
      {ps.map(p=><div key={p.id} style={{position:'absolute',top:'-20px',left:p.left,width:p.w,height:p.w,borderRadius:'3px',background:p.color,animation:`cf ${p.dur} ${p.delay} ease-in forwards`}}/>)}
      <style>{`@keyframes cf{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}`}</style>
    </div>
  )
}

function Toast({ msg }) {
  if (!msg) return null
  return (
    <div style={{position:'fixed',bottom:88,left:'50%',transform:'translateX(-50%)',background:T.navy,color:'#fff',padding:'12px 22px',borderRadius:14,fontSize:14,fontWeight:600,zIndex:9998,whiteSpace:'nowrap',boxShadow:'0 8px 32px rgba(0,0,0,0.18)',animation:'tu .25s ease'}}>
      {msg}
      <style>{`@keyframes tu{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
    </div>
  )
}

function Confirm({ title, msg, children, onYes, onNo, yesLabel='Confirmar', noLabel='Cancelar', yesColor=T.forest, icon:ConfIcon=AlertCircle, iconColor=T.amber }) {
  if (!msg && !children) return null
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.35)',zIndex:9990,display:'flex',alignItems:'flex-end',padding:'0 16px 28px'}}>
      <div style={{background:T.surface,borderRadius:28,padding:'28px 24px',width:'100%',boxShadow:'0 -8px 40px rgba(0,0,0,0.12)'}}>
        <ConfIcon size={26} color={iconColor} strokeWidth={1.75} style={{margin:'0 auto 14px',display:'block'}}/>
        {title && <p style={{fontSize:18,fontWeight:800,color:T.navy,textAlign:'center',marginBottom:8}}>{title}</p>}
        {msg && <p style={{fontSize:15,fontWeight:600,color:T.sub,textAlign:'center',lineHeight:1.5}}>{msg}</p>}
        {children}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:20}}>
          <button onClick={onNo} style={{padding:'15px',borderRadius:14,border:`1.5px solid ${T.border}`,background:T.bg,fontSize:14,fontWeight:700,color:T.sub,cursor:'pointer'}}>
            {noLabel}
          </button>
          <button onClick={onYes} style={{padding:'15px',borderRadius:14,border:'none',background:yesColor,fontSize:14,fontWeight:700,color:'#fff',cursor:'pointer'}}>
            {yesLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// Tarjeta boutique: radio 32px, sombra ultra difuminada
function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{
      background:T.surface, borderRadius:28,
      border:`1px solid ${T.border}`,
      boxShadow:T.shadowCard, padding:'22px',
      cursor:onClick?'pointer':undefined, ...style,
    }}>
      {children}
    </div>
  )
}

function Btn({ children, onClick, bg, color='#fff', full, style, disabled, icon:Icon }) {
  const base=bg||T.cobalt; const sh=`0 4px 0 ${base}44`
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background:base, color, border:'none', borderRadius:16,
      padding:'14px 20px', fontSize:15, fontWeight:700,
      cursor:disabled?'not-allowed':'pointer',
      width:full?'100%':undefined, opacity:disabled?.45:1,
      boxShadow:sh, display:'flex', alignItems:'center',
      justifyContent:'center', gap:8,
      transition:'transform .08s, box-shadow .08s',
      WebkitTapHighlightColor:'transparent',
      letterSpacing:'-.01em', ...style,
    }}
      onPointerDown={e=>{if(!disabled){e.currentTarget.style.transform='translateY(3px)';e.currentTarget.style.boxShadow=`0 1px 0 ${base}44`}}}
      onPointerUp={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=sh}}
      onPointerLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=sh}}
    >
      {Icon&&<Icon size={17} strokeWidth={1.75}/>}{children}
    </button>
  )
}

const Sep = () => <div style={{height:1,background:T.border,margin:'14px 0'}}/>

const Label = ({children}) => (
  <p style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:'.1em',textTransform:'uppercase',marginBottom:10}}>{children}</p>
)

// Campo de monto minimalista
function CampoMonto({ label, value, onChange, moneda='BS', icon:Icon, micActive, onMic, dimmed }) {
  const filled = !!value
  return (
    <div style={{opacity:dimmed?.55:1}}>
      <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:8}}>
        {Icon&&<Icon size={14} strokeWidth={1.75} color={filled&&!dimmed?T.cobalt:T.muted}/>}
        <span style={{fontSize:13,fontWeight:600,color:filled&&!dimmed?T.navy:T.sub}}>{label}</span>
        {dimmed&&<span style={{fontSize:10,fontWeight:700,color:T.amber,background:T.amberLight,padding:'2px 7px',borderRadius:6,marginLeft:4}}>No suma</span>}
      </div>
      <div style={{display:'flex',gap:8}}>
        <div style={{position:'relative',flex:1}}>
          <span style={{position:'absolute',left:13,top:'50%',transform:'translateY(-50%)',fontSize:16,fontWeight:700,color:dimmed?T.muted:filled?T.cobalt:T.muted}}>
            {moneda==='USD'?'$':'Bs'}
          </span>
          <input type="number" inputMode="decimal" value={value} onChange={e=>onChange(e.target.value)} placeholder="0,00"
            style={{width:'100%',paddingLeft:38,paddingRight:12,height:50,fontSize:19,fontWeight:800,border:`1.5px solid ${dimmed?T.amberLight:filled?T.cobalt:T.border}`,borderRadius:14,background:dimmed?T.amberLight:filled?T.cobaltLight:T.bg,color:T.navy,outline:'none',transition:'border-color .15s,background .15s'}}/>
        </div>
        {onMic&&(
          <button onClick={onMic} style={{width:50,height:50,borderRadius:14,border:'none',flexShrink:0,background:micActive?T.roseLight:T.cobaltLight,color:micActive?T.rose:T.cobalt,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',WebkitTapHighlightColor:'transparent'}}>
            {micActive?<MicOff size={18} strokeWidth={1.75}/>:<Mic size={18} strokeWidth={1.75}/>}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Botón WhatsApp terciario ─────────────────────────────────────────────────
function WaBtn({ onClick }) {
  return (
    <button onClick={onClick} title="Enviar a mi hija" style={{width:38,height:38,borderRadius:11,border:`1px solid ${T.border}`,background:T.surface,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',WebkitTapHighlightColor:'transparent',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill={T.wa}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    </button>
  )
}

// ─── Barra de navegación: 5 tabs ─────────────────────────────────────────────
function BottomNav({ pantalla, go }) {
  const tabs = [
    { id:'home',      label:'Inicio',    Icon:Home        },
    { id:'gastos',    label:'Gastos',    Icon:Receipt     },
    { id:'cierre',    label:'Cierre',    Icon:BarChart3   },
    { id:'metricas',  label:'Metricas',  Icon:PieIcon     },
    { id:'historial', label:'Historial', Icon:CalendarDays},
  ]
  return (
    <nav style={{
      position:'fixed', bottom:0, left:0, right:0,
      background:T.surface,
      boxShadow:T.shadowNav,
      display:'grid', gridTemplateColumns:'repeat(5,1fr)',
      zIndex:200, paddingBottom:'env(safe-area-inset-bottom,12px)',
    }}>
      {tabs.map(({ id, label, Icon }) => {
        const active = pantalla === id
        return (
          <button key={id} onClick={()=>go(id)} style={{
            background:'none', border:'none',
            padding:'12px 4px 10px',
            display:'flex', flexDirection:'column',
            alignItems:'center', gap:4,
            cursor:'pointer',
            color: active ? T.brand : T.muted,
            WebkitTapHighlightColor:'transparent',
          }}>
            <Icon size={22} strokeWidth={active ? 2 : 1.5}/>
            <span style={{fontSize:10,fontWeight:active?700:500,letterSpacing:'.02em'}}>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}

// ─── Header de pantalla interior ──────────────────────────────────────────────
const SAVING_MSGS = [
  'Guardando ingresos en la base de datos...',
  'Sincronizando con el historial...',
  '¡Casi listo, Cashipop esta brillando!',
]

function SavingOverlay({ active, msg }) {
  if (!active) return null
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(94,64,91,0.85)',zIndex:9999,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:24}}>
      <div style={{width:56,height:56,borderRadius:16,background:'rgba(255,255,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <RefreshCw size={28} color='#FFB752' strokeWidth={1.75} style={{animation:'spin 1s linear infinite'}}/>
      </div>
      <p style={{fontSize:17,fontWeight:700,color:'#fff',textAlign:'center',padding:'0 40px',lineHeight:1.5}}>{msg}</p>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function InnerHeader({ title, onBack }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:28}}>
      <button onClick={onBack} style={{width:38,height:38,borderRadius:11,border:`1px solid ${T.border}`,background:T.surface,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',WebkitTapHighlightColor:'transparent'}}>
        <ArrowLeft size={18} color={T.navy} strokeWidth={1.75}/>
      </button>
      <h2 style={{fontSize:19,fontWeight:800,color:T.navy,letterSpacing:'-.025em'}}>{title}</h2>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════
// APP
// ═════════════════════════════════════════════════════════════════
export default function App() {
  const [user,       setUser]       = useState(undefined) // undefined=loading, null=no auth, object=logged in
  const [authEmail,  setAuthEmail]  = useState('')
  const [authPass,   setAuthPass]   = useState('')
  const [authMode,   setAuthMode]   = useState('login') // 'login' | 'register'
  const [authError,  setAuthError]  = useState('')
  const [authLoading,setAuthLoading]= useState(false)
  const [pantalla,   setPantalla]   = useState('home')
  const [data,       setData]       = useState(null)
  const [confetti,   setConfetti]   = useState(false)
  const [toast,      setToast]      = useState('')
  const [bcvLoad,    setBcvLoad]    = useState(false)
  const [tasaTemp,   setTasaTemp]   = useState('481.21')
  const [progOCR,    setProgOCR]    = useState(0)
  const [ocrRes,     setOcrRes]     = useState(null)
  const [campoVoz,   setCampoVoz]   = useState(null)
  const [gasto,      setGasto]      = useState({concepto:'',monto:'',moneda:'BS',categoria:'insumos'})
  const [confirm,    setConfirm]    = useState(null)
  const [pendGastos, setPendGastos] = useState([])
  const [historial,  setHistorial]  = useState([])
  const [histItem,   setHistItem]   = useState(null) // detalle de un día histórico
  const [procesandoVoz, setProcesandoVoz] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [transcriptFinal, setTranscriptFinal] = useState('')
  const [editingIdx, setEditingIdx] = useState(null)
  const [fechaCierre, setFechaCierre] = useState(hoy())
  const [tasaEditing, setTasaEditing] = useState(false)
  const [dbGastos,   setDbGastos]   = useState([])
  const [dbIngresos, setDbIngresos] = useState([])
  const [dbLoaded,   setDbLoaded]   = useState(false)
  const [trashGastos, setTrashGastos] = useState([])
  const [trashIngresos, setTrashIngresos] = useState([])
  const [showTrash,  setShowTrash]  = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [savingMsg,  setSavingMsg]  = useState('')
  const [ingDirty,   setIngDirty]   = useState(false)

  const fileRef        = useRef(null)
  const gastoFileRef   = useRef(null)
  const gastoGalRef    = useRef(null)
  const homeFileRef    = useRef(null)
  const cierreFileRef  = useRef(null)
  const cierreGalRef   = useRef(null)
  const srRef          = useRef(null)
  const SR      = window.SpeechRecognition || window.webkitSpeechRecognition

  const go        = useCallback(p => setPantalla(p), [])
  const showToast = useCallback((msg, ms=2500) => {
    setToast(msg); setTimeout(()=>setToast(''), ms)
  }, [])

  // ── Auth listener ────────────────────────────────────────────────────────────
  useEffect(() => {
    getSession().then(u => setUser(u || null))
    const { data: { subscription } } = onAuthChange(u => setUser(u || null))
    return () => subscription.unsubscribe()
  }, [])

  // ── Cargar datos de Supabase + auto-purge ────────────────────────────────────
  useEffect(() => {
    if (!supabase) { setDbLoaded(true); return }
    autoPurge().then(() =>
      Promise.all([fetchGastos(), fetchIngresos()]).then(([g, i]) => {
        setDbGastos(g); setDbIngresos(i); setDbLoaded(true)
        console.log(`Supabase: ${g.length} gastos, ${i.length} ingresos`)
      })
    )
  }, [])

  // ── Init (tasa instantanea desde cache, sin esperar BCV) ────────────────────
  useEffect(() => {
    setHistorial(cargarHistorial())
    const stored = cargarData()
    const tasaCache = parseFloat(localStorage.getItem('CP_TASA')) || 481.21

    if (stored) {
      if (stored.fecha !== hoy()) {
        archivarData(stored)
        setHistorial(cargarHistorial())
        const nueva = dataVacia(tasaCache)
        setData(nueva); guardarData(nueva)
        setTasaTemp(String(tasaCache))
      } else {
        setData(stored)
        setTasaTemp(String(stored.tasa))
      }
    } else {
      const nueva = dataVacia(tasaCache)
      setData(nueva); guardarData(nueva)
      setTasaTemp(String(tasaCache))
    }
    setPantalla('home')
  }, [])

  const bcvAbort = useRef(null)

  function applyTasa(t) {
    const val = Math.round(t * 100) / 100
    setTasaTemp(String(val))
    localStorage.setItem('CP_TASA', String(val))
    if (data) {
      const nueva = { ...data, tasa: val }
      setData(nueva); guardarData(nueva)
    }
  }

  function refetchBCV() {
    // Si esta editando manual, no interrumpir
    if (tasaEditing) return
    // Cancelar fetch anterior si existe
    if (bcvAbort.current) bcvAbort.current.abort()
    const ctrl = new AbortController()
    bcvAbort.current = ctrl
    setBcvLoad(true)

    const timeout = setTimeout(() => {
      ctrl.abort()
      setBcvLoad(false)
      setTasaEditing(true)
      showToast('Error BCV: Ingresa manual', 3000)
    }, 3000)

    fetchTasaBCV().then(t => {
      clearTimeout(timeout)
      if (ctrl.signal.aborted) return
      setBcvLoad(false)
      if (t) {
        applyTasa(t)
        showToast(`Tasa: Bs ${t}`)
      } else {
        setTasaEditing(true)
        showToast('Error BCV: Ingresa manual', 3000)
      }
    }).catch(() => {
      clearTimeout(timeout)
      if (ctrl.signal.aborted) return
      setBcvLoad(false)
      setTasaEditing(true)
      showToast('Error BCV: Ingresa manual', 3000)
    })
  }

  function startTasaEdit() {
    // Cancelar cualquier fetch en curso
    if (bcvAbort.current) bcvAbort.current.abort()
    setBcvLoad(false)
    setTasaEditing(true)
    setTasaTemp(String(data.tasa))
  }

  function onTasaChange(val) {
    // Solo numeros, punto y coma
    const clean = val.replace(/[^0-9.,]/g, '')
    setTasaTemp(clean)
    // Guardado instantaneo si es valido
    const num = parseFloat(clean.replace(',', '.'))
    if (num && num >= 10 && num <= 9999) {
      applyTasa(num)
    }
  }

  // ── Helpers de estado ────────────────────────────────────────────────────────
  function confirmarTasa() {
    const t = parseFloat(tasaTemp.replace(',','.'))
    if (!t||t<50||t>5000) { showToast('¡Tasa invalida!'); return }
    applyTasa(t)
    go('home')
  }

  function setIngreso(campo, valor) {
    const nueva = {...data, ingresos:{...data.ingresos,[campo]:valor}}
    setData(nueva); guardarData(nueva)
    setIngDirty(true)
  }

  function _commitGasto(g) {
    const entry = {...g, concepto: capitalizar(g.concepto), id:Date.now()+Math.random()}
    const nueva = {...data, gastos:[...data.gastos, entry]}
    setData(nueva); guardarData(nueva)
    // Sync to Supabase
    insertGasto({
      fecha: data.fecha,
      concepto: entry.concepto,
      monto: entry.moneda === 'USD' ? entry.monto : (parseFloat(entry.monto) / data.tasa),
      moneda: entry.moneda,
      categoria: entry.categoria || 'Insumos',
    }).then(row => {
      if (row) setDbGastos(prev => [row, ...prev])
    })
    return nueva
  }

  function agregarGasto(forzar=false) {
    const c = gasto.concepto.trim()
    if (!c||!gasto.monto) { showToast('Completa el gasto'); return }
    if (!forzar) {
      const dup = data.gastos.find(g=>g.concepto.toLowerCase()===c.toLowerCase()&&g.monto===gasto.monto&&g.moneda===gasto.moneda)
      if (dup) {
        setConfirm({title:'¿Gasto duplicado?',msg:`"${c}" ya esta anotado hoy. ¿Quieres guardarlo de nuevo?`,yesLabel:'Guardar igual',noLabel:'Cancelar',onYes:()=>{setConfirm(null);agregarGasto(true)}})
        return
      }
    }
    _commitGasto(gasto)
    setGasto({concepto:'',monto:'',moneda:'BS',categoria:'insumos'})
    go('home'); showToast('¡Listo! Gasto anotado correctamente.', 3000)
  }

  function commitPendGastos() {
    let d = data
    const toInsert = []
    for (const g of pendGastos) {
      const entry = {...g, concepto: capitalizar(g.concepto), id:Date.now()+Math.random()}
      d = {...d, gastos:[...d.gastos, entry]}
      toInsert.push({
        fecha: data.fecha,
        concepto: entry.concepto,
        monto: parseFloat(entry.monto) || 0,
        moneda: 'USD',
        categoria: entry.categoria || 'Insumos',
        notas: entry.bsOrig ? `Bs ${entry.bsOrig}` : null,
      })
    }
    setData(d); guardarData(d)
    // Sync all to Supabase
    Promise.all(toInsert.map(g => insertGasto(g))).then(rows => {
      const valid = rows.filter(Boolean)
      if (valid.length) setDbGastos(prev => [...valid, ...prev])
    })
    setPendGastos([]); go('home')
    showToast('¡Listo! Todo anotado correctamente.', 3000)
  }

  function eliminarGasto(g) {
    setConfirm({
      title: '¿Borrar este gasto?',
      msg: null,
      body: <p style={{fontSize:15,color:T.sub,textAlign:'center',lineHeight:1.6}}>
        ¿Quieres quitar <strong style={{color:T.navy}}>{g.concepto}</strong> por <strong style={{color:T.rose}}>{g.moneda==='USD'?fUSD(g.monto):fBS(g.monto)}</strong>?
      </p>,
      yesLabel: 'Mandar a la papelera',
      noLabel: 'No, dejarlo',
      yesColor: T.rose,
      onYes: () => {
        const nueva = { ...data, gastos: data.gastos.filter(x => x.id !== g.id) }
        setData(nueva); guardarData(nueva)
        // Soft delete in Supabase (moves to trash)
        if (typeof g.id === 'number' && g.id > 0 && g.id < 1e12) {
          softDeleteGasto(g.id).then(() => setDbGastos(prev => prev.filter(x => x.id !== g.id)))
        }
        setConfirm(null)
        showToast('Gasto enviado a la papelera (15 dias para restaurar)')
      },
    })
  }

  async function cerrarCaja() {
    const fecha = fechaCierre || hoy()
    const ingresos = data.ingresos

    // Validar que hay al menos un ingreso > 0
    const camposMap = [
      { key: 'bicentenario', concepto: 'Bicentenario', cat: 'Bancos', mon: 'BS' },
      { key: 'bancaribe', concepto: 'Bancaribe', cat: 'Bancos', mon: 'BS' },
      { key: 'banesco', concepto: 'Banesco', cat: 'Bancos', mon: 'BS' },
      { key: 'bancamiga', concepto: 'Bancamiga', cat: 'Bancos', mon: 'BS' },
      { key: 'pagos_dia', concepto: 'Pagomovil', cat: 'Pagos Del Dia', mon: 'BS' },
      { key: 'efectivo_bs', concepto: 'Efectivo Bolivares', cat: 'Efectivo', mon: 'BS' },
      { key: 'delivery', concepto: 'Delivery', cat: 'Delivery', mon: 'BS' },
      { key: 'pedidosya_usd', concepto: 'Pedidos Ya Prepago', cat: 'Delivery', mon: 'USD' },
      { key: 'pedidosya_bs', concepto: 'Pedidos Ya Efectivo', cat: 'Delivery', mon: 'BS' },
      { key: 'divisas_usd', concepto: 'Divisas', cat: 'Efectivo', mon: 'USD' },
      { key: 'cuentas_cobrar', concepto: 'Cuentas Por Cobrar', cat: 'Por Cobrar', mon: 'USD' },
    ]

    const rows = camposMap
      .filter(c => parseFloat(ingresos[c.key]) > 0)
      .map(c => ({
        fecha,
        concepto: c.concepto,
        monto: parseFloat(ingresos[c.key]),
        moneda: c.mon,
        categoria: c.cat,
        notas: `Cierre ${fecha}`,
      }))

    if (rows.length === 0) {
      showToast('No hay ingresos para guardar. Llena al menos un campo.', 3500)
      return
    }

    // Mostrar overlay de guardado
    setSaving(true); setSavingMsg(SAVING_MSGS[0])
    const msgInterval = setInterval(() => {
      setSavingMsg(prev => {
        const idx = SAVING_MSGS.indexOf(prev)
        return SAVING_MSGS[(idx + 1) % SAVING_MSGS.length]
      })
    }, 1500)

    try {
      // Guardar local
      const nueva = { ...data, fecha, cerrada: true }
      setData(nueva); guardarData(nueva)
      archivarData(nueva); setHistorial(cargarHistorial())

      // Guardar en Supabase
      if (supabase) {
        await deleteIngresosByFecha(fecha)
        const results = await Promise.all(rows.map(r => insertIngreso(r)))
        const saved = results.filter(Boolean).length

        if (saved === 0) {
          clearInterval(msgInterval); setSaving(false)
          showToast('¡Ups! No pudimos guardar el cierre. Revisa tu conexion e intenta de nuevo.', 5000)
          return
        }

        const [g, i] = await Promise.all([fetchGastos(), fetchIngresos()])
        setDbGastos(g); setDbIngresos(i)
      }

      clearInterval(msgInterval); setSaving(false); setIngDirty(false)
      setConfetti(true); setTimeout(() => setConfetti(false), 3500)
      showToast(`¡Caja cerrada! ${rows.length} ingresos guardados`)
    } catch {
      clearInterval(msgInterval); setSaving(false)
      showToast('¡Ups! No pudimos guardar el cierre. Revisa tu conexion e intenta de nuevo.', 5000)
    }
  }

  async function guardarIngresosManual() {
    const fecha = fechaCierre || hoy()
    const ingresos = data.ingresos
    const camposMap = [
      { key: 'bicentenario', concepto: 'Bicentenario', cat: 'Bancos', mon: 'BS' },
      { key: 'bancaribe', concepto: 'Bancaribe', cat: 'Bancos', mon: 'BS' },
      { key: 'banesco', concepto: 'Banesco', cat: 'Bancos', mon: 'BS' },
      { key: 'bancamiga', concepto: 'Bancamiga', cat: 'Bancos', mon: 'BS' },
      { key: 'pagos_dia', concepto: 'Pagomovil', cat: 'Pagos Del Dia', mon: 'BS' },
      { key: 'efectivo_bs', concepto: 'Efectivo Bolivares', cat: 'Efectivo', mon: 'BS' },
      { key: 'delivery', concepto: 'Delivery', cat: 'Delivery', mon: 'BS' },
      { key: 'pedidosya_usd', concepto: 'Pedidos Ya Prepago', cat: 'Delivery', mon: 'USD' },
      { key: 'pedidosya_bs', concepto: 'Pedidos Ya Efectivo', cat: 'Delivery', mon: 'BS' },
      { key: 'divisas_usd', concepto: 'Divisas', cat: 'Efectivo', mon: 'USD' },
      { key: 'cuentas_cobrar', concepto: 'Cuentas Por Cobrar', cat: 'Por Cobrar', mon: 'USD' },
    ]
    const rows = camposMap
      .filter(c => parseFloat(ingresos[c.key]) > 0)
      .map(c => ({ fecha, concepto: c.concepto, monto: parseFloat(ingresos[c.key]), moneda: c.mon, categoria: c.cat, notas: `Cierre ${fecha}` }))

    if (rows.length === 0) {
      showToast('No hay ingresos para guardar. Llena al menos un campo.', 3500)
      return
    }

    setSaving(true); setSavingMsg(SAVING_MSGS[0])
    const mi = setInterval(() => setSavingMsg(p => SAVING_MSGS[(SAVING_MSGS.indexOf(p)+1)%SAVING_MSGS.length]), 1500)
    try {
      if (supabase) {
        await deleteIngresosByFecha(fecha)
        await Promise.all(rows.map(r => insertIngreso(r)))
        const [g, i] = await Promise.all([fetchGastos(), fetchIngresos()])
        setDbGastos(g); setDbIngresos(i)
      }
      clearInterval(mi); setSaving(false); setIngDirty(false)
      showToast(`¡Guardado! ${rows.length} ingresos del ${fDate(fecha)}`, 3000)
      go('cierre')
    } catch {
      clearInterval(mi); setSaving(false)
      showToast('¡Ups! No pudimos guardar. Revisa tu conexion.', 5000)
    }
  }

  function intentarSalirIngresos() {
    if (!ingDirty) { go('cierre'); return }
    setConfirm({
      title: '¿Salir sin guardar?',
      msg: '¿Deseas salir sin guardar los cambios realizados?',
      yesLabel: 'Salir sin guardar',
      noLabel: 'Seguir editando',
      yesColor: T.rose,
      onYes: () => { setConfirm(null); setIngDirty(false); go('cierre') },
    })
  }

  function reabrirCaja() {
    const nueva = { ...data, cerrada: false }
    setData(nueva); guardarData(nueva)
    showToast('¡No pasa nada, Arcelia! Corrijamos los numeros juntos.', 3500)
  }

  // Cargar cierre de un dia pasado para editar
  function editarCierreHistorico(fecha, ingresosDelDia) {
    // Mapear ingresos de Supabase a los campos del formulario
    const campos = { bicentenario:'',bancaribe:'',banesco:'',bancamiga:'',pagos_dia:'',efectivo_bs:'',delivery:'',pedidosya_usd:'',pedidosya_bs:'',divisas_usd:'',cuentas_cobrar:'' }
    const mapeo = {
      'Bicentenario':'bicentenario','Bancaribe':'bancaribe','Banesco':'banesco',
      'Bancamiga':'bancamiga','Pagomovil':'pagos_dia','Efectivo Bolivares':'efectivo_bs',
      'Delivery':'delivery','Pedidos Ya Prepago':'pedidosya_usd','Pedidos Ya Efectivo':'pedidosya_bs',
      'Divisas':'divisas_usd','Cuentas Por Cobrar':'cuentas_cobrar','Cuentas Por Cobrar Usd':'cuentas_cobrar',
      'Cuentas Por Cobrar Bs':'cuentas_cobrar',
    }
    for (const ig of ingresosDelDia) {
      const key = mapeo[ig.concepto]
      if (key) campos[key] = String(ig.monto)
    }
    const nueva = { ...data, fecha, ingresos: campos, cerrada: false }
    setData(nueva); guardarData(nueva)
    setFechaCierre(fecha)
    setIngDirty(false)
    setHistItem(null)
    go('ingresos')
    showToast(`Editando cierre del ${fDate(fecha)}`, 3000)
  }

  async function borrarCierreHistorico(fecha) {
    setConfirm({
      title: '¿Borrar cierre del dia?',
      body: <p style={{fontSize:15,color:T.sub,textAlign:'center',lineHeight:1.6}}>
        ¿Estas segura de borrar el cierre del <strong style={{color:T.navy}}>{fDate(fecha)}</strong>? Los ingresos iran a la papelera por 15 dias. Los gastos NO se tocan.
      </p>,
      yesLabel: 'Mandar a la papelera',
      noLabel: 'No, dejarlo',
      yesColor: T.rose,
      onYes: async () => {
        if (supabase) {
          await softDeleteIngresosByFecha(fecha)
          const [g, i] = await Promise.all([fetchGastos(), fetchIngresos()])
          setDbGastos(g); setDbIngresos(i)
        }
        setConfirm(null); setHistItem(null)
        showToast('Cierre enviado a la papelera (15 dias)')
      },
    })
  }

  // ── Escanear factura como GASTO ───────────────────────────────────────────────
  async function escanearFactura(file) {
    if (!OPENROUTER_KEY) { showToast('Falta configurar VITE_OPENROUTER_KEY'); return }
    go('procesando'); setProgOCR(10)
    try {
      setProgOCR(40)
      const items = await procesarFotoComoGasto(file, data.tasa)
      setProgOCR(100)
      if (items.length > 0) {
        const mapped = items.map((item, i) => ({
          concepto: capitalizar(item.c),
          monto: String(redondear(item.m)),
          moneda: 'USD',
          bsOrig: item.bs && item.bs > 0 ? Math.round(item.bs) : null,
          categoria: 'insumos',
          tipo: 'gasto',
          id: Date.now() + i + Math.random(),
        }))
        setPendGastos(mapped); go('confirmarVoz')
        showToast(`${mapped.length} gasto(s) detectado(s)`)
      } else {
        showToast('No pude extraer gastos de la foto')
        go('nuevoGasto')
      }
    } catch (err) {
      console.error('Error escaneando factura:', err)
      const msg = err?.message || String(err)
      if (msg.includes('402')) showToast('Sin creditos en OpenRouter.')
      else if (msg.includes('401')) showToast('API key invalida.')
      else showToast(`Error: ${msg.slice(0, 60)}`)
      go('nuevoGasto')
    }
  }

  // ── OCR con IA (cierre de caja / ingresos) ─────────────────────────────────────
  async function procesarFoto(file) {
    if (!OPENROUTER_KEY) { showToast('Falta configurar VITE_OPENROUTER_KEY'); return }
    go('procesando'); setProgOCR(10)
    try {
      setProgOCR(40)
      const resultado = await procesarFotoConIA(file)
      setProgOCR(100)
      if (!resultado) { showToast('No pude leer la foto'); go('ingresos'); return }

      // Separar campos de ingresos del resultado
      const campos = {}
      const camposIngreso = ['bicentenario','bancaribe','banesco','bancamiga','pagos_dia','efectivo_bs','delivery','pedidosya_usd','pedidosya_bs','divisas_usd','cuentas_cobrar']
      for (const k of camposIngreso) {
        if (resultado[k] && resultado[k] > 0) campos[k] = resultado[k]
      }

      // Detectar fecha del cuaderno vs fecha seleccionada
      const fechaOCR = resultado.fecha || ''
      const fechaDiscrepancia = fechaOCR && fechaOCR !== fechaCierre

      setOcrRes({
        campos,
        tasa: resultado.tasa || 0,
        cierreTotal: resultado.cierre_total || 0,
        fechaDetectada: fechaOCR,
        fechaDiscrepancia,
      })
      go('validarOCR')
    } catch (err) {
      console.error('Error procesando foto:', err)
      const msg = err?.message || String(err)
      if (msg.includes('402') || msg.includes('credit'))
        showToast('Sin creditos en OpenRouter. Recarga tu cuenta.')
      else if (msg.includes('401'))
        showToast('API key invalida. Revisa VITE_OPENROUTER_KEY.')
      else
        showToast(`Error: ${msg.slice(0, 60)}`)
      go('ingresos')
    }
  }

  async function aplicarOCR(cerrar = false) {
    // Cargar valores del OCR en el formulario local
    const nuevos = { ...data.ingresos }
    for (const [k, v] of Object.entries(ocrRes.campos)) {
      if (v && parseFloat(v) > 0) nuevos[k] = String(parseFloat(v))
    }
    const tasaNueva = ocrRes.tasa > 50 ? ocrRes.tasa : data.tasa

    // Actualizar estado con los valores del OCR
    const nueva = { ...data, ingresos: nuevos, tasa: tasaNueva }
    setData(nueva); guardarData(nueva)
    setTasaTemp(String(tasaNueva))
    localStorage.setItem('CP_TASA', String(tasaNueva))
    setOcrRes(null)

    if (cerrar) {
      // Esperar a que React actualice data, luego cerrar
      // Llamamos cerrarCaja directamente con los datos frescos
      const fecha = fechaCierre || hoy()
      const camposMap = [
        { key: 'bicentenario', concepto: 'Bicentenario', cat: 'Bancos', mon: 'BS' },
        { key: 'bancaribe', concepto: 'Bancaribe', cat: 'Bancos', mon: 'BS' },
        { key: 'banesco', concepto: 'Banesco', cat: 'Bancos', mon: 'BS' },
        { key: 'bancamiga', concepto: 'Bancamiga', cat: 'Bancos', mon: 'BS' },
        { key: 'pagos_dia', concepto: 'Pagomovil', cat: 'Pagos Del Dia', mon: 'BS' },
        { key: 'efectivo_bs', concepto: 'Efectivo Bolivares', cat: 'Efectivo', mon: 'BS' },
        { key: 'delivery', concepto: 'Delivery', cat: 'Delivery', mon: 'BS' },
        { key: 'pedidosya_usd', concepto: 'Pedidos Ya Prepago', cat: 'Delivery', mon: 'USD' },
        { key: 'pedidosya_bs', concepto: 'Pedidos Ya Efectivo', cat: 'Delivery', mon: 'BS' },
        { key: 'divisas_usd', concepto: 'Divisas', cat: 'Efectivo', mon: 'USD' },
        { key: 'cuentas_cobrar', concepto: 'Cuentas Por Cobrar', cat: 'Por Cobrar', mon: 'USD' },
      ]
      const rows = camposMap
        .filter(c => parseFloat(nuevos[c.key]) > 0)
        .map(c => ({ fecha, concepto: c.concepto, monto: parseFloat(nuevos[c.key]), moneda: c.mon, categoria: c.cat, notas: `Cierre ${fecha}` }))

      if (rows.length === 0) {
        showToast('No se detectaron ingresos en la foto. Revisa manualmente.', 4000)
        go('ingresos')
        return
      }

      nueva.cerrada = true; nueva.fecha = fecha
      setData(nueva); guardarData(nueva)
      archivarData(nueva); setHistorial(cargarHistorial())

      setSaving(true); setSavingMsg(SAVING_MSGS[0])
      const mi = setInterval(() => setSavingMsg(p => SAVING_MSGS[(SAVING_MSGS.indexOf(p)+1)%SAVING_MSGS.length]), 1500)
      try {
        if (supabase) {
          await deleteIngresosByFecha(fecha)
          const results = await Promise.all(rows.map(r => insertIngreso(r)))
          const [g, i] = await Promise.all([fetchGastos(), fetchIngresos()])
          setDbGastos(g); setDbIngresos(i)
        }
        clearInterval(mi); setSaving(false)
        go('cierre')
        setConfetti(true); setTimeout(() => setConfetti(false), 3500)
        showToast(`¡Cierre aplicado! ${rows.length} ingresos guardados`)
      } catch {
        clearInterval(mi); setSaving(false)
        showToast('¡Ups! No pudimos guardar el cierre. Revisa tu conexion.', 5000)
      }
    } else {
      go('ingresos')
      showToast('Valores cargados en el formulario')
    }
  }

  // ── Voz ───────────────────────────────────────────────────────────────────────
  function iniciarVoz(campo) {
    if (!SR) { showToast('Este navegador no soporta dictado por voz. Usa Chrome.'); return }

    // Si ya escucha ese campo → detener
    if (campoVoz === campo) {
      if (srRef.current) { try { srRef.current.stop() } catch {} }
      setCampoVoz(null); setProcesandoVoz(false); return
    }
    if (srRef.current) { try { srRef.current.stop() } catch {} }

    // ── Modo CONTINUO para gastos múltiples ──────────────────────────────────
    if (campo === 'g:multiple') {
      const sr     = new SR()
      sr.lang      = 'es-VE'
      sr.continuous      = true
      sr.interimResults  = true  // live transcript

      let finalParts   = []
      let silenceTimer = null
      const SILENCE_MS = 5000

      const resetSilence = () => {
        clearTimeout(silenceTimer)
        silenceTimer = setTimeout(() => {
          try { sr.stop() } catch {}
        }, SILENCE_MS)
      }

      sr.onstart = () => {
        setCampoVoz(campo)
        setLiveTranscript('')
        setTranscriptFinal('')
        finalParts = []
        resetSilence()
      }

      sr.onresult = e => {
        resetSilence()
        let interim = ''
        for (let i = 0; i < e.results.length; i++) {
          const txt = e.results[i][0].transcript
          if (e.results[i].isFinal) {
            // Solo agregar si no está ya en finalParts
            if (!finalParts.includes(txt)) finalParts.push(txt)
          } else {
            interim += txt
          }
        }
        const full = finalParts.join(' ') + (interim ? ' ' + interim : '')
        setLiveTranscript(full.trim())
      }

      sr.onend = async () => {
        clearTimeout(silenceTimer)
        setCampoVoz(null)
        srRef.current = null
        const txt = finalParts.join(' ').trim()
        if (!txt) { setLiveTranscript(''); setProcesandoVoz(false); return }

        // Mostrar texto final 1.5s antes de procesar
        setTranscriptFinal(txt)
        setLiveTranscript('')
        await new Promise(r => setTimeout(r, 1500))

        setProcesandoVoz(true)
        setTranscriptFinal('')
        try {
          if (OPENROUTER_KEY) {
            const items = await procesarGastoConIA(txt, data.tasa)
            if (items.length > 0) {
              const mapped = items.map((item, i) => ({
                concepto: capitalizar(item.c),
                monto: String(redondear(item.m)),
                moneda: 'USD',
                bsOrig: item.bs && item.bs > 0 ? Math.round(item.bs) : null,
                categoria: 'insumos',
                id: Date.now() + i + Math.random(),
              }))
              setPendGastos(mapped); go('confirmarVoz')
              showToast(`${mapped.length} gasto(s) detectado(s)`)
            } else {
              showToast('La IA no pudo interpretar. ¡Intenta de nuevo!')
            }
          } else {
            const items = parsearVozMultiple(txt, data.tasa)
            if (items.length > 0) {
              setPendGastos(items); go('confirmarVoz')
              showToast(`${items.length} gasto(s) detectado(s)`)
            } else {
              showToast('No entendi. Intenta de nuevo.')
            }
          }
        } catch (err) {
          const msg = err?.message || String(err)
          console.error('Error procesando voz:', err)
          if (msg.includes('402') || msg.includes('credit'))
            showToast('Sin creditos en OpenRouter. Recarga tu cuenta.')
          else if (msg.includes('401') || msg.includes('auth'))
            showToast('API key invalida. Revisa VITE_OPENROUTER_KEY.')
          else if (msg.includes('429'))
            showToast('Demasiadas peticiones. Espera un momento.')
          else
            showToast(`Error: ${msg.slice(0, 80)}`)
        }
        setProcesandoVoz(false)
      }

      sr.onerror = (e) => {
        clearTimeout(silenceTimer)
        setCampoVoz(null)
        setProcesandoVoz(false)
        setLiveTranscript('')
        setTranscriptFinal('')
        srRef.current = null
        const errMap = {
          'not-allowed': 'Permiso de microfono denegado. Activa el microfono en ajustes.',
          'no-speech': 'No detecte voz. Intenta de nuevo.',
          'audio-capture': 'No se encontro microfono.',
          'network': 'Error de red. Verifica tu conexion.',
        }
        showToast(errMap[e.error] || `Error de voz: ${e.error}`)
        console.error('SpeechRecognition error:', e.error)
      }

      srRef.current = sr
      try {
        sr.start()
      } catch (err) {
        setCampoVoz(null)
        setProcesandoVoz(false)
        showToast('No se pudo iniciar el microfono')
        console.error('sr.start() failed:', err)
      }
      return
    }
  }

  function finalizarVoz() {
    if (srRef.current) { try { srRef.current.stop() } catch {} }
  }

  function cancelarVoz() {
    if (srRef.current) {
      srRef.current.onend = () => {}  // desactivar procesamiento
      try { srRef.current.stop() } catch {}
    }
    srRef.current = null
    setCampoVoz(null)
    setProcesandoVoz(false)
    setLiveTranscript('')
    setTranscriptFinal('')
    showToast('Dictado cancelado')
  }

  function iniciarVozSimple(campo) {
    if (!SR) { showToast('Este navegador no soporta dictado por voz. Usa Chrome.'); return }
    if (campoVoz === campo) {
      if (srRef.current) { try { srRef.current.stop() } catch {} }
      setCampoVoz(null); return
    }
    if (srRef.current) { try { srRef.current.stop() } catch {} }

    // ── Modo SIMPLE para campos individuales ─────────────────────────────────
    const sr = new SR(); sr.lang = 'es-VE'; sr.interimResults = false
    sr.onstart = () => setCampoVoz(campo)
    sr.onresult = e => {
      const txt = e.results[0][0].transcript
      if (campo.startsWith('ing:')) {
        const tokens = txt.toLowerCase().split(/\s+/)
        const numR   = extraerNumero(tokens)
        if (numR) setIngreso(campo.slice(4), String(numR.amount))
        showToast(`"${txt}"`)
      } else if (campo === 'g:monto') {
        const tokens = txt.toLowerCase().split(/\s+/)
        const numR   = extraerNumero(tokens)
        if (numR) setGasto(g => ({ ...g, monto: String(numR.amount) }))
        showToast(`"${txt}"`)
      } else if (campo === 'g:concepto') {
        setGasto(g => ({ ...g, concepto: txt })); showToast(`"${txt}"`)
      }
    }
    sr.onerror = (e) => {
      setCampoVoz(null)
      if (e.error !== 'no-speech') showToast(`Error: ${e.error}`)
    }
    sr.onend = () => setCampoVoz(null)
    srRef.current = sr
    try { sr.start() } catch { showToast('No se pudo iniciar el microfono') }
  }

  // ── WhatsApp ──────────────────────────────────────────────────────────────────
  function enviarResumen(d=data) {
    if (!d) return
    const t=d.tasa; const tu=totalUSD(d.ingresos,t); const tg=totalGastosUSD(d.gastos,t); const net=tu-tg
    const ing=d.ingresos
    let msg=`📊 *CIERRE ANDINO POP*\n📅 ${d.fecha}  ·  Tasa Bs ${t}\n\n*INGRESOS*\n`
    if(+ing.bicentenario) msg+=`  Bicentenario: ${fBS(ing.bicentenario)}\n`
    if(+ing.bancaribe)    msg+=`  Bancaribe: ${fBS(ing.bancaribe)}\n`
    if(+ing.banesco)      msg+=`  Banesco: ${fBS(ing.banesco)}\n`
    if(+ing.bancamiga)    msg+=`  Bancamiga: ${fBS(ing.bancamiga)}\n`
    if(+ing.pagos_dia)    msg+=`  Pagos del día: ${fBS(ing.pagos_dia)}\n`
    if(+ing.efectivo_bs)  msg+=`  Efectivo: ${fBS(ing.efectivo_bs)}\n`
    if(+ing.delivery)     msg+=`  Delivery: ${fBS(ing.delivery)}\n`
    if(+ing.pedidosya_usd)msg+=`  Pedidos Ya (USD): ${fUSD(ing.pedidosya_usd)}\n`
    if(+ing.pedidosya_bs) msg+=`  Pedidos Ya (Bs): ${fBS(ing.pedidosya_bs)}\n`
    if(+ing.divisas_usd)  msg+=`  Divisas: ${fUSD(ing.divisas_usd)}\n`
    msg+=`*Total: ${fUSD(tu)}*\n`
    if(+ing.cuentas_cobrar)msg+=`_(Por cobrar: ${fUSD(ing.cuentas_cobrar)})_\n`
    if(d.gastos.length){msg+=`\n*GASTOS*\n`;d.gastos.forEach(g=>{msg+=`  ${g.concepto}: ${g.moneda==='USD'?fUSD(g.monto):fBS(g.monto)}\n`});msg+=`*Total gastos: ${fUSD(tg)}*\n`}
    msg+=`\n✅ *NETO: ${fUSD(net)}* (${fBS(net*t)})\n_Cashipop · Cashipop_`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank')
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ── Auth: ultra-flexible, never blocks ──────────────────────────────────────
  const FRASES_AUTH = [
    'Verificando tus datos, un segundo mas, jefa...',
    'Preparando todo para ti...',
    'Ya casi entramos...',
  ]

  async function handleAuth() {
    setAuthError(''); setAuthLoading(true)

    try {
      // Intenta lo que el usuario pidio primero
      const { error } = authMode === 'login'
        ? await signIn(authEmail, authPass)
        : await signUp(authEmail, authPass)

      if (!error) { setAuthLoading(false); return } // exito

      const msg = (error.message || '').toLowerCase()

      // Si intento registrar y ya existe → login automatico
      if (authMode === 'register' && (msg.includes('already') || msg.includes('existe') || msg.includes('registered'))) {
        const { error: e2 } = await signIn(authEmail, authPass)
        if (!e2) { setAuthLoading(false); return }
        setAuthError('Esa cuenta ya existe. Verifica tu contrasena.')
        setAuthLoading(false); return
      }

      // Si intento login y no existe → registrar automatico
      if (authMode === 'login' && (msg.includes('invalid') || msg.includes('credentials') || msg.includes('not found'))) {
        const { error: e2 } = await signUp(authEmail, authPass)
        if (!e2) {
          setAuthError('Cuenta creada. Revisa tu correo si te pide confirmacion.')
          setAuthLoading(false); return
        }
      }

      // Rate limit → mensaje amigable, no bloquear
      if (msg.includes('rate') || msg.includes('429') || msg.includes('too many') || msg.includes('email rate')) {
        setAuthError('Dame un momentito, jefa. Intentemos en unos segundos.')
        setAuthLoading(false); return
      }

      // Cualquier otro error → mensaje suave
      if (msg.includes('password') && msg.includes('6')) {
        setAuthError('La contrasena necesita al menos 6 caracteres.')
      } else if (msg.includes('email')) {
        setAuthError('Revisa que el correo este bien escrito.')
      } else {
        setAuthError('Algo salio mal. Intenta de nuevo en un momento.')
      }
    } catch {
      setAuthError('Sin conexion. Verifica tu internet.')
    }
    setAuthLoading(false)
  }

  // ── Loading screen ─────────────────────────────────────────────────────────
  const fraseIdx = Math.floor(Date.now() / 3000) % FRASES_PODER.length

  if (user === undefined || !data) return (
    <div style={{minHeight:'100svh',background:T.bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20,padding:'40px 32px'}}>
      <div style={{width:60,height:60,borderRadius:18,background:T.brandGold,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <RefreshCw size={26} color='#fff' strokeWidth={1.75} style={{animation:'spin 1s linear infinite'}}/>
      </div>
      <p style={{fontSize:16,fontWeight:700,color:T.navy,textAlign:'center',lineHeight:1.5}}>{FRASES_PODER[fraseIdx]}</p>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // ── Login screen ───────────────────────────────────────────────────────────
  if (supabase && user === null) return (
    <div style={{minHeight:'100svh',background:T.bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 28px',gap:24}}>
      <div style={{textAlign:'center',marginBottom:8}}>
        <div style={{width:64,height:64,borderRadius:20,background:'linear-gradient(145deg,#3D2539,#5E405B)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',boxShadow:'0 8px 32px rgba(94,64,91,0.2)'}}>
          <DollarSign size={28} color={T.brandGold} strokeWidth={1.75}/>
        </div>
        <h1 style={{fontSize:26,fontWeight:900,color:T.navy,letterSpacing:'-.03em'}}>Cashipop</h1>
        <p style={{fontSize:14,color:T.sub,marginTop:6}}>Tu sistema de control financiero</p>
      </div>

      <Card style={{width:'100%',maxWidth:380,padding:28}}>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <p style={{fontSize:12,fontWeight:700,color:T.muted,letterSpacing:'.06em',marginBottom:6}}>CORREO</p>
            <input type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="arcelia@andinopop.com"
              onKeyDown={e=>e.key==='Enter'&&handleAuth()}
              style={{width:'100%',height:48,paddingLeft:14,fontSize:15,fontWeight:600,border:`1.5px solid ${T.border}`,borderRadius:14,outline:'none',color:T.navy,background:T.bg}}/>
          </div>
          <div>
            <p style={{fontSize:12,fontWeight:700,color:T.muted,letterSpacing:'.06em',marginBottom:6}}>CONTRASENA</p>
            <input type="password" value={authPass} onChange={e=>setAuthPass(e.target.value)} placeholder="Min. 6 caracteres"
              onKeyDown={e=>e.key==='Enter'&&handleAuth()}
              style={{width:'100%',height:48,paddingLeft:14,fontSize:15,fontWeight:600,border:`1.5px solid ${T.border}`,borderRadius:14,outline:'none',color:T.navy,background:T.bg}}/>
          </div>
          {authError && (
            <p style={{fontSize:13,fontWeight:600,textAlign:'center',lineHeight:1.4,
              color: authError.includes('creada') ? T.forest : T.sub,
              background: authError.includes('creada') ? T.forestLight : T.amberLight,
              padding:'10px 14px',borderRadius:12,
            }}>{authError}</p>
          )}
          <Btn onClick={handleAuth} bg={T.brandGold} color={T.brand} full style={{padding:'16px',fontSize:15,marginTop:4}}>
            {authLoading ? FRASES_AUTH[Math.floor(Date.now()/2000)%FRASES_AUTH.length] : 'Entrar'}
          </Btn>
        </div>
      </Card>

      <p style={{fontSize:12,color:T.muted,textAlign:'center',marginTop:8,lineHeight:1.5}}>
        Escribe tu correo y contrasena. Si no tienes cuenta, se crea automaticamente.
      </p>
    </div>
  )

  const tUSD = totalUSD(data.ingresos, data.tasa)
  const tGas = totalGastosUSD(data.gastos, data.tasa)
  const neto = tUSD - tGas
  const ing  = data.ingresos
  const cc   = n(ing.cuentas_cobrar)

  // ══════════════════════════════════════════════════════════
  // TASA
  // ══════════════════════════════════════════════════════════
  if (pantalla === 'tasa') return (
    <div style={{minHeight:'100svh',background:T.bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'32px 24px',gap:28}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:68,height:68,borderRadius:22,background:T.cobaltLight,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
          <DollarSign size={32} color={T.cobalt} strokeWidth={1.75}/>
        </div>
        <h1 style={{fontSize:27,fontWeight:800,color:T.navy,letterSpacing:'-.03em'}}>Dólar BCV hoy</h1>
        <p style={{fontSize:14,color:T.sub,marginTop:6}}>{bcvLoad?'Consultando...':'¿Es correcto el valor?'}</p>
      </div>

      <Card style={{width:'100%',maxWidth:380,padding:28}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <Label>TASA OFICIAL BCV</Label>
          <button onClick={refetchBCV} disabled={bcvLoad} style={{background:'none',border:'none',color:T.cobalt,cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontSize:13,fontWeight:600}}>
            <RefreshCw size={13} strokeWidth={1.75} style={{animation:bcvLoad?'spin 1s linear infinite':'none'}}/> Actualizar
          </button>
        </div>
        <div style={{position:'relative'}}>
          <span style={{position:'absolute',left:16,top:'50%',transform:'translateY(-50%)',fontSize:22,fontWeight:700,color:T.sub}}>Bs</span>
          <input type="number" inputMode="decimal" value={tasaTemp} onChange={e=>setTasaTemp(e.target.value)}
            style={{width:'100%',paddingLeft:54,paddingRight:16,height:74,fontSize:34,fontWeight:900,textAlign:'right',border:`2px solid ${T.cobalt}`,borderRadius:18,background:T.cobaltLight,color:T.navy,outline:'none',letterSpacing:'-.02em'}}/>
        </div>
        <p style={{fontSize:12,color:T.muted,textAlign:'center',marginTop:10,lineHeight:1.5}}>Cambia si la tasa de la calle es diferente</p>
      </Card>

      <Btn onClick={confirmarTasa} bg={T.forest} icon={CheckCircle} style={{padding:'17px 44px',fontSize:16,borderRadius:18,boxShadow:'0 5px 0 #1B4332'}}>
        Confirmar y entrar
      </Btn>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // ══════════════════════════════════════════════════════════
  // PROCESANDO
  // ══════════════════════════════════════════════════════════
  if (pantalla === 'procesando') return (
    <div style={{minHeight:'100svh',background:T.bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:22,padding:32}}>
      <div style={{width:68,height:68,borderRadius:20,background:T.cobaltLight,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <Zap size={32} color={T.cobalt} strokeWidth={1.75} style={{animation:'spin 2s linear infinite'}}/>
      </div>
      <div style={{textAlign:'center'}}>
        <h2 style={{fontSize:19,fontWeight:700,color:T.navy}}>Analizando la libreta</h2>
        <p style={{fontSize:13,color:T.sub,marginTop:4}}>La IA esta leyendo los valores...</p>
      </div>
      <div style={{width:'70%',maxWidth:260,height:5,background:T.border,borderRadius:5,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${progOCR}%`,background:T.cobalt,borderRadius:5,transition:'width .3s'}}/>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // ══════════════════════════════════════════════════════════
  // VALIDAR OCR
  // ══════════════════════════════════════════════════════════
  if (pantalla === 'validarOCR' && ocrRes) {
    const { campos, tasa: tasaDetectada, cierreTotal, fechaDetectada, fechaDiscrepancia } = ocrRes
    const tieneData = Object.keys(campos).length > 0
    const labels = {
      bicentenario:'Bicentenario', bancaribe:'Bancaribe', banesco:'Banesco',
      bancamiga:'Bancamiga', pagos_dia:'Pagos del dia', efectivo_bs:'Efectivo',
      delivery:'Delivery', pedidosya_usd:'Pedidos Ya USD', pedidosya_bs:'Pedidos Ya Bs',
      divisas_usd:'Divisas', cuentas_cobrar:'Por cobrar',
    }
    const esUSD = k => ['pedidosya_usd','divisas_usd','cuentas_cobrar'].includes(k)

    // Calcular total detectado en USD
    const tasaCalc = tasaDetectada > 50 ? tasaDetectada : data.tasa
    const tasaDifiere = tasaDetectada > 50 && Math.abs(tasaDetectada - data.tasa) > 0.5
    let sumaDetectada = 0
    for (const [k, v] of Object.entries(campos)) {
      if (k === 'cuentas_cobrar') continue
      sumaDetectada += esUSD(k) ? v : v / tasaCalc
    }
    sumaDetectada = redondear(sumaDetectada)
    const diffRedondeo = cierreTotal > 0 ? redondear(cierreTotal - sumaDetectada) : 0
    const coincide = cierreTotal > 0 && Math.abs(diffRedondeo) < 0.01
    const necesitaAjuste = cierreTotal > 0 && !coincide && Math.abs(diffRedondeo) < 50

    return (
      <div style={{minHeight:'100svh',background:T.bg,padding:'32px 20px 100px',overflowY:'auto'}}>
        <InnerHeader title="Validar cierre" onBack={()=>{setOcrRes(null);go('ingresos')}}/>
        <p style={{fontSize:14,color:T.sub,marginBottom:16}}>Revisa los valores que detecte en la libreta</p>

        {/* Alerta de fecha diferente */}
        {fechaDiscrepancia && (
          <Card style={{marginBottom:12,background:'#FFF0EB',border:`1px solid ${T.rose}22`,padding:'16px 18px'}}>
            <p style={{fontSize:13,fontWeight:700,color:T.rose,marginBottom:6}}>La fecha del cuaderno no coincide</p>
            <p style={{fontSize:12,color:T.sub,lineHeight:1.5}}>Cuaderno: <strong style={{color:T.navy}}>{fDate(fechaDetectada)}</strong> · Seleccionada: <strong style={{color:T.navy}}>{fDate(fechaCierre)}</strong></p>
            <Btn onClick={()=>{setFechaCierre(fechaDetectada);setOcrRes({...ocrRes,fechaDiscrepancia:false});showToast(`Fecha cambiada a ${fDate(fechaDetectada)}`)}} bg={T.rose} style={{marginTop:10,padding:'10px 14px',fontSize:12}} icon={Calendar}>
              Usar fecha del cuaderno
            </Btn>
          </Card>
        )}

        {/* Tasa detectada + alerta si difiere */}
        {tasaDetectada > 0 && (
          <Card style={{marginBottom:12,background:tasaDifiere?T.amberLight:T.cobaltLight,border:`1px solid ${tasaDifiere?T.amber:T.cobalt}22`,padding:'16px 20px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <DollarSign size={16} color={tasaDifiere?T.amber:T.cobalt} strokeWidth={1.75}/>
                <span style={{fontSize:14,fontWeight:700,color:tasaDifiere?T.amber:T.cobalt}}>Tasa detectada</span>
              </div>
              <span style={{fontSize:22,fontWeight:900,color:T.navy}}>Bs {tasaDetectada}</span>
            </div>
            {tasaDifiere && (
              <div style={{marginTop:10}}>
                <p style={{fontSize:12,color:T.sub,marginBottom:8}}>La tasa del sistema es Bs {data.tasa}. ¿Deseas usar la tasa de la libreta para este cierre?</p>
                <Btn onClick={()=>{applyTasa(tasaDetectada);showToast(`¡Tasa actualizada a Bs ${tasaDetectada}!`)}} bg={T.amber} style={{padding:'9px 14px',fontSize:12}} icon={CheckCircle}>
                  Usar Bs {tasaDetectada}
                </Btn>
              </div>
            )}
          </Card>
        )}

        {tieneData ? (
          <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:20}}>
            {Object.entries(campos).map(([k, v]) => (
              <Card key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 20px'}}>
                <span style={{fontSize:14,fontWeight:600,color:T.sub}}>{labels[k] || k}</span>
                <span style={{fontSize:18,fontWeight:800,color:T.navy}}>{esUSD(k) ? fUSD(v) : fBS(v)}</span>
              </Card>
            ))}
          </div>
        ) : (
          <Card style={{background:T.amberLight,marginBottom:20}}>
            <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
              <AlertCircle size={18} color={T.amber} strokeWidth={1.75}/>
              <div>
                <p style={{fontSize:14,fontWeight:700,color:T.amber}}>No reconoci valores claros</p>
                <p style={{fontSize:13,color:T.sub,marginTop:4}}>Entra los valores a mano</p>
              </div>
            </div>
          </Card>
        )}

        {/* Ajuste por redondeo (si hay diferencia pequeña) */}
        {necesitaAjuste && (
          <Card style={{marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 20px',background:'#FEF7EC',border:`1px solid ${T.amber}22`}}>
            <div>
              <span style={{fontSize:13,fontWeight:600,color:T.amber}}>Ajuste por redondeo</span>
              <p style={{fontSize:11,color:T.muted,marginTop:2}}>Diferencia por conversion de tasa</p>
            </div>
            <span style={{fontSize:16,fontWeight:800,color:T.amber}}>{diffRedondeo > 0 ? '+' : ''}{fUSD(diffRedondeo)}</span>
          </Card>
        )}

        {/* Verificacion de total */}
        {cierreTotal > 0 && (
          <Card style={{
            marginBottom:20,
            background: (coincide || necesitaAjuste) ? T.forestLight : T.amberLight,
            border: `1px solid ${(coincide || necesitaAjuste) ? T.forest : T.amber}22`,
          }}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <p style={{fontSize:12,fontWeight:700,color:(coincide||necesitaAjuste)?T.forest:T.amber,letterSpacing:'.06em'}}>
                  {(coincide || necesitaAjuste) ? 'TOTAL VERIFICADO' : 'DIFERENCIA GRANDE'}
                </p>
                <p style={{fontSize:13,color:T.sub,marginTop:4}}>
                  Suma: {fUSD(sumaDetectada)}{necesitaAjuste?` + ajuste ${fUSD(diffRedondeo)}`:''}
                </p>
              </div>
              <div style={{textAlign:'right'}}>
                <p style={{fontSize:11,color:T.muted}}>Total libreta</p>
                <p style={{fontSize:20,fontWeight:900,color:(coincide||necesitaAjuste)?T.forest:T.amber}}>{fUSD(cierreTotal)}</p>
              </div>
            </div>
            {(coincide || necesitaAjuste) && (
              <div style={{display:'flex',alignItems:'center',gap:6,marginTop:12}}>
                <CheckCircle size={14} color={T.forest} strokeWidth={1.75}/>
                <span style={{fontSize:12,fontWeight:600,color:T.forest}}>
                  {coincide ? '¡Los numeros coinciden!' : '¡Ajuste aplicado automaticamente!'}
                </span>
              </div>
            )}
          </Card>
        )}

        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {tieneData && (
            <Btn onClick={()=>aplicarOCR(true)} bg={T.forest} full icon={Lock} style={{padding:'16px',fontSize:15}}>
              Confirmar Cierre
            </Btn>
          )}
          {tieneData && (
            <Btn onClick={()=>aplicarOCR(false)} bg={T.cobalt} full icon={CheckCircle} style={{padding:'14px',fontSize:13}}>
              Solo cargar valores (sin cerrar)
            </Btn>
          )}
          <Btn onClick={()=>{setOcrRes(null);go('ingresos')}} bg={T.border} color={T.navy} full icon={Edit3} style={{padding:'14px',fontSize:13}}>
            Descartar y editar a mano
          </Btn>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════
  // CONFIRMAR VOZ MÚLTIPLE
  // ══════════════════════════════════════════════════════════
  function editPendField(idx, campo, valor) {
    setPendGastos(prev => prev.map((g, i) => {
      if (i !== idx) return g
      if (campo === 'concepto') return { ...g, concepto: valor }
      if (campo === 'usd') {
        const usd = redondear(parseFloat(valor) || 0)
        return { ...g, monto: String(usd), bsOrig: usd > 0 ? Math.round(usd * data.tasa) : null }
      }
      if (campo === 'bs') {
        const bsVal = parseFloat(valor) || 0
        return { ...g, bsOrig: Math.round(bsVal), monto: String(redondear(bsVal / data.tasa)) }
      }
      return g
    }))
  }

  function deletePendGasto(idx) {
    const g = pendGastos[idx]
    setConfirm({
      title: '¿Borrar este gasto?',
      body: <p style={{fontSize:15,color:T.sub,textAlign:'center',lineHeight:1.6}}>
        ¿Quieres quitar <strong style={{color:T.brand}}>{g.concepto}</strong> por <strong style={{color:T.rose}}>{fUSD(g.monto)}</strong>?
      </p>,
      yesLabel: 'Si, borrarlo',
      noLabel: 'No, dejarlo',
      yesColor: T.rose,
      onYes: () => {
        setPendGastos(prev => prev.filter((_, j) => j !== idx))
        setConfirm(null)
        setEditingIdx(null)
        showToast('Gasto eliminado de la lista')
      },
    })
  }

  if (pantalla === 'confirmarVoz') {
    // Si se borraron todos
    if (pendGastos.length === 0) { go('nuevoGasto'); return null }

    return (
    <div style={{minHeight:'100svh',background:T.bg,padding:'32px 20px 100px',overflowY:'auto'}}>
      <InnerHeader title="Confirmar gastos" onBack={()=>{setPendGastos([]);setEditingIdx(null);go('nuevoGasto')}}/>
      <p style={{fontSize:14,color:T.sub,marginBottom:22}}>Revisa cada gasto antes de guardar</p>

      <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:28}}>
        {pendGastos.map((g, i) => {
          const isEditing = editingIdx === i
          return (
          <Card key={i} style={{padding:'18px 20px',border:isEditing?`2px solid ${T.brandGold}`:`1px solid ${T.border}`,transition:'border .2s'}}>

            {/* Header: concepto + acciones */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:isEditing?14:0}}>
              {isEditing ? (
                <input type="text" value={g.concepto}
                  onChange={e => editPendField(i, 'concepto', e.target.value)}
                  onBlur={() => editPendField(i, 'concepto', formatConcept(g.concepto))}
                  style={{flex:1,fontSize:16,fontWeight:700,color:T.brand,border:`1.5px solid ${T.brandGold}`,borderRadius:10,padding:'8px 12px',outline:'none',background:'#FFF9F0',marginRight:10}}
                />
              ) : (
                <p style={{fontSize:16,fontWeight:800,color:T.brand,flex:1}}>{g.concepto}</p>
              )}

              <div style={{display:'flex',gap:6,flexShrink:0,marginTop:2}}>
                <button onClick={()=>setEditingIdx(isEditing?null:i)} style={{width:32,height:32,borderRadius:9,border:`1px solid ${T.border}`,background:isEditing?T.brandGold+'20':T.surface,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',WebkitTapHighlightColor:'transparent'}}>
                  <Edit3 size={14} color={isEditing?T.brandGold:T.muted} strokeWidth={1.75}/>
                </button>
                <button onClick={()=>deletePendGasto(i)} style={{width:32,height:32,borderRadius:9,border:`1px solid ${T.border}`,background:T.surface,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',WebkitTapHighlightColor:'transparent'}}>
                  <Trash2 size={14} color={T.rose} strokeWidth={1.75}/>
                </button>
              </div>
            </div>

            {/* Montos */}
            {isEditing ? (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div>
                  <p style={{fontSize:10,fontWeight:700,color:T.cobalt,letterSpacing:'.06em',marginBottom:6}}>DOLARES</p>
                  <div style={{position:'relative'}}>
                    <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:15,fontWeight:700,color:T.cobalt}}>$</span>
                    <input type="number" inputMode="decimal" value={g.monto}
                      onChange={e => editPendField(i, 'usd', e.target.value)}
                      style={{width:'100%',paddingLeft:30,paddingRight:10,height:46,fontSize:18,fontWeight:800,border:`1.5px solid ${T.brandGold}`,borderRadius:12,background:T.cobaltLight,color:T.navy,outline:'none'}}
                    />
                  </div>
                </div>
                <div>
                  <p style={{fontSize:10,fontWeight:700,color:T.amber,letterSpacing:'.06em',marginBottom:6}}>BOLIVARES</p>
                  <div style={{position:'relative'}}>
                    <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',fontSize:14,fontWeight:700,color:T.amber}}>Bs</span>
                    <input type="number" inputMode="decimal"
                      value={g.bsOrig != null && g.bsOrig > 0 ? g.bsOrig : ''}
                      placeholder={String(Math.round(n(g.monto) * data.tasa))}
                      onChange={e => editPendField(i, 'bs', e.target.value)}
                      style={{width:'100%',paddingLeft:34,paddingRight:10,height:46,fontSize:18,fontWeight:800,border:`1.5px solid ${T.brandGold}`,borderRadius:12,background:T.amberLight,color:T.navy,outline:'none'}}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:6}}>
                <span style={{fontSize:22,fontWeight:900,color:T.cobalt}}>{fUSD(g.monto)}</span>
                {g.bsOrig != null && g.bsOrig > 0 && (
                  <span style={{fontSize:13,color:T.muted,fontWeight:600}}>{fBS(g.bsOrig)}</span>
                )}
              </div>
            )}
          </Card>
          )
        })}
      </div>

      <Btn onClick={()=>{setEditingIdx(null);commitPendGastos()}} bg={T.forest} full icon={CheckCircle} style={{padding:'18px',fontSize:16,marginBottom:10}}>
        Guardar todo
      </Btn>
      <Btn onClick={()=>{setPendGastos([]);setEditingIdx(null);go('nuevoGasto')}} bg={T.border} color={T.navy} full icon={X} style={{padding:'14px',fontSize:13,boxShadow:'none'}}>
        Descartar
      </Btn>
      <Confirm title={confirm?.title} msg={confirm?.msg} onYes={confirm?.onYes} onNo={()=>setConfirm(null)} yesLabel={confirm?.yesLabel} noLabel={confirm?.noLabel} yesColor={confirm?.yesColor}>{confirm?.body}</Confirm>
    </div>
    )
  }

  // ══════════════════════════════════════════════════════════
  // INGRESOS (pantalla interior, no en nav)
  // ══════════════════════════════════════════════════════════
  if (pantalla === 'ingresos') {
    const mic=c=>campoVoz===`ing:${c}`
    const row=(campo,label,Icon,moneda='BS',dimmed=false)=>(
      <CampoMonto label={label} value={ing[campo]} onChange={v=>setIngreso(campo,v)} moneda={moneda} icon={Icon} micActive={mic(campo)} onMic={()=>iniciarVozSimple(`ing:${campo}`)} dimmed={dimmed}/>
    )
    return (
      <div style={{minHeight:'100svh',background:T.bg,padding:'32px 20px 120px',overflowY:'auto'}}>
        <InnerHeader title={`Ingresos — ${fDate(fechaCierre)}`} onBack={intentarSalirIngresos}/>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18,marginTop:-10}}>
          <p style={{fontSize:12,color:T.muted}}>Tasa Bs {data.tasa}</p>
          <div style={{textAlign:'right'}}>
            <p style={{fontSize:10,color:T.muted,fontWeight:700,letterSpacing:'.08em'}}>TOTAL</p>
            <p style={{fontSize:20,fontWeight:900,color:T.forest,letterSpacing:'-.02em'}}>{fUSD(tUSD)}</p>
          </div>
        </div>

        {/* OCR */}
        <Card onClick={()=>fileRef.current?.click()} style={{marginBottom:24,background:`linear-gradient(135deg,#3D2539,${T.brand})`,border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:14,padding:'18px 20px',borderRadius:24}}>
          <div style={{width:46,height:46,borderRadius:13,background:'rgba(255,255,255,0.14)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <Camera size={22} color='#fff' strokeWidth={1.75}/>
          </div>
          <div>
            <p style={{fontSize:14,fontWeight:700,color:'#fff'}}>Subir foto del cuaderno</p>
            <p style={{fontSize:12,color:'rgba(255,255,255,0.6)',marginTop:2}}>Extraigo los valores automáticamente</p>
          </div>
          <ChevronRight size={16} color='rgba(255,255,255,0.4)' style={{marginLeft:'auto'}}/>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={e=>{if(e.target.files[0])procesarFoto(e.target.files[0]);e.target.value=''}}/>
        </Card>

        <Label>BANCOS</Label>
        <Card style={{marginBottom:16}}>
          {row('bicentenario','Bicentenario',Landmark)}
          <Sep/>{row('bancaribe','Bancaribe',Landmark)}
          <Sep/>{row('banesco','Banesco',Landmark)}
          <Sep/>{row('bancamiga','Bancamiga',Landmark)}
          <Sep/>{row('pagos_dia','Pagos del día',CreditCard)}
        </Card>

        <Label>EFECTIVO Y DELIVERY</Label>
        <Card style={{marginBottom:16}}>
          {row('efectivo_bs','Efectivo Bolívares',Banknote,'BS')}
          <Sep/>{row('delivery','Delivery',Bike,'BS')}
        </Card>

        <Label>PEDIDOS YA</Label>
        <Card style={{marginBottom:16}}>
          {row('pedidosya_usd','Prepago (USD)',Package,'USD')}
          <Sep/>{row('pedidosya_bs','Efectivo (Bs)',Bike,'BS')}
        </Card>

        <Label>DIVISAS</Label>
        <Card style={{marginBottom:16}}>
          {row('divisas_usd','Divisas',DollarSign,'USD')}
        </Card>

        <Label>CUENTAS POR COBRAR</Label>
        <Card style={{marginBottom:8}}>
          {row('cuentas_cobrar','Por cobrar — no suma',AlertCircle,'USD',true)}
        </Card>
        <p style={{fontSize:12,color:T.muted,marginBottom:20,paddingLeft:4,lineHeight:1.5}}>Registrado pero no incluido en el total del dia.</p>

        {/* Boton fijo de guardar */}
        <div style={{position:'fixed',bottom:0,left:0,right:0,padding:'16px 20px',background:T.bg,borderTop:`1px solid ${T.border}`,zIndex:150}}>
          <Btn onClick={guardarIngresosManual} bg={T.forest} full icon={CheckCircle} style={{padding:'16px',fontSize:16}}>
            ¡Guardar cambios!
          </Btn>
        </div>
        <Confirm title={confirm?.title} msg={confirm?.msg} onYes={confirm?.onYes} onNo={()=>setConfirm(null)} yesLabel={confirm?.yesLabel} noLabel={confirm?.noLabel} yesColor={confirm?.yesColor}>{confirm?.body}</Confirm>
        <SavingOverlay active={saving} msg={savingMsg}/>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════
  // NUEVO GASTO (pantalla interior)
  // ══════════════════════════════════════════════════════════
  if (pantalla === 'nuevoGasto') return (
    <div style={{minHeight:'100svh',background:T.bg,padding:'32px 20px 40px',overflowY:'auto'}}>
      <InnerHeader title="Nuevo Gasto" onBack={()=>go('gastos')}/>

      {/* Dictado múltiple */}
      <Card style={{marginBottom:20,background:campoVoz==='g:multiple'?'#3D2539':procesandoVoz?T.cobaltLight:transcriptFinal?T.forestLight:T.cobaltLight,border:`1px solid ${campoVoz==='g:multiple'?'rgba(255,255,255,0.1)':T.cobalt}22`,transition:'all .3s'}}>

        {/* ── Estado: Grabando ── */}
        {campoVoz === 'g:multiple' ? (
          <>
            {/* Ondas de audio */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:3,height:40,marginBottom:16}}>
              {[0,1,2,3,4,5,6].map(i => (
                <div key={i} style={{width:4,borderRadius:2,background:'#FFB752',animation:`wave .8s ${i*0.1}s ease-in-out infinite alternate`}}/>
              ))}
            </div>

            {/* Live transcript */}
            <p style={{fontSize:liveTranscript.length>60?16:20,fontWeight:700,color:'#fff',textAlign:'center',minHeight:60,lineHeight:1.4,marginBottom:16,wordBreak:'break-word'}}>
              {liveTranscript || 'Escuchando...'}
            </p>

            <p style={{fontSize:11,color:'rgba(255,255,255,0.4)',textAlign:'center',marginBottom:16}}>5 segundos de silencio para enviar automaticamente</p>

            {/* Botones: Listo + Cancelar */}
            <div style={{display:'flex',gap:8}}>
              <button onClick={cancelarVoz} style={{flex:1,padding:'14px',borderRadius:14,border:'1px solid rgba(255,255,255,0.15)',background:'transparent',fontSize:13,fontWeight:700,color:'rgba(255,255,255,0.5)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                <X size={15} strokeWidth={1.75}/>Cancelar
              </button>
              <button onClick={finalizarVoz} style={{flex:2,padding:'14px',borderRadius:14,border:'none',background:T.forest,fontSize:14,fontWeight:800,color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:'0 4px 0 #1B4332'}}>
                <Zap size={16} strokeWidth={1.75}/>Listo, procesar
              </button>
            </div>
          </>

        /* ── Estado: Mostrando texto final antes de IA ── */
        ) : transcriptFinal ? (
          <>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
              <CheckCircle size={16} color={T.forest} strokeWidth={1.75}/>
              <p style={{fontSize:12,fontWeight:700,color:T.forest,letterSpacing:'.06em'}}>TEXTO CAPTURADO</p>
            </div>
            <p style={{fontSize:17,fontWeight:700,color:T.navy,lineHeight:1.5,marginBottom:8}}>{transcriptFinal}</p>
            <p style={{fontSize:12,color:T.muted}}>Enviando a la IA...</p>
          </>

        /* ── Estado: Procesando con IA ── */
        ) : procesandoVoz ? (
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12,padding:'16px 0'}}>
            <RefreshCw size={24} color={T.cobalt} strokeWidth={1.75} style={{animation:'spin 1s linear infinite'}}/>
            <p style={{fontSize:15,fontWeight:700,color:T.cobalt}}>Procesando con IA...</p>
            <p style={{fontSize:12,color:T.muted}}>Extrayendo gastos del dictado</p>
          </div>

        /* ── Estado: Reposo ── */
        ) : (
          <>
            <Label>CARGA RAPIDA</Label>
            <p style={{fontSize:13,color:T.sub,marginBottom:14,lineHeight:1.5}}>
              Dicta o escanea y la IA extrae los gastos
            </p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
              <Btn onClick={()=>iniciarVoz('g:multiple')} bg={T.cobalt} full icon={Mic} style={{fontSize:11,padding:'14px 8px'}}>
                Dictar
              </Btn>
              <Btn onClick={()=>gastoFileRef.current?.click()} bg={T.navy} full icon={Camera} style={{fontSize:11,padding:'14px 8px'}}>
                Camara
              </Btn>
              <Btn onClick={()=>gastoGalRef.current?.click()} bg={T.sub} full icon={Package} style={{fontSize:11,padding:'14px 8px'}}>
                Galeria
              </Btn>
            </div>
            <input ref={gastoFileRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={e=>{if(e.target.files[0])escanearFactura(e.target.files[0]);e.target.value=''}}/>
            <input ref={gastoGalRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>{if(e.target.files[0])escanearFactura(e.target.files[0]);e.target.value=''}}/>
          </>
        )}

        <style>{`
          @keyframes wave{0%{height:6px}100%{height:28px}}
          @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        `}</style>
      </Card>

      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
        <div style={{flex:1,height:1,background:T.border}}/>
        <span style={{fontSize:11,color:T.muted,fontWeight:600}}>O uno a la vez</span>
        <div style={{flex:1,height:1,background:T.border}}/>
      </div>

      <Label>CATEGORÍA</Label>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:20}}>
        {CATS.map(cat=>{const active=gasto.categoria===cat.id;return(
          <button key={cat.id} onClick={()=>setGasto(g=>({...g,categoria:cat.id}))} style={{padding:'13px',borderRadius:14,border:`1.5px solid ${active?cat.c:T.border}`,background:active?`${cat.c}10`:T.surface,cursor:'pointer',fontSize:13,fontWeight:700,color:active?cat.c:T.sub,WebkitTapHighlightColor:'transparent'}}>
            {cat.label}
          </button>
        )})}
      </div>

      <Label>CONCEPTO</Label>
      <Card style={{marginBottom:16}}>
        <div style={{display:'flex',gap:8}}>
          <input type="text" value={gasto.concepto} onChange={e=>setGasto(g=>({...g,concepto:e.target.value}))} placeholder="ej: Queso Omar, Harina PAN..."
            style={{flex:1,height:48,paddingLeft:14,fontSize:15,fontWeight:600,border:`1.5px solid ${T.border}`,borderRadius:12,outline:'none',color:T.navy,background:T.bg}}/>
          <button onClick={()=>iniciarVozSimple('g:concepto')} style={{width:48,height:48,borderRadius:12,border:'none',flexShrink:0,background:campoVoz==='g:concepto'?T.roseLight:T.cobaltLight,color:campoVoz==='g:concepto'?T.rose:T.cobalt,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',WebkitTapHighlightColor:'transparent'}}>
            {campoVoz==='g:concepto'?<MicOff size={17} strokeWidth={1.75}/>:<Mic size={17} strokeWidth={1.75}/>}
          </button>
        </div>
      </Card>

      <Label>MONEDA</Label>
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        {['BS','USD'].map(m=>(
          <button key={m} onClick={()=>setGasto(g=>({...g,moneda:m}))} style={{flex:1,padding:'12px',borderRadius:12,border:`1.5px solid ${gasto.moneda===m?T.cobalt:T.border}`,background:gasto.moneda===m?T.cobaltLight:T.surface,cursor:'pointer',fontSize:14,fontWeight:700,color:gasto.moneda===m?T.cobalt:T.sub,WebkitTapHighlightColor:'transparent'}}>
            {m==='USD'?'$ Dólares':'Bs Bolívares'}
          </button>
        ))}
      </div>

      <Label>MONTO</Label>
      <Card style={{marginBottom:28}}>
        <CampoMonto label={gasto.moneda==='USD'?'Dólares':'Bolívares'} value={gasto.monto} onChange={v=>setGasto(g=>({...g,monto:v}))} moneda={gasto.moneda} micActive={campoVoz==='g:monto'} onMic={()=>iniciarVozSimple('g:monto')} icon={Banknote}/>
      </Card>

      <Btn onClick={()=>agregarGasto(false)} bg={T.forest} full icon={CheckCircle} style={{padding:'16px',fontSize:15}}>Guardar Gasto</Btn>
      <Confirm title={confirm?.title} msg={confirm?.msg} onYes={confirm?.onYes} onNo={()=>setConfirm(null)} yesLabel={confirm?.yesLabel} noLabel={confirm?.noLabel} yesColor={confirm?.yesColor}>{confirm?.body}</Confirm>
      <Toast msg={toast}/>
    </div>
  )

  // ══════════════════════════════════════════════════════════
  // HOME
  // ══════════════════════════════════════════════════════════
  if (pantalla === 'home') return (
    <div style={{minHeight:'100svh',background:T.bg,padding:'52px 20px 96px',overflowY:'auto'}}>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:28}}>
        <div>
          <p style={{fontSize:12,color:T.muted,fontWeight:600,letterSpacing:'.04em'}}>{fDate(data.fecha).toUpperCase()}</p>
          <h1 style={{fontSize:25,fontWeight:900,color:T.navy,letterSpacing:'-.03em',lineHeight:1.15,marginTop:3}}>Cashipop</h1>
        </div>
        {/* Acciones terciarias: WA + Tasa */}
        <div style={{display:'flex',alignItems:'center',gap:8,marginTop:2}}>
          <WaBtn onClick={()=>enviarResumen()}/>
          <div style={{display:'flex',alignItems:'center',gap:5,background:T.amberLight,border:`1px solid ${T.brandGold}33`,borderRadius:13,padding:'6px 10px'}}>
            {tasaEditing ? (
              <>
                <span style={{fontSize:10,fontWeight:700,color:T.brand}}>Bs</span>
                <input type="text" inputMode="decimal" value={tasaTemp}
                  onChange={e => onTasaChange(e.target.value)}
                  onBlur={() => setTasaEditing(false)}
                  onKeyDown={e => e.key === 'Enter' && setTasaEditing(false)}
                  autoFocus
                  style={{width:68,height:28,fontSize:17,fontWeight:900,color:T.brand,background:'transparent',border:'none',borderBottom:`2px solid ${T.brandGold}`,borderRadius:0,padding:0,outline:'none',textAlign:'right'}}
                />
              </>
            ) : (
              <>
                <button onClick={startTasaEdit} style={{background:'none',border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:1,WebkitTapHighlightColor:'transparent',padding:0}}>
                  <span style={{fontSize:9,fontWeight:700,color:T.brand,letterSpacing:'.08em'}}>TASA</span>
                  <span style={{fontSize:17,fontWeight:900,color:T.brand,letterSpacing:'-.02em'}}>
                    {bcvLoad ? 'Buscando...' : `Bs ${data.tasa}`}
                  </span>
                </button>
                <button onClick={refetchBCV} disabled={bcvLoad} style={{width:26,height:26,borderRadius:7,border:'none',background:'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',WebkitTapHighlightColor:'transparent',opacity:bcvLoad?.5:1}}>
                  <RefreshCw size={13} color={T.brand} strokeWidth={1.75} style={{animation:bcvLoad?'spin 1s linear infinite':'none'}}/>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tarjeta neto — gradiente oscuro */}
      <div style={{background:'linear-gradient(145deg,#3D2539,#5E405B)',borderRadius:32,padding:'30px 26px',marginBottom:16,boxShadow:'0 16px 48px rgba(0,0,0,0.18)'}}>
        <p style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.4)',letterSpacing:'.1em'}}>NETO DEL DÍA</p>
        <p style={{fontSize:42,fontWeight:900,color:'#fff',letterSpacing:'-.035em',lineHeight:1,marginTop:8}}>{fUSD(neto)}</p>
        <p style={{fontSize:13,color:'rgba(255,255,255,0.3)',marginTop:7}}>{fBS(neto*data.tasa)}</p>
        {cc>0&&<p style={{fontSize:12,color:'#FFB752',marginTop:6}}>+ {fUSD(cc)} pendiente por cobrar</p>}
      </div>

      {/* Mini cards ingresos / gastos */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:20}}>
        <Card style={{background:T.forestLight,border:`1px solid ${T.forest}22`,padding:'18px'}}>
          <TrendingUp size={16} color={T.forest} strokeWidth={1.75}/>
          <p style={{fontSize:10,fontWeight:700,color:T.forest,marginTop:8,letterSpacing:'.06em'}}>INGRESOS DE HOY</p>
          <p style={{fontSize:19,fontWeight:900,color:T.navy,marginTop:3,letterSpacing:'-.02em'}}>{fUSD(tUSD)}</p>
        </Card>
        <Card style={{background:T.roseLight,border:`1px solid ${T.rose}22`,padding:'18px'}}>
          <TrendingDown size={16} color={T.rose} strokeWidth={1.75}/>
          <p style={{fontSize:10,fontWeight:700,color:T.rose,marginTop:8,letterSpacing:'.06em'}}>GASTOS DE HOY</p>
          <p style={{fontSize:19,fontWeight:900,color:T.navy,marginTop:3,letterSpacing:'-.02em'}}>{fUSD(tGas)}</p>
        </Card>
      </div>

      {/* Acciones rapidas */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
        <button onClick={()=>{go('nuevoGasto');setTimeout(()=>iniciarVoz('g:multiple'),300)}} style={{
          background:T.brandGold, color:T.brand, border:'none',
          borderRadius:20, padding:'20px 16px', width:'100%',
          cursor:'pointer', display:'flex', flexDirection:'column',
          alignItems:'center', gap:10,
          boxShadow:'0 5px 0 #E5A040',
          WebkitTapHighlightColor:'transparent',
          transition:'transform .08s, box-shadow .08s',
        }}
          onPointerDown={e=>{e.currentTarget.style.transform='translateY(3px)';e.currentTarget.style.boxShadow='0 2px 0 #E5A040'}}
          onPointerUp={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='0 5px 0 #E5A040'}}
          onPointerLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='0 5px 0 #E5A040'}}
        >
          <div style={{width:44,height:44,borderRadius:14,background:'rgba(94,64,91,0.12)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <Mic size={22} color={T.brand} strokeWidth={1.75}/>
          </div>
          <span style={{fontSize:14,fontWeight:800}}>Dictar gastos</span>
        </button>

        <button onClick={()=>homeFileRef.current?.click()} style={{
          background:T.brand, color:'#fff', border:'none',
          borderRadius:20, padding:'20px 16px', width:'100%',
          cursor:'pointer', display:'flex', flexDirection:'column',
          alignItems:'center', gap:10,
          boxShadow:'0 5px 0 #3D2539',
          WebkitTapHighlightColor:'transparent',
          transition:'transform .08s, box-shadow .08s',
        }}
          onPointerDown={e=>{e.currentTarget.style.transform='translateY(3px)';e.currentTarget.style.boxShadow='0 2px 0 #3D2539'}}
          onPointerUp={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='0 5px 0 #3D2539'}}
          onPointerLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='0 5px 0 #3D2539'}}
        >
          <div style={{width:44,height:44,borderRadius:14,background:'rgba(255,255,255,0.12)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <Camera size={22} color='#fff' strokeWidth={1.75}/>
          </div>
          <span style={{fontSize:14,fontWeight:800}}>Escanear factura</span>
        </button>
        <input ref={homeFileRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={e=>{if(e.target.files[0])escanearFactura(e.target.files[0]);e.target.value=''}}/>
      </div>

      {/* Botón secundario: gasto manual */}
      <Btn onClick={()=>go('nuevoGasto')} bg={T.border} color={T.navy} full icon={Plus} style={{fontSize:13,padding:'14px',boxShadow:'none'}}>
        Registrar gasto manual
      </Btn>

      <BottomNav pantalla={pantalla} go={go}/>
      <Confetti active={confetti}/><Toast msg={toast}/><SavingOverlay active={saving} msg={savingMsg}/>
    </div>
  )

  // ══════════════════════════════════════════════════════════
  // GASTOS (tab)
  // ══════════════════════════════════════════════════════════
  if (pantalla === 'gastos') {
    const porCat=CATS.map(cat=>({...cat,items:data.gastos.filter(g=>g.categoria===cat.id),total:data.gastos.filter(g=>g.categoria===cat.id).reduce((a,g)=>a+(n(g.monto))*(g.moneda==='USD'?1:1/data.tasa),0)})).filter(c=>c.items.length>0)
    return (
      <div style={{minHeight:'100svh',background:T.bg,padding:'52px 20px 96px',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
          <h2 style={{fontSize:22,fontWeight:800,color:T.navy,letterSpacing:'-.025em'}}>Gastos</h2>
          <div style={{textAlign:'right'}}>
            <p style={{fontSize:10,color:T.muted,fontWeight:700,letterSpacing:'.08em'}}>TOTAL</p>
            <p style={{fontSize:19,fontWeight:900,color:T.rose,letterSpacing:'-.02em'}}>{fUSD(tGas)}</p>
          </div>
        </div>

        <Btn onClick={()=>go('nuevoGasto')} bg={T.cobalt} full icon={Plus} style={{marginBottom:22,padding:'15px',fontSize:14}}>
          Agregar Gasto
        </Btn>

        {porCat.length===0?(
          <Card style={{textAlign:'center',padding:44,borderRadius:32}}>
            <Receipt size={34} color={T.muted} strokeWidth={1.5} style={{margin:'0 auto'}}/>
            <p style={{fontSize:15,fontWeight:700,color:T.navy,marginTop:14}}>Sin gastos hoy</p>
            <p style={{fontSize:13,color:T.sub,marginTop:6}}>Toca "Agregar Gasto" para registrar</p>
          </Card>
        ):porCat.map(cat=>(
          <div key={cat.id} style={{marginBottom:18}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,paddingHorizontal:2}}>
              <Label>{cat.label.toUpperCase()}</Label>
              <span style={{fontSize:12,fontWeight:700,color:T.sub}}>{fUSD(cat.total)}</span>
            </div>
            <Card style={{borderRadius:24}}>
              {cat.items.map((g,i)=>{const enUSD=n(g.monto)*(g.moneda==='USD'?1:1/data.tasa);return(
                <div key={g.id}>
                  {i>0&&<Sep/>}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <p style={{fontSize:15,fontWeight:700,color:T.navy}}>{g.concepto}</p>
                      <p style={{fontSize:12,color:T.muted,marginTop:2}}>{g.moneda==='USD'?`${fUSD(g.monto)} = ${fBS(n(g.monto)*data.tasa)}`:fBS(g.monto)}</p>
                    </div>
                    <button onClick={()=>eliminarGasto(g)} style={{background:T.roseLight,border:'none',borderRadius:10,width:34,height:34,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',WebkitTapHighlightColor:'transparent'}}>
                      <Trash2 size={15} color={T.rose} strokeWidth={1.75}/>
                    </button>
                  </div>
                </div>
              )})}
            </Card>
          </div>
        ))}

        <BottomNav pantalla={pantalla} go={go}/>
        <Toast msg={toast}/>
        <Confirm title={confirm?.title} msg={confirm?.msg} onYes={confirm?.onYes} onNo={()=>setConfirm(null)} yesLabel={confirm?.yesLabel} noLabel={confirm?.noLabel} yesColor={confirm?.yesColor}>{confirm?.body}</Confirm>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════
  // CIERRE (tab)
  // ══════════════════════════════════════════════════════════
  if (pantalla === 'cierre') {
    const esHoy = fechaCierre === hoy()

    // ── Supabase data para la fecha ──
    const cierreIngDB = dbIngresos.filter(i => i.fecha === fechaCierre)
    const cierreGasDB = dbGastos.filter(g => g.fecha === fechaCierre)
    const tieneCierreDB = cierreIngDB.length > 0

    // ── Sumatoria en tiempo real del formulario local (solo hoy) ──
    const localIngTotal = esHoy ? totalUSD(ing, data.tasa) : 0
    const localGasTotal = esHoy ? totalGastosUSD(data.gastos, data.tasa) : 0
    const tieneIngresosLocal = esHoy && Object.values(ing).some(v => n(v) > 0)

    // ── Totales: usa local si es hoy y hay datos del form, sino Supabase ──
    const cierreTotalIng = (esHoy && tieneIngresosLocal)
      ? redondear(localIngTotal)
      : redondear(cierreIngDB.reduce((a, i) => a + toUSD(i.monto, i.moneda, data.tasa), 0))
    const cierreTotalGas = esHoy
      ? redondear(localGasTotal + cierreGasDB.reduce((a, g) => a + toUSD(g.monto, g.moneda, data.tasa), 0))
      : redondear(cierreGasDB.reduce((a, g) => a + toUSD(g.monto, g.moneda, data.tasa), 0))
    const cierreNeto = redondear(cierreTotalIng - cierreTotalGas)
    const cajaCerrada = esHoy ? data.cerrada : tieneCierreDB

    // Mapeo de ingresos de Supabase para mostrar lineas
    const cierreLineas = [
      { concepto:'Bicentenario', Icon:Landmark, moneda:'BS' },
      { concepto:'Bancamiga', Icon:Landmark, moneda:'BS' },
      { concepto:'Bancaribe', Icon:Landmark, moneda:'BS' },
      { concepto:'Banesco', Icon:Landmark, moneda:'BS' },
      { concepto:'Pagomovil', Icon:CreditCard, moneda:'BS' },
      { concepto:'Efectivo Bolivares', Icon:Banknote, moneda:'BS' },
      { concepto:'Efectivo Dolares', Icon:Banknote, moneda:'USD' },
      { concepto:'Delivery', Icon:Bike, moneda:'BS' },
      { concepto:'Pedidos Ya Prepago', Icon:Package, moneda:'USD' },
      { concepto:'Pedidos Ya Efectivo', Icon:Bike, moneda:'BS' },
      { concepto:'Divisas', Icon:DollarSign, moneda:'USD' },
      { concepto:'Cuentas Por Cobrar', Icon:AlertCircle, moneda:'USD' },
    ].map(l => {
      const row = cierreIngDB.find(i => i.concepto === l.concepto)
      return row ? { ...l, monto: row.monto, id: row.id } : null
    }).filter(Boolean)

    return (
      <div style={{minHeight:'100svh',background:T.bg,padding:'52px 20px 96px',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
          <h2 style={{fontSize:22,fontWeight:800,color:T.navy,letterSpacing:'-.025em'}}>Cierre de Caja</h2>
          <WaBtn onClick={()=>enviarResumen()}/>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
          <input type="date" value={fechaCierre} onChange={e => setFechaCierre(e.target.value)} max={hoy()}
            style={{flex:1,height:38,fontSize:14,fontWeight:600,color:T.navy,background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:12,padding:'0 12px',outline:'none'}}/>
          <span style={{fontSize:12,color:T.muted}}>Tasa Bs {data.tasa}</span>
        </div>

        {/* Aviso de fecha pasada */}
        {!esHoy && (
          <p style={{fontSize:12,fontWeight:600,color:T.brandGold,marginBottom:14}}>
            Viendo datos del {fDate(fechaCierre)}
          </p>
        )}

        {/* Entrada dual: Foto o Manual (solo si no hay cierre y es editable) */}
        {!tieneCierreDB && !tieneIngresosLocal && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:20}}>
            <button onClick={()=>cierreFileRef.current?.click()} style={{background:T.brandGold,color:T.brand,border:'none',borderRadius:18,padding:'16px 8px',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:8,boxShadow:'0 4px 0 #E5A040',WebkitTapHighlightColor:'transparent'}}>
              <Camera size={22} color={T.brand} strokeWidth={1.75}/>
              <span style={{fontSize:12,fontWeight:800}}>Camara</span>
            </button>
            <button onClick={()=>cierreGalRef.current?.click()} style={{background:T.sub,color:'#fff',border:'none',borderRadius:18,padding:'16px 8px',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:8,boxShadow:'0 4px 0 #5A6070',WebkitTapHighlightColor:'transparent'}}>
              <Package size={22} color='#fff' strokeWidth={1.75}/>
              <span style={{fontSize:12,fontWeight:800}}>Galeria</span>
            </button>
            <button onClick={()=>go('ingresos')} style={{background:T.brand,color:'#fff',border:'none',borderRadius:18,padding:'16px 8px',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:8,boxShadow:'0 4px 0 #3D2539',WebkitTapHighlightColor:'transparent'}}>
              <Edit3 size={22} color='#fff' strokeWidth={1.75}/>
              <span style={{fontSize:12,fontWeight:800}}>Manual</span>
            </button>
            <input ref={cierreFileRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={e=>{if(e.target.files[0])procesarFoto(e.target.files[0]);e.target.value=''}}/>
            <input ref={cierreGalRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>{if(e.target.files[0])procesarFoto(e.target.files[0]);e.target.value=''}}/>
          </div>
        )}

        {/* Tarjeta resumen — datos de Supabase para la fecha seleccionada */}
        <div style={{background:'linear-gradient(145deg,#3D2539,#5E405B)',borderRadius:32,padding:'28px 24px',marginBottom:18,boxShadow:'0 16px 48px rgba(0,0,0,0.18)'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div>
              <p style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.4)',letterSpacing:'.08em'}}>INGRESOS</p>
              <p style={{fontSize:21,fontWeight:900,color:'#FFB752',marginTop:5,letterSpacing:'-.02em'}}>{fUSD(cierreTotalIng)}</p>
            </div>
            <div>
              <p style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.4)',letterSpacing:'.08em'}}>GASTOS</p>
              <p style={{fontSize:21,fontWeight:900,color:'#FF7752',marginTop:5,letterSpacing:'-.02em'}}>{fUSD(cierreTotalGas)}</p>
            </div>
          </div>
          <div style={{borderTop:'1px solid rgba(255,255,255,0.1)',paddingTop:18,marginTop:18}}>
            <p style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.4)',letterSpacing:'.08em'}}>
              {cierreNeto >= 0 ? 'GANANCIA' : 'PERDIDA'}
            </p>
            <p style={{fontSize:42,fontWeight:900,color:cierreNeto>=0?'#6EE7B7':'#FCA5A5',letterSpacing:'-.035em',lineHeight:1.1,marginTop:8}}>{fUSD(cierreNeto)}</p>
          </div>
        </div>

        {/* Boton editar si hay cierre o datos locales */}
        {(tieneCierreDB || tieneIngresosLocal) && !cajaCerrada && (
          <Btn onClick={()=>{if(!esHoy)editarCierreHistorico(fechaCierre,cierreIngDB);else go('ingresos')}} bg={T.cobaltLight} color={T.brand} full icon={Edit3} style={{marginBottom:18,padding:'13px',fontSize:13,boxShadow:'none'}}>
            Editar ingresos del cierre
          </Btn>
        )}

        {/* Desglose de ingresos desde Supabase */}
        {cierreLineas.length > 0 && (
          <>
            <Label>DESGLOSE DE INGRESOS</Label>
            <Card style={{marginBottom:18,borderRadius:28}}>
              {cierreLineas.map((l, i) => {
                const usdV = l.moneda === 'USD' ? l.monto : redondear(l.monto / data.tasa)
                return (
                  <div key={l.concepto}>
                    {i > 0 && <Sep/>}
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div style={{width:32,height:32,borderRadius:9,background:T.cobaltLight,display:'flex',alignItems:'center',justifyContent:'center'}}>
                          <l.Icon size={15} color={T.cobalt} strokeWidth={1.75}/>
                        </div>
                        <span style={{fontSize:13,fontWeight:600,color:T.sub}}>{l.concepto}</span>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <p style={{fontSize:15,fontWeight:800,color:T.navy}}>{l.moneda==='USD'?fUSD(l.monto):fBS(l.monto)}</p>
                        <p style={{fontSize:11,color:T.muted}}>{fUSD(usdV)}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </Card>
          </>
        )}

        {/* Desglose de gastos desde Supabase */}
        {cierreGasDB.length > 0 && (
          <>
            <Label>GASTOS DEL DIA</Label>
            <Card style={{marginBottom:22,borderRadius:28}}>
              {cierreGasDB.map((g, i) => (
                <div key={g.id}>
                  {i > 0 && <Sep/>}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <p style={{fontSize:14,fontWeight:600,color:T.navy}}>{g.concepto}</p>
                      <p style={{fontSize:12,fontWeight:600,color:T.muted,marginTop:2}}>{g.categoria}</p>
                    </div>
                    <p style={{fontSize:15,fontWeight:800,color:T.rose}}>{fUSD(toUSD(g.monto, g.moneda, data.tasa))}</p>
                  </div>
                </div>
              ))}
            </Card>
          </>
        )}

        {/* Sin datos */}
        {!tieneCierreDB && !tieneIngresosLocal && cierreGasDB.length === 0 && (
          <Card style={{textAlign:'center',padding:40,borderRadius:28,marginBottom:18}}>
            <BarChart3 size={30} color={T.muted} strokeWidth={1.5} style={{margin:'0 auto'}}/>
            <p style={{fontSize:15,fontWeight:700,color:T.navy,marginTop:12}}>Sin datos para {fDate(fechaCierre)}</p>
            <p style={{fontSize:13,color:T.sub,marginTop:4}}>Sube una foto o carga los datos manualmente</p>
          </Card>
        )}

        {/* Cerrar / Reabrir */}
        {cajaCerrada ? (
          <>
            <Card style={{background:T.forestLight,textAlign:'center',padding:20,borderRadius:24,marginBottom:12}}>
              <CheckCircle size={26} color={T.forest} strokeWidth={1.75} style={{margin:'0 auto'}}/>
              <p style={{fontSize:15,fontWeight:700,color:T.forest,marginTop:8}}>Caja cerrada</p>
            </Card>
            {esHoy && (
              <button onClick={reabrirCaja} style={{
                background:'none',border:'none',width:'100%',padding:'12px',
                fontSize:13,fontWeight:600,color:T.muted,cursor:'pointer',textAlign:'center',
                WebkitTapHighlightColor:'transparent',
              }}>
                ¿Te equivocaste? Reabrir caja de hoy
              </button>
            )}
            {!esHoy && (
              <Btn onClick={()=>editarCierreHistorico(fechaCierre,cierreIngDB)} bg={T.cobaltLight} color={T.brand} full icon={Edit3} style={{padding:'13px',fontSize:13,boxShadow:'none'}}>
                Editar cierre de {fDate(fechaCierre)}
              </Btn>
            )}
          </>
        ) : (esHoy || tieneIngresosLocal) && (
          <Btn onClick={cerrarCaja} bg={T.navy} full icon={Lock} style={{padding:'16px',fontSize:14,boxShadow:'0 4px 0 rgba(0,0,0,0.25)'}}>
            Cerrar Caja {esHoy ? 'del Dia' : `del ${fDate(fechaCierre)}`}
          </Btn>
        )}

        <BottomNav pantalla={pantalla} go={go}/>
        <Confetti active={confetti}/><Toast msg={toast}/><SavingOverlay active={saving} msg={savingMsg}/>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════
  // METRICAS (tab)
  // ══════════════════════════════════════════════════════════
  if (pantalla === 'metricas') {
    const PIE_COLORS = ['#FFB752','#5E405B','#2D6A4F','#FF7752','#7C3AED','#1D4ED8','#BE185D','#C2410C','#374151','#0891B2']
    const hoyStr = hoy()
    const tasa = data.tasa

    // ── Totales globales ──
    const totalIngDB = redondear(dbIngresos.reduce((a, i) => a + toUSD(i.monto, i.moneda, tasa), 0))
    const totalGasDB = redondear(dbGastos.reduce((a, g) => a + toUSD(g.monto, g.moneda, tasa), 0))
    const balanceReal = redondear(totalIngDB - totalGasDB)

    // ── Semana actual: lunes a hoy ──
    const ahora = new Date()
    const lunes = new Date(ahora); lunes.setDate(ahora.getDate() - ((ahora.getDay() + 6) % 7))
    const lunesStr = lunes.toISOString().slice(0, 10)
    const ingSemana = redondear(dbIngresos.filter(i => i.fecha >= lunesStr && i.fecha <= hoyStr).reduce((a, i) => a + toUSD(i.monto, i.moneda, tasa), 0))
    const gasSemana = redondear(dbGastos.filter(g => g.fecha >= lunesStr && g.fecha <= hoyStr).reduce((a, g) => a + toUSD(g.monto, g.moneda, tasa), 0))
    const netoSemana = redondear(ingSemana - gasSemana)

    // ── Dias pendientes ──
    const diasSemana = []
    for (let d = new Date(lunes); d <= ahora; d.setDate(d.getDate() + 1)) diasSemana.push(d.toISOString().slice(0, 10))
    const diasConCierre = new Set(dbIngresos.map(i => i.fecha))
    const diasPendientes = diasSemana.filter(d => !diasConCierre.has(d) && d !== hoyStr)
    const diasNombre = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab']
    const diasNombreFull = ['Domingo','Lunes','Martes','Miercoles','Jueves','Viernes','Sabado']

    // ── Gastos por concepto (Top 5 fuga) ──
    const concMap = {}
    for (const g of dbGastos) {
      const c = g.concepto || 'Varios'
      concMap[c] = (concMap[c] || 0) + toUSD(g.monto, g.moneda, tasa)
    }
    const top5Fuga = Object.entries(concMap)
      .map(([name, value]) => ({ name, value: redondear(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)

    // ── Gastos por categoria (pie) ──
    const catMap = {}
    for (const g of dbGastos) { catMap[g.categoria || 'Varios'] = (catMap[g.categoria || 'Varios'] || 0) + toUSD(g.monto, g.moneda, tasa) }
    const pieData = Object.entries(catMap).map(([name, value]) => ({ name, value: redondear(value) })).filter(d => d.value > 0).sort((a, b) => b.value - a.value)

    // ── Tendencia mensual (line chart) ──
    const mesMap = {}
    for (const i of dbIngresos) { const m = i.fecha.slice(0, 7); mesMap[m] = mesMap[m] || { mes: m, ing: 0, gas: 0 }; mesMap[m].ing += toUSD(i.monto, i.moneda, tasa) }
    for (const g of dbGastos) { const m = g.fecha.slice(0, 7); mesMap[m] = mesMap[m] || { mes: m, ing: 0, gas: 0 }; mesMap[m].gas += toUSD(g.monto, g.moneda, tasa) }
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    const trendData = Object.values(mesMap).sort((a, b) => a.mes.localeCompare(b.mes)).map(d => ({
      name: meses[parseInt(d.mes.slice(5)) - 1],
      Ingresos: redondear(d.ing), Gastos: redondear(d.gas), Neto: redondear(d.ing - d.gas),
    }))

    // ── Coach IA predictivo ──
    const gastoPorDia = [0,0,0,0,0,0,0]
    for (const g of dbGastos) { gastoPorDia[new Date(g.fecha + 'T12:00:00').getDay()] += toUSD(g.monto, g.moneda, tasa) }
    let maxDia = 0; for (let i = 1; i < 7; i++) { if (gastoPorDia[i] > gastoPorDia[maxDia]) maxDia = i }
    const topCat = pieData[0]?.name || 'Insumos'
    const topCatPct = totalGasDB > 0 ? Math.round((pieData[0]?.value || 0) / totalGasDB * 100) : 0

    // Semana anterior para comparacion
    const lunesAnt = new Date(lunes); lunesAnt.setDate(lunesAnt.getDate() - 7)
    const domAnt = new Date(lunes); domAnt.setDate(domAnt.getDate() - 1)
    const gasSemanaAnt = redondear(dbGastos.filter(g => g.fecha >= lunesAnt.toISOString().slice(0,10) && g.fecha <= domAnt.toISOString().slice(0,10)).reduce((a, g) => a + toUSD(g.monto, g.moneda, tasa), 0))
    const cambioSemanal = gasSemanaAnt > 0 ? Math.round((gasSemana - gasSemanaAnt) / gasSemanaAnt * 100) : 0

    const insights = []
    if (maxDia > 0) insights.push(`Los ${diasNombreFull[maxDia].toLowerCase()} son tu dia de mayor gasto (${fUSD(gastoPorDia[maxDia])} acumulado). Planifica con anticipacion.`)
    if (topCatPct > 30) insights.push(`${topCat} representa el ${topCatPct}% de tus gastos. ${topCatPct > 45 ? 'Busca alternativas de proveedor.' : 'Manten el control.'}`)
    if (cambioSemanal < -10) insights.push(`Esta semana redujiste gastos un ${Math.abs(cambioSemanal)}% vs la anterior. Sigue asi.`)
    else if (cambioSemanal > 20) insights.push(`Ojo: los gastos subieron un ${cambioSemanal}% esta semana vs la anterior.`)
    if (balanceReal > 0) insights.push('El balance es positivo. El negocio va generando valor.')
    else insights.push('Los gastos superan los ingresos acumulados. Revisa los egresos no esenciales.')
    const insightIdx = Math.floor(Date.now() / 86400000) % insights.length

    return (
      <div style={{minHeight:'100svh',background:T.bg,padding:'52px 20px 96px',overflowY:'auto'}}>
        <h2 style={{fontSize:22,fontWeight:800,color:T.navy,letterSpacing:'-.025em',marginBottom:24}}>Metricas</h2>

        {/* ── 1. SEMAFORO: Ventas vs Gastos semana ── */}
        <Card style={{marginBottom:16,padding:'22px 20px'}}>
          <Label>SEMANA ACTUAL</Label>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:16}}>
            <div style={{background:T.forestLight,borderRadius:16,padding:'14px',textAlign:'center'}}>
              <TrendingUp size={18} color={T.forest} strokeWidth={1.75} style={{margin:'0 auto 6px'}}/>
              <p style={{fontSize:10,fontWeight:700,color:T.forest,letterSpacing:'.06em'}}>VENTAS</p>
              <p style={{fontSize:20,fontWeight:900,color:T.navy,marginTop:4}}>{fUSD(ingSemana)}</p>
            </div>
            <div style={{background:T.roseLight,borderRadius:16,padding:'14px',textAlign:'center'}}>
              <TrendingDown size={18} color={T.rose} strokeWidth={1.75} style={{margin:'0 auto 6px'}}/>
              <p style={{fontSize:10,fontWeight:700,color:T.rose,letterSpacing:'.06em'}}>GASTOS</p>
              <p style={{fontSize:20,fontWeight:900,color:T.navy,marginTop:4}}>{fUSD(gasSemana)}</p>
            </div>
          </div>
          <div style={{background:netoSemana>=0?'#E8F5EE':'#FFF0EB',borderRadius:14,padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:13,fontWeight:700,color:netoSemana>=0?T.forest:T.rose}}>
              {netoSemana >= 0 ? 'Ganancia neta' : 'Deficit neto'}
            </span>
            <span style={{fontSize:22,fontWeight:900,color:netoSemana>=0?T.forest:T.rose}}>{fUSD(netoSemana)}</span>
          </div>
        </Card>

        {/* ── 2. TOP 5 FUGA DE DINERO ── */}
        <Card style={{marginBottom:16,padding:'20px'}}>
          <Label>TOP 5 FUGA DE DINERO</Label>
          {top5Fuga.length > 0 ? (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {top5Fuga.map((d, i) => {
                const pctBar = totalGasDB > 0 ? Math.min((d.value / totalGasDB) * 100, 100) : 0
                return (
                  <div key={d.name}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                      <span style={{fontSize:13,fontWeight:700,color:T.navy}}>{i + 1}. {d.name}</span>
                      <span style={{fontSize:13,fontWeight:800,color:T.rose}}>{fUSD(d.value)}</span>
                    </div>
                    <div style={{height:6,background:T.border,borderRadius:3,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${pctBar}%`,background:PIE_COLORS[i],borderRadius:3,transition:'width .3s'}}/>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : <p style={{fontSize:14,color:T.muted,textAlign:'center',padding:'20px 0'}}>Sin datos</p>}
        </Card>

        {/* ── 3. ALERTA CIERRES OLVIDADOS ── */}
        {diasPendientes.length > 0 && (
          <Card style={{marginBottom:16,background:'#FFF0EB',border:`1px solid ${T.rose}20`,padding:'18px 20px'}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
              <div style={{width:36,height:36,borderRadius:10,background:T.rose,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <AlertCircle size={18} color='#fff' strokeWidth={1.75}/>
              </div>
              <div>
                <p style={{fontSize:14,fontWeight:800,color:T.rose,marginBottom:4}}>
                  Arcelia, {diasPendientes.length === 1 ? 'falta el cierre del' : 'faltan los cierres del'}
                </p>
                <p style={{fontSize:15,fontWeight:700,color:T.navy,lineHeight:1.5}}>
                  {diasPendientes.map(d => {
                    const dow = new Date(d + 'T12:00:00').getDay()
                    return diasNombreFull[dow]
                  }).join(' y ')}
                </p>
                <Btn onClick={()=>go('cierre')} bg={T.rose} style={{marginTop:12,padding:'10px 16px',fontSize:12}} icon={BarChart3}>
                  Ir a cerrar caja
                </Btn>
              </div>
            </div>
          </Card>
        )}

        {/* ── 4. COACH IA PREDICTIVO ── */}
        <Card style={{marginBottom:16,background:`${T.brandGold}12`,border:`1px solid ${T.brandGold}25`,padding:'20px'}}>
          <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
            <div style={{width:40,height:40,borderRadius:12,background:T.brandGold,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <Lightbulb size={20} color='#fff' strokeWidth={1.75}/>
            </div>
            <div style={{flex:1}}>
              <p style={{fontSize:10,fontWeight:700,color:T.brandGold,letterSpacing:'.08em',marginBottom:8}}>INSIGHT DE ANDINO</p>
              <p style={{fontSize:15,fontWeight:600,color:T.navy,lineHeight:1.5}}>{insights[insightIdx]}</p>
              {cambioSemanal !== 0 && (
                <div style={{display:'flex',alignItems:'center',gap:6,marginTop:10,background:T.surface,borderRadius:10,padding:'8px 12px'}}>
                  {cambioSemanal > 0 ? <TrendingUp size={14} color={T.rose}/> : <TrendingDown size={14} color={T.forest}/>}
                  <span style={{fontSize:12,fontWeight:700,color:cambioSemanal>0?T.rose:T.forest}}>
                    {cambioSemanal > 0 ? '+' : ''}{cambioSemanal}% vs semana anterior
                  </span>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* ── 5. TENDENCIA MENSUAL ── */}
        {trendData.length > 0 && (
          <Card style={{marginBottom:16,padding:'20px 12px 12px'}}>
            <div style={{paddingLeft:8}}><Label>TENDENCIA MENSUAL</Label></div>
            <div style={{height:200}}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{top:5,right:10,left:-10,bottom:5}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
                  <XAxis dataKey="name" tick={{fontSize:11,fill:T.muted,fontWeight:600}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:10,fill:T.muted}} axisLine={false} tickLine={false} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v}/>
                  <Tooltip formatter={v => fUSD(v)} contentStyle={{borderRadius:12,border:'none',boxShadow:'0 4px 20px rgba(0,0,0,0.1)',fontSize:13,fontWeight:600}}/>
                  <Line type="monotone" dataKey="Ingresos" stroke={T.forest} strokeWidth={2.5} dot={{r:4,fill:T.forest}} activeDot={{r:6}}/>
                  <Line type="monotone" dataKey="Gastos" stroke={T.rose} strokeWidth={2.5} dot={{r:4,fill:T.rose}} activeDot={{r:6}}/>
                  <Line type="monotone" dataKey="Neto" stroke={T.brandGold} strokeWidth={2} strokeDasharray="5 5" dot={false}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{display:'flex',justifyContent:'center',gap:16,marginTop:8}}>
              <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:8,height:8,borderRadius:4,background:T.forest}}/><span style={{fontSize:11,color:T.muted,fontWeight:600}}>Ingresos</span></div>
              <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:8,height:8,borderRadius:4,background:T.rose}}/><span style={{fontSize:11,color:T.muted,fontWeight:600}}>Gastos</span></div>
              <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:12,height:2,background:T.brandGold}}/><span style={{fontSize:11,color:T.muted,fontWeight:600}}>Neto</span></div>
            </div>
          </Card>
        )}

        {/* ── PIE: Categorias ── */}
        <Card style={{marginBottom:16,padding:'20px 16px'}}>
          <Label>GASTOS POR CATEGORIA</Label>
          {pieData.length > 0 ? (
            <>
              <div style={{height:200,marginBottom:8}}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} stroke="none">
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}/>)}
                    </Pie>
                    <Tooltip formatter={v => fUSD(v)} contentStyle={{borderRadius:12,border:'none',boxShadow:'0 4px 20px rgba(0,0,0,0.1)',fontSize:13,fontWeight:600}}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {pieData.slice(0, 6).map((d, i) => (
                  <div key={d.name} style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:8,height:8,borderRadius:2,background:PIE_COLORS[i % PIE_COLORS.length],flexShrink:0}}/>
                    <span style={{fontSize:12,fontWeight:600,color:T.navy,flex:1}}>{d.name}</span>
                    <span style={{fontSize:12,fontWeight:800,color:T.sub}}>{totalGasDB>0?Math.round(d.value/totalGasDB*100):0}%</span>
                    <span style={{fontSize:12,fontWeight:700,color:T.navy}}>{fUSD(d.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p style={{fontSize:14,color:T.muted,textAlign:'center',padding:'30px 0'}}>Sin datos de gastos aun</p>}
        </Card>

        {/* Mini stats */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
          <Card style={{padding:'14px 10px',textAlign:'center'}}>
            <p style={{fontSize:9,fontWeight:700,color:T.muted,letterSpacing:'.06em'}}>REGISTROS</p>
            <p style={{fontSize:20,fontWeight:900,color:T.navy,marginTop:3}}>{dbGastos.length + dbIngresos.length}</p>
          </Card>
          <Card style={{padding:'14px 10px',textAlign:'center'}}>
            <p style={{fontSize:9,fontWeight:700,color:T.muted,letterSpacing:'.06em'}}>BALANCE</p>
            <p style={{fontSize:20,fontWeight:900,color:balanceReal>=0?T.forest:T.rose,marginTop:3}}>{fUSD(balanceReal)}</p>
          </Card>
          <Card style={{padding:'14px 10px',textAlign:'center'}}>
            <p style={{fontSize:9,fontWeight:700,color:T.muted,letterSpacing:'.06em'}}>CATEGORIAS</p>
            <p style={{fontSize:20,fontWeight:900,color:T.navy,marginTop:3}}>{pieData.length}</p>
          </Card>
        </div>

        <BottomNav pantalla={pantalla} go={go}/>
        <Toast msg={toast}/>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════
  // HISTORIAL (tab)
  // ══════════════════════════════════════════════════════════
  if (pantalla === 'historial') {
    // Agrupar datos de Supabase por fecha
    const fechasMap = {}
    for (const g of dbGastos) {
      if (!fechasMap[g.fecha]) fechasMap[g.fecha] = { gastos: [], ingresos: [] }
      fechasMap[g.fecha].gastos.push(g)
    }
    for (const i of dbIngresos) {
      if (!fechasMap[i.fecha]) fechasMap[i.fecha] = { gastos: [], ingresos: [] }
      fechasMap[i.fecha].ingresos.push(i)
    }
    const fechas = Object.keys(fechasMap).sort((a, b) => b.localeCompare(a))

    // Detalle de un dia
    if (histItem) {
      const hi = histItem
      const tGas = redondear(hi.gastos.reduce((a, g) => a + toUSD(g.monto, g.moneda, data.tasa), 0))
      const tIng = redondear(hi.ingresos.reduce((a, i) => a + toUSD(i.monto, i.moneda, data.tasa), 0))
      const net2 = redondear(tIng - tGas)
      return (
        <div style={{minHeight:'100svh',background:T.bg,padding:'32px 20px 96px',overflowY:'auto'}}>
          <InnerHeader title={fDate(hi.fecha)} onBack={()=>setHistItem(null)}/>

          {/* Acciones de edicion */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:18}}>
            <Btn onClick={()=>editarCierreHistorico(hi.fecha, hi.ingresos)} bg={T.cobaltLight} color={T.brand} style={{boxShadow:'none',padding:'11px 6px',fontSize:11}} icon={Edit3}>
              Editar
            </Btn>
            <Btn onClick={()=>{setFechaCierre(hi.fecha);cierreFileRef.current?.click()}} bg={T.amberLight} color={T.amber} style={{boxShadow:'none',padding:'11px 6px',fontSize:11}} icon={Camera}>
              Re-escanear
            </Btn>
            <Btn onClick={()=>borrarCierreHistorico(hi.fecha)} bg={T.roseLight} color={T.rose} style={{boxShadow:'none',padding:'11px 6px',fontSize:11}} icon={Trash2}>
              Borrar
            </Btn>
          </div>
          <div style={{background:'linear-gradient(145deg,#3D2539,#5E405B)',borderRadius:28,padding:'24px',marginBottom:18,boxShadow:'0 12px 40px rgba(0,0,0,0.15)'}}>
            <p style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.4)',letterSpacing:'.08em'}}>NETO</p>
            <p style={{fontSize:36,fontWeight:900,color:'#fff',letterSpacing:'-.03em',marginTop:6}}>{fUSD(net2)}</p>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:18}}>
            <Card style={{background:T.forestLight,padding:'16px'}}>
              <p style={{fontSize:10,fontWeight:700,color:T.forest}}>INGRESOS</p>
              <p style={{fontSize:18,fontWeight:900,color:T.navy,marginTop:4}}>{fUSD(tIng)}</p>
            </Card>
            <Card style={{background:T.roseLight,padding:'16px'}}>
              <p style={{fontSize:10,fontWeight:700,color:T.rose}}>GASTOS</p>
              <p style={{fontSize:18,fontWeight:900,color:T.navy,marginTop:4}}>{fUSD(tGas)}</p>
            </Card>
          </div>
          {hi.ingresos.length > 0 && (
            <>
              <Label>INGRESOS</Label>
              <Card style={{borderRadius:24,marginBottom:16}}>
                {hi.ingresos.map((ig, i) => (
                  <div key={ig.id || i}>
                    {i > 0 && <Sep/>}
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div>
                        <p style={{fontSize:14,fontWeight:600,color:T.navy}}>{ig.concepto}</p>
                        {ig.moneda === 'BS' && <p style={{fontSize:11,color:T.muted,marginTop:2}}>{fBS(ig.monto)}</p>}
                      </div>
                      <p style={{fontSize:14,fontWeight:800,color:T.forest}}>{fUSD(toUSD(ig.monto, ig.moneda, data.tasa))}</p>
                    </div>
                  </div>
                ))}
              </Card>
            </>
          )}
          {hi.gastos.length > 0 && (
            <>
              <Label>GASTOS</Label>
              <Card style={{borderRadius:24}}>
                {hi.gastos.map((g, i) => (
                  <div key={g.id || i}>
                    {i > 0 && <Sep/>}
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div>
                        <p style={{fontSize:14,fontWeight:600,color:T.navy}}>{g.concepto}</p>
                        {g.moneda === 'BS' && <p style={{fontSize:11,color:T.muted,marginTop:2}}>{fBS(g.monto)}</p>}
                      </div>
                      <p style={{fontSize:14,fontWeight:800,color:T.rose}}>{fUSD(toUSD(g.monto, g.moneda, data.tasa))}</p>
                    </div>
                  </div>
                ))}
              </Card>
            </>
          )}
          <BottomNav pantalla={pantalla} go={go}/>
          <Confirm title={confirm?.title} msg={confirm?.msg} onYes={confirm?.onYes} onNo={()=>setConfirm(null)} yesLabel={confirm?.yesLabel} noLabel={confirm?.noLabel} yesColor={confirm?.yesColor}>{confirm?.body}</Confirm>
        </div>
      )
    }

    // ── Papelera ──
    if (showTrash) {
      const allTrash = [...trashGastos.map(g=>({...g,_tipo:'gasto'})), ...trashIngresos.map(i=>({...i,_tipo:'ingreso'}))].sort((a,b)=>(b.deleted_at||'').localeCompare(a.deleted_at||''))

      async function handleRestore(item) {
        if (item._tipo === 'gasto') { await restoreGasto(item.id); setDbGastos(await fetchGastos()); setTrashGastos(await fetchGastosTrash()) }
        else { await restoreIngreso(item.id); setDbIngresos(await fetchIngresos()); setTrashIngresos(await fetchIngresosTrash()) }
        showToast('Registro restaurado')
      }

      return (
        <div style={{minHeight:'100svh',background:T.bg,padding:'32px 20px 96px',overflowY:'auto'}}>
          <InnerHeader title="Papelera" onBack={()=>setShowTrash(false)}/>
          <p style={{fontSize:13,color:T.sub,marginBottom:20}}>Los registros se eliminan definitivamente despues de 15 dias</p>

          {allTrash.length === 0 ? (
            <Card style={{textAlign:'center',padding:48,borderRadius:28}}>
              <Trash size={30} color={T.muted} strokeWidth={1.5} style={{margin:'0 auto'}}/>
              <p style={{fontSize:15,fontWeight:700,color:T.navy,marginTop:14}}>Papelera vacia</p>
            </Card>
          ) : allTrash.map(item => {
            const deletedDate = new Date(item.deleted_at)
            const purgeDate = new Date(deletedDate.getTime() + 15 * 24 * 60 * 60 * 1000)
            const diasRestantes = Math.max(0, Math.ceil((purgeDate - Date.now()) / (24*60*60*1000)))
            return (
              <Card key={`${item._tipo}-${item.id}`} style={{marginBottom:10,padding:'14px 18px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                      <span style={{fontSize:10,fontWeight:700,color:item._tipo==='gasto'?T.rose:T.forest,background:item._tipo==='gasto'?T.roseLight:T.forestLight,padding:'2px 8px',borderRadius:6}}>{item._tipo==='gasto'?'GASTO':'INGRESO'}</span>
                      <span style={{fontSize:11,color:T.muted}}>{fDate(item.fecha)}</span>
                    </div>
                    <p style={{fontSize:14,fontWeight:700,color:T.navy,marginBottom:2}}>{item.concepto}</p>
                    <p style={{fontSize:12,color:T.muted}}>{fUSD(toUSD(item.monto, item.moneda, data.tasa))} · Se elimina en {diasRestantes} dia{diasRestantes!==1?'s':''}</p>
                  </div>
                  <button onClick={()=>handleRestore(item)} style={{width:38,height:38,borderRadius:10,border:`1px solid ${T.border}`,background:T.surface,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,WebkitTapHighlightColor:'transparent'}}>
                    <RotateCcw size={16} color={T.forest} strokeWidth={1.75}/>
                  </button>
                </div>
              </Card>
            )
          })}
          <BottomNav pantalla={pantalla} go={go}/>
        </div>
      )
    }

    // Lista de dias
    const hayDatos = fechas.length > 0 || historial.length > 0
    return (
      <div style={{minHeight:'100svh',background:T.bg,padding:'52px 20px 96px',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
          <h2 style={{fontSize:22,fontWeight:800,color:T.navy,letterSpacing:'-.025em'}}>Historial</h2>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <button onClick={async ()=>{setTrashGastos(await fetchGastosTrash());setTrashIngresos(await fetchIngresosTrash());setShowTrash(true)}} style={{width:34,height:34,borderRadius:10,border:`1px solid ${T.border}`,background:T.surface,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',WebkitTapHighlightColor:'transparent'}}>
              <Trash size={15} color={T.muted} strokeWidth={1.75}/>
            </button>
            {dbLoaded && <span style={{fontSize:12,color:T.muted}}>{dbGastos.length}G · {dbIngresos.length}I</span>}
          </div>
        </div>

        {!hayDatos ? (
          <Card style={{textAlign:'center',padding:48,borderRadius:32}}>
            <CalendarDays size={34} color={T.muted} strokeWidth={1.5} style={{margin:'0 auto'}}/>
            <p style={{fontSize:15,fontWeight:700,color:T.navy,marginTop:14}}>Sin registros anteriores</p>
            <p style={{fontSize:13,color:T.sub,marginTop:6}}>Los cierres del dia apareceran aqui</p>
          </Card>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {fechas.map(fecha => {
              const d = fechasMap[fecha]
              const tG = redondear(d.gastos.reduce((a, g) => a + toUSD(g.monto, g.moneda, data.tasa), 0))
              const tI = redondear(d.ingresos.reduce((a, i) => a + toUSD(i.monto, i.moneda, data.tasa), 0))
              const net2 = redondear(tI - tG)
              return (
                <Card key={fecha} onClick={() => setHistItem({ fecha, ...d })} style={{cursor:'pointer',borderRadius:22,padding:'18px 20px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <p style={{fontSize:14,fontWeight:700,color:T.navy}}>{fDate(fecha)}</p>
                      <p style={{fontSize:12,color:T.muted,marginTop:3}}>{d.ingresos.length} ingreso(s) · {d.gastos.length} gasto(s)</p>
                    </div>
                    <div style={{textAlign:'right',display:'flex',alignItems:'center',gap:10}}>
                      <p style={{fontSize:18,fontWeight:900,color:net2 >= 0 ? T.forest : T.rose,letterSpacing:'-.02em'}}>{fUSD(net2)}</p>
                      <ChevronRight size={16} color={T.muted} strokeWidth={1.75}/>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        <BottomNav pantalla={pantalla} go={go}/>
        <Toast msg={toast}/>
      </div>
    )
  }

  return null
}
