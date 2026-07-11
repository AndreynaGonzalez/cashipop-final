import { useState, useEffect, useMemo } from 'react'
import {
  TrendingUp, TrendingDown, DollarSign, Package, Truck,
  BarChart3, ArrowUpRight, ArrowDownRight, Receipt, RefreshCw,
  Lightbulb, Plus, UtensilsCrossed, Settings,
} from 'lucide-react'
import { T } from '../../../lib/theme'
import { formatMoney, fUSD, fBS, toUSD, normMonto, n, redondear } from '../../../lib/helpers'
import { fetchTasaBCV, getCachedTasa, cacheTasa } from '../../../lib/bcv'
import { agruparConceptos, normConcepto } from '../../../lib/fuzzy'
import Card from '../../ui/Card'
import Button from '../../ui/Button'
import BottomNav from '../../ui/BottomNav'

export default function BusinessDashboard({ profile, onSettings }) {
  const [pantalla, setPantalla] = useState('home')
  const [tasa, setTasa] = useState(getCachedTasa())
  const [tasaLoading, setTasaLoading] = useState(false)
  const [transactions, setTransactions] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ concepto: '', monto: '', moneda: 'USD', categoria: 'Insumos' })

  useEffect(() => {
    refreshTasa()
  }, [])

  async function refreshTasa() {
    setTasaLoading(true)
    const rate = await fetchTasaBCV()
    if (rate) { setTasa(rate); cacheTasa(rate) }
    setTasaLoading(false)
  }

  const suppliers = profile.suppliers || []
  const menuItems = profile.menuItems || []
  const inventory = profile.inventory || {}

  const totalGastos = transactions
    .filter(t => t.tipo === 'gasto')
    .reduce((s, t) => s + toUSD(n(t.monto), t.moneda, tasa), 0)

  const totalIngresos = transactions
    .filter(t => t.tipo === 'ingreso')
    .reduce((s, t) => s + toUSD(n(t.monto), t.moneda, tasa), 0)

  const balance = totalIngresos - totalGastos

  const grouped = useMemo(() =>
    agruparConceptos(transactions.filter(t => t.tipo === 'gasto'), tasa, toUSD),
    [transactions, tasa]
  )

  function addTransaction() {
    if (!form.concepto.trim() || !form.monto) return
    const categoria = form.categoria || detectCategory(form.concepto)
    setTransactions([
      { id: Date.now(), ...form, categoria, tipo: 'gasto', fecha: new Date().toISOString().split('T')[0] },
      ...transactions,
    ])
    setForm({ concepto: '', monto: '', moneda: 'USD', categoria: 'Insumos' })
    setShowForm(false)
  }

  function detectCategory(text) {
    const t = (text || '').toLowerCase()
    if (/carne|pollo|cerdo|res|pescado/.test(t)) return 'Insumos'
    if (/sueldo|salario|personal|empleado/.test(t)) return 'Sueldos'
    if (/luz|agua|gas|internet/.test(t)) return 'Servicios'
    if (/alquiler|renta|arriendo/.test(t)) return 'Alquiler'
    return 'Insumos'
  }

  // Coach tips
  const coachTips = useMemo(() => {
    const tips = []
    if (grouped.length > 0) {
      const top = grouped[0]
      tips.push(`Tu mayor gasto es "${top.name}" con ${fUSD(top.value)} (${top.count} compras)`)
    }
    if (totalGastos > 0 && totalIngresos > 0) {
      const margin = ((totalIngresos - totalGastos) / totalIngresos * 100).toFixed(1)
      tips.push(`Margen actual: ${margin}%${Number(margin) < 20 ? ' - considera revisar costos' : ''}`)
    }
    if (suppliers.length > 0 && grouped.length > 0) {
      tips.push(`Tienes ${suppliers.length} proveedores registrados. Compara precios para optimizar costos.`)
    }
    return tips
  }, [grouped, totalGastos, totalIngresos, suppliers.length])

  return (
    <div style={{ minHeight: '100svh', background: T.bg, paddingBottom: 90 }}>
      {/* Header with BCV */}
      <div style={{ padding: '24px 20px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: T.sub, marginBottom: 4 }}>Balance del negocio</p>
            <h1 style={{ fontSize: 36, fontWeight: 900, color: balance >= 0 ? T.forest : T.rose, letterSpacing: '-.03em' }}>
              {balance >= 0 ? '' : '- '}$ {formatMoney(Math.abs(balance))}
            </h1>
          </div>
          <button onClick={refreshTasa} disabled={tasaLoading} style={{
            padding: '8px 14px', borderRadius: 12, border: `1.5px solid ${T.border}`,
            background: T.surface, display: 'flex', alignItems: 'center', gap: 6,
            cursor: 'pointer', opacity: tasaLoading ? 0.5 : 1,
          }}>
            <RefreshCw size={14} color={T.cobalt} strokeWidth={2} style={{ animation: tasaLoading ? 'spin 1s linear infinite' : 'none' }} />
            <span style={{ fontSize: 12, fontWeight: 800, color: T.navy }}>BCV {tasa}</span>
          </button>
        </div>
        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </div>

      {/* Summary Cards */}
      <div style={{ padding: '0 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <Card style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: T.forestLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowUpRight size={16} color={T.forest} strokeWidth={2} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Ingresos</span>
          </div>
          <p style={{ fontSize: 20, fontWeight: 900, color: T.forest }}>{fUSD(totalIngresos)}</p>
        </Card>

        <Card style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: T.roseLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowDownRight size={16} color={T.rose} strokeWidth={2} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Gastos</span>
          </div>
          <p style={{ fontSize: 20, fontWeight: 900, color: T.rose }}>{fUSD(totalGastos)}</p>
        </Card>
      </div>

      {/* Coach Financiero */}
      {coachTips.length > 0 && (
        <div style={{ padding: '0 20px', marginBottom: 20 }}>
          <Card style={{ background: T.amberLight, border: `1px solid ${T.amber}33` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: T.amber, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Lightbulb size={18} color="#fff" strokeWidth={1.75} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, color: T.navy }}>Coach financiero</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {coachTips.map((tip, i) => (
                <p key={i} style={{ fontSize: 13, fontWeight: 600, color: T.navy, lineHeight: 1.5, paddingLeft: 12, borderLeft: `3px solid ${T.amber}` }}>
                  {tip}
                </p>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Fuzzy Grouped Expenses */}
      {grouped.length > 0 && (
        <div style={{ padding: '0 20px', marginBottom: 20 }}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <BarChart3 size={18} color={T.cobalt} strokeWidth={1.75} />
              <span style={{ fontSize: 14, fontWeight: 800, color: T.navy }}>Gastos por concepto</span>
            </div>
            {grouped.slice(0, 6).map((g, i) => (
              <div key={g.name} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: i < grouped.length - 1 ? 10 : 0 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span className="capitalize" style={{ fontSize: 13, fontWeight: 700, color: T.navy }}>{g.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: T.navy }}>{fUSD(g.value)}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: T.bg, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      background: [T.cobalt, T.forest, T.amber, T.rose, '#7C3AED', T.muted][i % 6],
                      width: `${Math.min((g.value / grouped[0].value) * 100, 100)}%`,
                    }} />
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: T.muted, minWidth: 32, textAlign: 'right' }}>x{g.count}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Business Quick Stats */}
      <div style={{ padding: '0 20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
        <Card style={{ padding: '14px', textAlign: 'center' }}>
          <Truck size={20} color={T.cobalt} strokeWidth={1.5} style={{ margin: '0 auto 6px' }} />
          <p style={{ fontSize: 20, fontWeight: 900, color: T.navy }}>{suppliers.length}</p>
          <p style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase' }}>Proveedores</p>
        </Card>
        <Card style={{ padding: '14px', textAlign: 'center' }}>
          <UtensilsCrossed size={20} color={T.forest} strokeWidth={1.5} style={{ margin: '0 auto 6px' }} />
          <p style={{ fontSize: 20, fontWeight: 900, color: T.navy }}>{menuItems.length}</p>
          <p style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase' }}>Productos</p>
        </Card>
        <Card style={{ padding: '14px', textAlign: 'center' }}>
          <Package size={20} color={T.amber} strokeWidth={1.5} style={{ margin: '0 auto 6px' }} />
          <p style={{ fontSize: 20, fontWeight: 900, color: T.navy }}>
            {Object.values(inventory).reduce((s, a) => s + a.length, 0)}
          </p>
          <p style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase' }}>Insumos</p>
        </Card>
      </div>

      {/* Quick Add */}
      <div style={{ padding: '0 20px', marginBottom: 20 }}>
        {showForm ? (
          <Card style={{ border: `1.5px solid ${T.cobalt}` }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: T.muted, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>
              Registrar gasto
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input type="text" value={form.concepto} onChange={e => setForm({ ...form, concepto: e.target.value })} placeholder="Concepto"
                style={{ width: '100%', height: 46, paddingLeft: 14, fontSize: 14, fontWeight: 600, border: `1.5px solid ${T.border}`, borderRadius: 12, background: T.bg, color: T.navy, outline: 'none' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 14, fontWeight: 700, color: T.muted }}>
                    {form.moneda === 'USD' ? '$' : 'Bs'}
                  </span>
                  <input type="text" inputMode="decimal" value={form.monto} onChange={e => setForm({ ...form, monto: normMonto(e.target.value) })} placeholder="0,00"
                    style={{ width: '100%', paddingLeft: 34, height: 46, fontSize: 16, fontWeight: 800, border: `1.5px solid ${T.border}`, borderRadius: 12, background: T.bg, color: T.navy, outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', borderRadius: 12, overflow: 'hidden', border: `1.5px solid ${T.border}` }}>
                  {['USD', 'BS'].map(m => (
                    <button key={m} onClick={() => setForm({ ...form, moneda: m })}
                      style={{
                        padding: '0 14px', height: 46, fontSize: 12, fontWeight: 800, cursor: 'pointer',
                        background: form.moneda === m ? T.cobalt : T.surface, color: form.moneda === m ? '#fff' : T.sub,
                        border: 'none',
                      }}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
                <Button onClick={() => setShowForm(false)} bg={T.bg} color={T.navy} full style={{ border: `1.5px solid ${T.border}`, boxShadow: 'none' }}>Cancelar</Button>
                <Button onClick={addTransaction} bg={T.forest} full disabled={!form.concepto.trim() || !form.monto}>Guardar</Button>
              </div>
            </div>
          </Card>
        ) : (
          <Button onClick={() => setShowForm(true)} bg={T.cobalt} full icon={Plus}>
            Registrar gasto
          </Button>
        )}
      </div>

      {/* Recent Transactions */}
      {transactions.length > 0 && (
        <div style={{ padding: '0 20px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: T.muted, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 12 }}>
            Ultimos movimientos
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {transactions.slice(0, 10).map(t => (
              <Card key={t.id} style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: t.tipo === 'gasto' ? T.roseLight : T.forestLight,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Receipt size={16} color={t.tipo === 'gasto' ? T.rose : T.forest} strokeWidth={1.75} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p className="capitalize" style={{ fontSize: 14, fontWeight: 700, color: T.navy }}>{t.concepto}</p>
                    <span style={{ fontSize: 11, fontWeight: 600, color: T.muted }}>{t.categoria}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: t.tipo === 'gasto' ? T.rose : T.forest }}>
                      {t.moneda === 'USD' ? fUSD(n(t.monto)) : fBS(n(t.monto))}
                    </span>
                    {t.moneda === 'BS' && (
                      <p style={{ fontSize: 10, fontWeight: 600, color: T.muted }}>
                        ~ {fUSD(toUSD(n(t.monto), 'BS', tasa))}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <BottomNav pantalla={pantalla} go={setPantalla} />
    </div>
  )
}
