import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Home, Receipt, BarChart3, CalendarDays,
  DollarSign, Landmark, Smartphone, Banknote, Bike, Zap,
  TrendingUp, TrendingDown, CheckCircle, AlertCircle,
  Camera, Mic, MicOff, Lock, Plus, Trash2, ArrowLeft,
  RefreshCw, ChevronRight, Edit3, CreditCard, Package,
  X,
} from 'lucide-react'

// ─── Tokens de diseño ─────────────────────────────────────────────────────────
const T = {
  bg:          '#F9F9F9',   // fondo hueso
  surface:     '#FFFFFF',
  border:      'rgba(0,0,0,0.07)',
  navy:        '#1A1A1A',
  sub:         '#6B7280',
  muted:       '#B0B7C3',
  forest:      '#2D6A4F',
  forestLight: '#E8F5EE',
  cobalt:      '#1D4ED8',
  cobaltLight: '#EEF3FD',
  rose:        '#BE123C',
  roseLight:   '#FFF0F3',
  amber:       '#B45309',
  amberLight:  '#FEF7EC',
  wa:          '#25D366',
  // Sombras boutique: profundas pero ultra difuminadas
  shadowCard:  '0 2px 40px rgba(0,0,0,0.07)',
  shadowNav:   '0 -1px 0 rgba(0,0,0,0.05)',
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
const OCR_SYSTEM = `Eres un lector de libretas de cierre de caja para un restaurante venezolano llamado Andino Pop.
Extrae los valores de la foto. Responde SOLO JSON válido, sin markdown:
{
  "tasa": 0,
  "bicentenario": 0, "bancaribe": 0, "banesco": 0, "bancamiga": 0,
  "pagos_dia": 0, "efectivo_bs": 0, "delivery": 0,
  "pedidosya_usd": 0, "pedidosya_bs": 0,
  "divisas_usd": 0, "cuentas_cobrar": 0,
  "cierre_total": 0
}
Reglas:
- Los montos en Bs van tal cual. Los montos en $ van en los campos _usd.
- "tasa" es la tasa del dólar BCV anotada (ej: 479,77 → 479.77).
- "cierre_total" es el total general en USD que ella anotó.
- Si un campo no aparece, déjalo en 0.
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
function capitalizar(str) {
  if (!str) return ''
  return str.replace(/\b\w/g, c => c.toUpperCase())
}

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
const SYSTEM_PROMPT = 'Contador Andino Pop. Tasa: 481.21. Si dice Bs, divide entre tasa y redondea a 2 decimales. Si dice $, mantiene. Numeros redondos se quedan redondos. Capitaliza cada palabra del concepto. Si el monto original era en Bs, incluyelo en "bs". Responde solo JSON: [{"c":"Concepto","m":0.00,"bs":0}] donde "bs" es el monto original en bolivares (0 si era en dolares).'

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

// ─── Formato ──────────────────────────────────────────────────────────────────
const fUSD = v => {
  const num = redondear(parseFloat(v) || 0)
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
const fBS = v => {
  const num = redondear(parseFloat(v) || 0)
  const esEntero = num === Math.floor(num)
  return `Bs ${num.toLocaleString('es-VE', { minimumFractionDigits: esEntero ? 0 : 2, maximumFractionDigits: 2 })}`
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
  const ps = Array.from({length:36},(_,i)=>({id:i,left:`${Math.random()*100}%`,color:[T.forest,T.cobalt,T.amber,'#7C3AED','#BE123C'][i%5],delay:`${Math.random()*.6}s`,dur:`${1.4+Math.random()*.8}s`,w:`${6+Math.random()*7}px`}))
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

function Confirm({ msg, onYes, onNo }) {
  if (!msg) return null
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.35)',zIndex:9990,display:'flex',alignItems:'flex-end',padding:'0 16px 28px'}}>
      <div style={{background:T.surface,borderRadius:28,padding:'28px 24px',width:'100%',boxShadow:'0 -8px 40px rgba(0,0,0,0.12)'}}>
        <AlertCircle size={26} color={T.amber} strokeWidth={1.75} style={{margin:'0 auto 14px',display:'block'}}/>
        <p style={{fontSize:16,fontWeight:700,color:T.navy,textAlign:'center',lineHeight:1.5}}>{msg}</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:20}}>
          <button onClick={onNo} style={{padding:'14px',borderRadius:14,border:`1.5px solid ${T.border}`,background:T.bg,fontSize:14,fontWeight:700,color:T.sub,cursor:'pointer'}}>
            Cancelar
          </button>
          <button onClick={onYes} style={{padding:'14px',borderRadius:14,border:'none',background:T.forest,fontSize:14,fontWeight:700,color:'#fff',cursor:'pointer'}}>
            Guardar igual
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

// ─── Barra de navegación: 4 ítems simétricos ──────────────────────────────────
function BottomNav({ pantalla, go }) {
  const tabs = [
    { id:'home',      label:'Inicio',    Icon:Home        },
    { id:'gastos',    label:'Gastos',    Icon:Receipt     },
    { id:'cierre',    label:'Cierre',    Icon:BarChart3   },
    { id:'historial', label:'Historial', Icon:CalendarDays},
  ]
  return (
    <nav style={{
      position:'fixed', bottom:0, left:0, right:0,
      background:T.surface,
      boxShadow:T.shadowNav,
      display:'grid', gridTemplateColumns:'repeat(4,1fr)',
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
            color: active ? T.cobalt : T.muted,
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
  const [pantalla,   setPantalla]   = useState('tasa')
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

  const fileRef = useRef(null)
  const srRef   = useRef(null)
  const SR      = window.SpeechRecognition || window.webkitSpeechRecognition

  const go        = useCallback(p => setPantalla(p), [])
  const showToast = useCallback((msg, ms=2500) => {
    setToast(msg); setTimeout(()=>setToast(''), ms)
  }, [])

  // ── Init ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    setHistorial(cargarHistorial())
    const stored = cargarData()

    if (stored) {
      if (stored.fecha !== hoy()) {
        // Nuevo día: archivar el anterior y empezar fresco
        archivarData(stored)
        setHistorial(cargarHistorial())
        setBcvLoad(true)
        fetchTasaBCV().then(t => {
          const tasa = t || (stored.tasa || 481.21)
          const nueva = dataVacia(tasa)
          setData(nueva); guardarData(nueva)
          setTasaTemp(String(tasa)); setBcvLoad(false)
        })
      } else {
        setData(stored)
        setTasaTemp(String(stored.tasa))
        setPantalla('home')
      }
    } else {
      setBcvLoad(true)
      fetchTasaBCV().then(t => {
        const tasa = t || 481.21
        const nueva = dataVacia(tasa)
        setData(nueva); guardarData(nueva)
        setTasaTemp(String(tasa)); setBcvLoad(false)
      })
    }
  }, [])

  function refetchBCV() {
    setBcvLoad(true)
    fetchTasaBCV().then(t => {
      if (t) { setTasaTemp(String(t)); showToast(`Tasa: Bs ${t}`) }
      else showToast('Sin conexión al BCV')
      setBcvLoad(false)
    })
  }

  // ── Helpers de estado ────────────────────────────────────────────────────────
  function confirmarTasa() {
    const t = parseFloat(tasaTemp.replace(',','.'))
    if (!t||t<50||t>5000) { showToast('Tasa inválida'); return }
    const nueva = {...data, tasa:t}
    setData(nueva); guardarData(nueva); go('home')
  }

  function setIngreso(campo, valor) {
    const nueva = {...data, ingresos:{...data.ingresos,[campo]:valor}}
    setData(nueva); guardarData(nueva)
  }

  function _commitGasto(g) {
    const nueva = {...data, gastos:[...data.gastos,{...g, concepto: capitalizar(g.concepto), id:Date.now()+Math.random()}]}
    setData(nueva); guardarData(nueva)
    return nueva
  }

  function agregarGasto(forzar=false) {
    const c = gasto.concepto.trim()
    if (!c||!gasto.monto) { showToast('Completa el gasto'); return }
    if (!forzar) {
      const dup = data.gastos.find(g=>g.concepto.toLowerCase()===c.toLowerCase()&&g.monto===gasto.monto&&g.moneda===gasto.moneda)
      if (dup) {
        setConfirm({msg:`¿Segura, Arcelia? "${c}" ya está anotado hoy.`,onYes:()=>{setConfirm(null);agregarGasto(true)}})
        return
      }
    }
    _commitGasto(gasto)
    setGasto({concepto:'',monto:'',moneda:'BS',categoria:'insumos'})
    go('gastos'); showToast('Gasto guardado')
  }

  function commitPendGastos() {
    let d = data
    for (const g of pendGastos) d={...d,gastos:[...d.gastos,{...g,id:Date.now()+Math.random()}]}
    setData(d); guardarData(d)
    setPendGastos([]); go('gastos')
    showToast(`${pendGastos.length} gastos guardados`)
  }

  function eliminarGasto(id) {
    const nueva={...data,gastos:data.gastos.filter(g=>g.id!==id)}
    setData(nueva); guardarData(nueva)
  }

  function cerrarCaja() {
    const nueva={...data,cerrada:true}
    setData(nueva); guardarData(nueva)
    archivarData(nueva); setHistorial(cargarHistorial())
    setConfetti(true); setTimeout(()=>setConfetti(false),3500)
    showToast('¡Caja cerrada!')
  }

  // ── OCR con IA ─────────────────────────────────────────────────────────────────
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

      setOcrRes({
        campos,
        tasa: resultado.tasa || 0,
        cierreTotal: resultado.cierre_total || 0,
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

  function aplicarOCR(cerrar = false) {
    const nuevos = { ...data.ingresos }
    for (const [k, v] of Object.entries(ocrRes.campos)) {
      if (v) nuevos[k] = String(v)
    }
    const tasaNueva = ocrRes.tasa > 50 ? ocrRes.tasa : data.tasa
    let nueva = { ...data, ingresos: nuevos, tasa: tasaNueva }
    if (cerrar) {
      nueva.cerrada = true
      archivarData(nueva)
      setHistorial(cargarHistorial())
      setConfetti(true); setTimeout(() => setConfetti(false), 3500)
    }
    setData(nueva); guardarData(nueva)
    setTasaTemp(String(tasaNueva))
    setOcrRes(null)
    go(cerrar ? 'cierre' : 'ingresos')
    showToast(cerrar ? 'Cierre aplicado correctamente' : 'Valores cargados')
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
              showToast('La IA no pudo interpretar. Intenta de nuevo.')
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
    msg+=`\n✅ *NETO: ${fUSD(net)}* (${fBS(net*t)})\n_Cashipop · Andino Pop_`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank')
  }

  // ─────────────────────────────────────────────────────────────────────────────
  if (!data) return (
    <div style={{minHeight:'100svh',background:T.bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14}}>
      <RefreshCw size={30} color={T.cobalt} strokeWidth={1.75} style={{animation:'spin 1s linear infinite'}}/>
      <p style={{fontSize:15,fontWeight:600,color:T.sub}}>{bcvLoad?'Consultando BCV...':'Iniciando...'}</p>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
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
    const { campos, tasa: tasaDetectada, cierreTotal } = ocrRes
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
    let sumaDetectada = 0
    for (const [k, v] of Object.entries(campos)) {
      if (k === 'cuentas_cobrar') continue
      sumaDetectada += esUSD(k) ? v : v / tasaCalc
    }
    const coincide = cierreTotal > 0 && Math.abs(sumaDetectada - cierreTotal) < 2

    return (
      <div style={{minHeight:'100svh',background:T.bg,padding:'32px 20px 100px',overflowY:'auto'}}>
        <InnerHeader title="Validar cierre" onBack={()=>{setOcrRes(null);go('ingresos')}}/>
        <p style={{fontSize:14,color:T.sub,marginBottom:22}}>Revisa los valores que detecte en la libreta</p>

        {/* Tasa detectada */}
        {tasaDetectada > 0 && (
          <Card style={{marginBottom:12,background:T.cobaltLight,border:`1px solid ${T.cobalt}22`,display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px'}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <DollarSign size={16} color={T.cobalt} strokeWidth={1.75}/>
              <span style={{fontSize:14,fontWeight:700,color:T.cobalt}}>Tasa detectada</span>
            </div>
            <span style={{fontSize:22,fontWeight:900,color:T.navy}}>Bs {tasaDetectada}</span>
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

        {/* Validación de total */}
        {cierreTotal > 0 && (
          <Card style={{
            marginBottom:20,
            background: coincide ? T.forestLight : T.amberLight,
            border: `1px solid ${coincide ? T.forest : T.amber}22`,
          }}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <p style={{fontSize:12,fontWeight:700,color:coincide?T.forest:T.amber,letterSpacing:'.06em'}}>
                  {coincide ? 'TOTAL VERIFICADO' : 'DIFERENCIA DETECTADA'}
                </p>
                <p style={{fontSize:13,color:T.sub,marginTop:4}}>
                  Suma calculada: {fUSD(sumaDetectada)}
                </p>
              </div>
              <div style={{textAlign:'right'}}>
                <p style={{fontSize:11,color:T.muted}}>Total libreta</p>
                <p style={{fontSize:20,fontWeight:900,color:coincide?T.forest:T.amber}}>{fUSD(cierreTotal)}</p>
              </div>
            </div>
            {coincide && (
              <div style={{display:'flex',alignItems:'center',gap:6,marginTop:12}}>
                <CheckCircle size={14} color={T.forest} strokeWidth={1.75}/>
                <span style={{fontSize:12,fontWeight:600,color:T.forest}}>Los numeros coinciden</span>
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
  if (pantalla === 'confirmarVoz') return (
    <div style={{minHeight:'100svh',background:T.bg,padding:'32px 20px 100px',overflowY:'auto'}}>
      <InnerHeader title="Confirmar gastos" onBack={()=>{setPendGastos([]);go('gastos')}}/>
      <p style={{fontSize:14,color:T.sub,marginBottom:22}}>¿Esto es correcto?</p>
      <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:28}}>
        {pendGastos.map((g,i)=>(
          <Card key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px'}}>
            <div style={{flex:1,minWidth:0}}>
              <span style={{fontSize:15,fontWeight:700,color:T.navy}}>{g.concepto}</span>
              {g.bsOrig != null && g.bsOrig > 0 && (
                <p style={{fontSize:12,color:T.muted,marginTop:4,fontWeight:500}}>
                  {fBS(g.bsOrig)} ÷ {data?.tasa}
                </p>
              )}
            </div>
            <div style={{textAlign:'right',flexShrink:0}}>
              <span style={{fontSize:20,fontWeight:900,color:T.cobalt,letterSpacing:'-.02em'}}>
                {fUSD(g.monto)}
              </span>
            </div>
          </Card>
        ))}
      </div>
      <div style={{display:'flex',gap:10}}>
        <Btn onClick={()=>{setPendGastos([]);go('gastos')}} bg={T.border} color={T.navy} style={{flex:1}} icon={X}>Cancelar</Btn>
        <Btn onClick={commitPendGastos} bg={T.forest} style={{flex:1}} icon={CheckCircle}>Guardar todo</Btn>
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════════
  // INGRESOS (pantalla interior, no en nav)
  // ══════════════════════════════════════════════════════════
  if (pantalla === 'ingresos') {
    const mic=c=>campoVoz===`ing:${c}`
    const row=(campo,label,Icon,moneda='BS',dimmed=false)=>(
      <CampoMonto label={label} value={ing[campo]} onChange={v=>setIngreso(campo,v)} moneda={moneda} icon={Icon} micActive={mic(campo)} onMic={()=>iniciarVozSimple(`ing:${campo}`)} dimmed={dimmed}/>
    )
    return (
      <div style={{minHeight:'100svh',background:T.bg,padding:'32px 20px 40px',overflowY:'auto'}}>
        <InnerHeader title="Ingresos del día" onBack={()=>go('home')}/>
        <div style={{display:'flex',justifyContent:'flex-end',marginBottom:18,marginTop:-10}}>
          <div style={{textAlign:'right'}}>
            <p style={{fontSize:10,color:T.muted,fontWeight:700,letterSpacing:'.08em'}}>TOTAL HOY</p>
            <p style={{fontSize:20,fontWeight:900,color:T.forest,letterSpacing:'-.02em'}}>{fUSD(tUSD)}</p>
          </div>
        </div>

        {/* OCR */}
        <Card onClick={()=>fileRef.current?.click()} style={{marginBottom:24,background:`linear-gradient(135deg,#1e3a5f,${T.cobalt})`,border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:14,padding:'18px 20px',borderRadius:24}}>
          <div style={{width:46,height:46,borderRadius:13,background:'rgba(255,255,255,0.14)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <Camera size={22} color='#fff' strokeWidth={1.75}/>
          </div>
          <div>
            <p style={{fontSize:14,fontWeight:700,color:'#fff'}}>Subir foto del cuaderno</p>
            <p style={{fontSize:12,color:'rgba(255,255,255,0.6)',marginTop:2}}>Extraigo los valores automáticamente</p>
          </div>
          <ChevronRight size={16} color='rgba(255,255,255,0.4)' style={{marginLeft:'auto'}}/>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={e=>e.target.files[0]&&procesarFoto(e.target.files[0])}/>
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
        <p style={{fontSize:12,color:T.muted,marginBottom:32,paddingLeft:4,lineHeight:1.5}}>Registrado pero no incluido en el total del día.</p>
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
      <Card style={{marginBottom:20,background:campoVoz==='g:multiple'?'#0F172A':procesandoVoz?T.cobaltLight:transcriptFinal?T.forestLight:T.cobaltLight,border:`1px solid ${campoVoz==='g:multiple'?'rgba(255,255,255,0.1)':T.cobalt}22`,transition:'all .3s'}}>

        {/* ── Estado: Grabando ── */}
        {campoVoz === 'g:multiple' ? (
          <>
            {/* Ondas de audio */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:3,height:40,marginBottom:16}}>
              {[0,1,2,3,4,5,6].map(i => (
                <div key={i} style={{width:4,borderRadius:2,background:'#EF4444',animation:`wave .8s ${i*0.1}s ease-in-out infinite alternate`}}/>
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
            <Label>DICTADO RAPIDO</Label>
            <p style={{fontSize:13,color:T.sub,marginBottom:14,lineHeight:1.5}}>
              Dicta tus gastos y la IA los separa automaticamente
            </p>
            <Btn onClick={()=>iniciarVoz('g:multiple')} bg={T.cobalt} full icon={Mic} style={{fontSize:14,padding:'16px'}}>
              Iniciar dictado por voz
            </Btn>
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
      <Confirm msg={confirm?.msg} onYes={confirm?.onYes} onNo={()=>setConfirm(null)}/>
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
          <h1 style={{fontSize:25,fontWeight:900,color:T.navy,letterSpacing:'-.03em',lineHeight:1.15,marginTop:3}}>Andino Pop</h1>
        </div>
        {/* Acciones terciarias: WA + Tasa */}
        <div style={{display:'flex',alignItems:'center',gap:8,marginTop:2}}>
          <WaBtn onClick={()=>enviarResumen()}/>
          <button onClick={()=>go('tasa')} style={{background:T.amberLight,border:`1px solid ${T.amber}22`,borderRadius:13,padding:'7px 12px',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:1,WebkitTapHighlightColor:'transparent'}}>
            <span style={{fontSize:9,fontWeight:700,color:T.amber,letterSpacing:'.08em'}}>TASA BCV</span>
            <span style={{fontSize:18,fontWeight:900,color:T.amber,letterSpacing:'-.02em'}}>Bs {data.tasa}</span>
          </button>
        </div>
      </div>

      {/* Tarjeta neto — gradiente oscuro */}
      <div style={{background:'linear-gradient(145deg,#0F2027,#1a3a4c)',borderRadius:32,padding:'30px 26px',marginBottom:16,boxShadow:'0 16px 48px rgba(0,0,0,0.18)'}}>
        <p style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.4)',letterSpacing:'.1em'}}>NETO DEL DÍA</p>
        <p style={{fontSize:42,fontWeight:900,color:'#fff',letterSpacing:'-.035em',lineHeight:1,marginTop:8}}>{fUSD(neto)}</p>
        <p style={{fontSize:13,color:'rgba(255,255,255,0.3)',marginTop:7}}>{fBS(neto*data.tasa)}</p>
        {cc>0&&<p style={{fontSize:12,color:'rgba(255,200,100,0.65)',marginTop:6}}>+ {fUSD(cc)} pendiente por cobrar</p>}
      </div>

      {/* Mini cards ingresos / gastos */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:20}}>
        <Card style={{background:T.forestLight,border:`1px solid ${T.forest}22`,padding:'18px'}}>
          <TrendingUp size={16} color={T.forest} strokeWidth={1.75}/>
          <p style={{fontSize:10,fontWeight:700,color:T.forest,marginTop:8,letterSpacing:'.06em'}}>INGRESOS</p>
          <p style={{fontSize:19,fontWeight:900,color:T.navy,marginTop:3,letterSpacing:'-.02em'}}>{fUSD(tUSD)}</p>
        </Card>
        <Card style={{background:T.roseLight,border:`1px solid ${T.rose}22`,padding:'18px'}}>
          <TrendingDown size={16} color={T.rose} strokeWidth={1.75}/>
          <p style={{fontSize:10,fontWeight:700,color:T.rose,marginTop:8,letterSpacing:'.06em'}}>GASTOS</p>
          <p style={{fontSize:19,fontWeight:900,color:T.navy,marginTop:3,letterSpacing:'-.02em'}}>{fUSD(tGas)}</p>
        </Card>
      </div>

      {/* CTA principal: Registrar Gasto */}
      <button onClick={()=>go('nuevoGasto')} style={{
        background:T.navy, color:'#fff', border:'none',
        borderRadius:20, padding:'22px 20px', width:'100%',
        fontSize:17, fontWeight:800, letterSpacing:'-.01em',
        cursor:'pointer', display:'flex', alignItems:'center',
        justifyContent:'center', gap:12,
        boxShadow:'0 6px 0 rgba(0,0,0,0.28)',
        WebkitTapHighlightColor:'transparent',
        transition:'transform .08s, box-shadow .08s',
      }}
        onPointerDown={e=>{e.currentTarget.style.transform='translateY(4px)';e.currentTarget.style.boxShadow='0 2px 0 rgba(0,0,0,0.28)'}}
        onPointerUp={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='0 6px 0 rgba(0,0,0,0.28)'}}
        onPointerLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='0 6px 0 rgba(0,0,0,0.28)'}}
      >
        <Mic size={20} strokeWidth={1.75}/>
        Registrar Gasto
        <Camera size={20} strokeWidth={1.75}/>
      </button>

      <BottomNav pantalla={pantalla} go={go}/>
      <Confetti active={confetti}/><Toast msg={toast}/>
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
                    <button onClick={()=>eliminarGasto(g.id)} style={{background:T.roseLight,border:'none',borderRadius:10,width:34,height:34,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',WebkitTapHighlightColor:'transparent'}}>
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
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════
  // CIERRE (tab)
  // ══════════════════════════════════════════════════════════
  if (pantalla === 'cierre') {
    const lineas=[
      {key:'bicentenario',label:'Bicentenario',         Icon:Landmark,   moneda:'BS'},
      {key:'bancaribe',   label:'Bancaribe',             Icon:Landmark,   moneda:'BS'},
      {key:'banesco',     label:'Banesco',               Icon:Landmark,   moneda:'BS'},
      {key:'bancamiga',   label:'Bancamiga',             Icon:Landmark,   moneda:'BS'},
      {key:'pagos_dia',   label:'Pagos del día',         Icon:CreditCard, moneda:'BS'},
      {key:'efectivo_bs', label:'Efectivo',              Icon:Banknote,   moneda:'BS'},
      {key:'delivery',    label:'Delivery',              Icon:Bike,       moneda:'BS'},
      {key:'pedidosya_usd',label:'Pedidos Ya Prepago',   Icon:Package,    moneda:'USD'},
      {key:'pedidosya_bs', label:'Pedidos Ya Efectivo',  Icon:Bike,       moneda:'BS'},
      {key:'divisas_usd', label:'Divisas',               Icon:DollarSign, moneda:'USD'},
    ].filter(c=>n(ing[c.key])>0)

    return (
      <div style={{minHeight:'100svh',background:T.bg,padding:'52px 20px 96px',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
          <h2 style={{fontSize:22,fontWeight:800,color:T.navy,letterSpacing:'-.025em'}}>Cierre de Caja</h2>
          <WaBtn onClick={()=>enviarResumen()}/>
        </div>
        <p style={{fontSize:12,color:T.muted,marginBottom:24,letterSpacing:'.02em'}}>{fDate(data.fecha)}  ·  Tasa Bs {data.tasa}</p>

        {/* Tarjeta resumen principal */}
        <div style={{background:'linear-gradient(145deg,#0F2027,#1a3a4c)',borderRadius:32,padding:'28px 24px',marginBottom:18,boxShadow:'0 16px 48px rgba(0,0,0,0.18)'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div>
              <p style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.4)',letterSpacing:'.08em'}}>INGRESOS</p>
              <p style={{fontSize:21,fontWeight:900,color:'#6EE7B7',marginTop:5,letterSpacing:'-.02em'}}>{fUSD(tUSD)}</p>
            </div>
            <div>
              <p style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.4)',letterSpacing:'.08em'}}>GASTOS</p>
              <p style={{fontSize:21,fontWeight:900,color:'#FCA5A5',marginTop:5,letterSpacing:'-.02em'}}>{fUSD(tGas)}</p>
            </div>
          </div>
          <div style={{borderTop:'1px solid rgba(255,255,255,0.1)',paddingTop:18,marginTop:18}}>
            <p style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.4)',letterSpacing:'.08em'}}>NETO FINAL</p>
            <p style={{fontSize:42,fontWeight:900,color:'#fff',letterSpacing:'-.035em',lineHeight:1.1,marginTop:8}}>{fUSD(neto)}</p>
            <p style={{fontSize:13,color:'rgba(255,255,255,0.3)',marginTop:6}}>{fBS(neto*data.tasa)}</p>
          </div>
          {cc>0&&<div style={{marginTop:14,paddingTop:14,borderTop:'1px solid rgba(255,200,100,0.15)'}}>
            <p style={{fontSize:12,color:'rgba(255,200,100,0.55)',fontWeight:600}}>POR COBRAR (no incluido): {fUSD(cc)}</p>
          </div>}
        </div>

        {lineas.length>0&&(
          <>
            <Label>DESGLOSE DE INGRESOS</Label>
            <Card style={{marginBottom:18,borderRadius:28}}>
              {lineas.map(({key,label,Icon,moneda},i)=>{
                const val=n(ing[key]); const usdV=moneda==='USD'?val:val/data.tasa
                return(
                  <div key={key}>
                    {i>0&&<Sep/>}
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div style={{width:32,height:32,borderRadius:9,background:T.cobaltLight,display:'flex',alignItems:'center',justifyContent:'center'}}>
                          <Icon size={15} color={T.cobalt} strokeWidth={1.75}/>
                        </div>
                        <span style={{fontSize:13,fontWeight:600,color:T.sub}}>{label}</span>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <p style={{fontSize:15,fontWeight:800,color:T.navy}}>{moneda==='USD'?fUSD(val):fBS(val)}</p>
                        <p style={{fontSize:11,color:T.muted}}>{fUSD(usdV)}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </Card>
          </>
        )}

        {cc>0&&(
          <>
            <Label>PENDIENTE POR COBRAR</Label>
            <Card style={{marginBottom:18,background:T.amberLight,border:`1px solid ${T.amber}22`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div style={{display:'flex',alignItems:'center',gap:9}}>
                  <AlertCircle size={16} color={T.amber} strokeWidth={1.75}/>
                  <span style={{fontSize:14,fontWeight:600,color:T.amber}}>Cuentas por cobrar</span>
                </div>
                <div style={{textAlign:'right'}}>
                  <p style={{fontSize:17,fontWeight:800,color:T.amber}}>{fUSD(cc)}</p>
                  <p style={{fontSize:11,color:T.amber+'88'}}>No incluido</p>
                </div>
              </div>
            </Card>
          </>
        )}

        {data.gastos.length>0&&(
          <>
            <Label>DESGLOSE DE GASTOS</Label>
            <Card style={{marginBottom:22,borderRadius:28}}>
              {data.gastos.map((g,i)=>{
                const cat=CATS.find(c=>c.id===g.categoria); const enUSD=n(g.monto)*(g.moneda==='USD'?1:1/data.tasa)
                return(
                  <div key={g.id}>
                    {i>0&&<Sep/>}
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div>
                        <p style={{fontSize:14,fontWeight:600,color:T.navy}}>{g.concepto}</p>
                        <p style={{fontSize:12,fontWeight:600,color:cat?.c||T.muted,marginTop:2}}>{cat?.label}</p>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <p style={{fontSize:15,fontWeight:800,color:T.rose}}>{g.moneda==='USD'?fUSD(g.monto):fBS(g.monto)}</p>
                        <p style={{fontSize:11,color:T.muted}}>{fUSD(enUSD)}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </Card>
          </>
        )}

        {!data.cerrada?(
          <Btn onClick={cerrarCaja} bg={T.navy} full icon={Lock} style={{padding:'16px',fontSize:14,boxShadow:'0 4px 0 rgba(0,0,0,0.25)'}}>
            Cerrar Caja del Día
          </Btn>
        ):(
          <Card style={{background:T.forestLight,textAlign:'center',padding:20,borderRadius:24}}>
            <CheckCircle size={26} color={T.forest} strokeWidth={1.75} style={{margin:'0 auto'}}/>
            <p style={{fontSize:15,fontWeight:700,color:T.forest,marginTop:8}}>Caja cerrada</p>
          </Card>
        )}

        <BottomNav pantalla={pantalla} go={go}/>
        <Confetti active={confetti}/><Toast msg={toast}/>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════
  // HISTORIAL (tab)
  // ══════════════════════════════════════════════════════════
  if (pantalla === 'historial') {
    // detalle de un día
    if (histItem) {
      const hi=histItem; const tu2=totalUSD(hi.ingresos,hi.tasa); const tg2=totalGastosUSD(hi.gastos,hi.tasa); const net2=tu2-tg2
      return (
        <div style={{minHeight:'100svh',background:T.bg,padding:'32px 20px 96px',overflowY:'auto'}}>
          <InnerHeader title={fDate(hi.fecha)} onBack={()=>setHistItem(null)}/>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
            <WaBtn onClick={()=>enviarResumen(hi)}/>
          </div>
          <div style={{background:'linear-gradient(145deg,#0F2027,#1a3a4c)',borderRadius:28,padding:'24px',marginBottom:18,boxShadow:'0 12px 40px rgba(0,0,0,0.15)'}}>
            <p style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.4)',letterSpacing:'.08em'}}>NETO</p>
            <p style={{fontSize:36,fontWeight:900,color:'#fff',letterSpacing:'-.03em',marginTop:6}}>{fUSD(net2)}</p>
            <p style={{fontSize:13,color:'rgba(255,255,255,0.3)',marginTop:4}}>{fBS(net2*hi.tasa)}</p>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:18}}>
            <Card style={{background:T.forestLight,padding:'16px'}}>
              <p style={{fontSize:10,fontWeight:700,color:T.forest}}>INGRESOS</p>
              <p style={{fontSize:18,fontWeight:900,color:T.navy,marginTop:4}}>{fUSD(tu2)}</p>
            </Card>
            <Card style={{background:T.roseLight,padding:'16px'}}>
              <p style={{fontSize:10,fontWeight:700,color:T.rose}}>GASTOS</p>
              <p style={{fontSize:18,fontWeight:900,color:T.navy,marginTop:4}}>{fUSD(tg2)}</p>
            </Card>
          </div>
          {hi.gastos.length>0&&(
            <>
              <Label>GASTOS</Label>
              <Card style={{borderRadius:24}}>
                {hi.gastos.map((g,i)=>(
                  <div key={g.id||i}>
                    {i>0&&<Sep/>}
                    <div style={{display:'flex',justifyContent:'space-between'}}>
                      <p style={{fontSize:14,fontWeight:600,color:T.navy}}>{g.concepto}</p>
                      <p style={{fontSize:14,fontWeight:800,color:T.rose}}>{g.moneda==='USD'?fUSD(g.monto):fBS(g.monto)}</p>
                    </div>
                  </div>
                ))}
              </Card>
            </>
          )}
          <BottomNav pantalla={pantalla} go={go}/>
        </div>
      )
    }

    // Lista de días
    return (
      <div style={{minHeight:'100svh',background:T.bg,padding:'52px 20px 96px',overflowY:'auto'}}>
        <h2 style={{fontSize:22,fontWeight:800,color:T.navy,letterSpacing:'-.025em',marginBottom:24}}>Historial</h2>

        {historial.length===0?(
          <Card style={{textAlign:'center',padding:48,borderRadius:32}}>
            <CalendarDays size={34} color={T.muted} strokeWidth={1.5} style={{margin:'0 auto'}}/>
            <p style={{fontSize:15,fontWeight:700,color:T.navy,marginTop:14}}>Sin registros anteriores</p>
            <p style={{fontSize:13,color:T.sub,marginTop:6}}>Los cierres del día aparecerán aquí</p>
          </Card>
        ):(
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {historial.map((h,i)=>{
              const tu2=totalUSD(h.ingresos,h.tasa); const tg2=totalGastosUSD(h.gastos,h.tasa); const net2=tu2-tg2
              return(
                <Card key={i} onClick={()=>setHistItem(h)} style={{cursor:'pointer',borderRadius:22,padding:'18px 20px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <p style={{fontSize:14,fontWeight:700,color:T.navy}}>{fDate(h.fecha)}</p>
                      <p style={{fontSize:12,color:T.muted,marginTop:3}}>Tasa Bs {h.tasa}  ·  {h.gastos.length} gasto(s)</p>
                    </div>
                    <div style={{textAlign:'right',display:'flex',alignItems:'center',gap:10}}>
                      <div>
                        <p style={{fontSize:18,fontWeight:900,color:net2>=0?T.forest:T.rose,letterSpacing:'-.02em'}}>{fUSD(net2)}</p>
                        {h.cerrada&&<p style={{fontSize:10,fontWeight:700,color:T.forest,letterSpacing:'.04em',marginTop:2}}>CERRADA</p>}
                      </div>
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
