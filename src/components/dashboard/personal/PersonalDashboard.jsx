import { useState, useMemo } from 'react'
import {
  TrendingUp, TrendingDown, Wallet, PieChart as PieIcon,
  Plus, ArrowUpRight, ArrowDownRight, Receipt, Settings,
} from 'lucide-react'
import { T } from '../../../lib/theme'
import { formatMoney, fUSD, normMonto, n } from '../../../lib/helpers'
import Card from '../../ui/Card'
import Button from '../../ui/Button'
import BottomNav from '../../ui/BottomNav'

export default function PersonalDashboard({ profile, onSettings }) {
  const [pantalla, setPantalla] = useState('home')
  const [transactions, setTransactions] = useState([])
  const [form, setForm] = useState({ concepto: '', monto: '', tipo: 'gasto', categoria: '' })
  const [showForm, setShowForm] = useState(false)

  const activeCategories = useMemo(() =>
    (profile.categories || []).filter(c => c.active),
    [profile.categories]
  )

  const salary = n(profile.salary || 0)
  const extrasTotal = (profile.extras || []).reduce((s, e) => s + n(e.amount), 0)
  const totalIncome = salary + extrasTotal

  const fixedExpensesTotal = (profile.fixedExpenses || []).reduce((s, e) => s + n(e.amount), 0)

  const variableExpenses = transactions
    .filter(t => t.tipo === 'gasto')
    .reduce((s, t) => s + n(t.monto), 0)

  const balance = totalIncome - fixedExpensesTotal - variableExpenses

  function addTransaction() {
    if (!form.concepto.trim() || !form.monto) return
    setTransactions([
      { id: Date.now(), ...form, fecha: new Date().toISOString().split('T')[0] },
      ...transactions,
    ])
    setForm({ concepto: '', monto: '', tipo: 'gasto', categoria: '' })
    setShowForm(false)
  }

  return (
    <div style={{ minHeight: '100svh', background: T.bg, paddingBottom: 90 }}>
      {/* Header */}
      <div style={{ padding: '24px 20px 20px' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: T.sub, marginBottom: 4 }}>Balance personal</p>
        <h1 style={{ fontSize: 36, fontWeight: 900, color: balance >= 0 ? T.forest : T.rose, letterSpacing: '-.03em' }}>
          {balance >= 0 ? '' : '- '}$ {formatMoney(Math.abs(balance))}
        </h1>
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
          <p style={{ fontSize: 20, fontWeight: 900, color: T.forest }}>{fUSD(totalIncome)}</p>
        </Card>

        <Card style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: T.roseLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowDownRight size={16} color={T.rose} strokeWidth={2} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Gastos</span>
          </div>
          <p style={{ fontSize: 20, fontWeight: 900, color: T.rose }}>{fUSD(fixedExpensesTotal + variableExpenses)}</p>
        </Card>
      </div>

      {/* Fixed vs Variable Breakdown */}
      <div style={{ padding: '0 20px', marginBottom: 20 }}>
        <Card>
          <p style={{ fontSize: 12, fontWeight: 700, color: T.muted, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>
            Desglose de gastos
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.navy }}>Gastos fijos</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: T.navy }}>{fUSD(fixedExpensesTotal)}</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: T.bg, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 3, background: T.cobalt,
                  width: totalIncome > 0 ? `${Math.min((fixedExpensesTotal / totalIncome) * 100, 100)}%` : '0%',
                  transition: 'width .3s ease',
                }} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.navy }}>Gastos variables</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: T.navy }}>{fUSD(variableExpenses)}</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: T.bg, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 3, background: T.amber,
                  width: totalIncome > 0 ? `${Math.min((variableExpenses / totalIncome) * 100, 100)}%` : '0%',
                  transition: 'width .3s ease',
                }} />
              </div>
            </div>
          </div>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.navy }}>Disponible</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: balance >= 0 ? T.forest : T.rose }}>{fUSD(balance)}</span>
            </div>
          </div>
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
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 14, fontWeight: 700, color: T.muted }}>$</span>
                <input type="text" inputMode="decimal" value={form.monto} onChange={e => setForm({ ...form, monto: normMonto(e.target.value) })} placeholder="0,00"
                  style={{ width: '100%', paddingLeft: 30, height: 46, fontSize: 16, fontWeight: 800, border: `1.5px solid ${T.border}`, borderRadius: 12, background: T.bg, color: T.navy, outline: 'none' }} />
              </div>
              {activeCategories.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {activeCategories.map(c => (
                    <button key={c.id} onClick={() => setForm({ ...form, categoria: c.name })}
                      style={{
                        padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        border: form.categoria === c.name ? `1.5px solid ${T.cobalt}` : `1.5px solid ${T.border}`,
                        background: form.categoria === c.name ? T.cobaltLight : T.surface,
                        color: form.categoria === c.name ? T.cobalt : T.sub,
                      }}>
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
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
                    {t.categoria && <span style={{ fontSize: 11, fontWeight: 600, color: T.muted }}>{t.categoria}</span>}
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 800, color: t.tipo === 'gasto' ? T.rose : T.forest }}>
                    {t.tipo === 'gasto' ? '-' : '+'} {fUSD(n(t.monto))}
                  </span>
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
