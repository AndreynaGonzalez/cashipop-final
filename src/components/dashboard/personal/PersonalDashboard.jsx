import { useState, useMemo } from 'react'
import {
  ArrowUpRight, ArrowDownRight, Receipt, Plus, X, Check,
  Settings, Wallet, Tag,
} from 'lucide-react'
import { T } from '../../../lib/theme'
import { formatMoney, fUSD, normMonto, n } from '../../../lib/helpers'
import Card from '../../ui/Card'
import Button from '../../ui/Button'
import BottomNav from '../../ui/BottomNav'

// ─── Expense Registration Modal ─────────────────────────────────────────────
function GastoModal({ categories, onSave, onClose }) {
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')
  const [categoria, setCategoria] = useState('')

  function handleSave() {
    if (!concepto.trim() || !monto) return
    onSave({ concepto: concepto.trim(), monto, categoria, tipo: 'gasto', fecha: new Date().toISOString().split('T')[0] })
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: T.bg,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 20px 16px', borderBottom: `1px solid ${T.border}`,
      }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: T.navy, letterSpacing: '-.02em' }}>
          Registrar gasto
        </h2>
        <button onClick={onClose} style={{
          width: 40, height: 40, borderRadius: 12, background: T.surface,
          border: `1.5px solid ${T.border}`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer',
        }}>
          <X size={18} color={T.navy} strokeWidth={2} />
        </button>
      </div>

      {/* Form body */}
      <div style={{ flex: 1, padding: '24px 20px', overflow: 'auto' }}>
        {/* Concepto */}
        <div style={{ marginBottom: 20 }}>
          <label style={{
            display: 'block', fontSize: 12, fontWeight: 700, color: T.muted,
            letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8,
          }}>
            Concepto
          </label>
          <input
            type="text" value={concepto}
            onChange={e => setConcepto(e.target.value)}
            placeholder="Que compraste o pagaste"
            autoFocus
            style={{
              width: '100%', height: 52, paddingLeft: 16, fontSize: 16, fontWeight: 600,
              border: `2px solid ${concepto ? T.cobalt : T.border}`, borderRadius: 14,
              background: concepto ? T.cobaltLight : T.surface,
              color: T.navy, outline: 'none', transition: 'all .2s',
            }}
          />
        </div>

        {/* Monto */}
        <div style={{ marginBottom: 24 }}>
          <label style={{
            display: 'block', fontSize: 12, fontWeight: 700, color: T.muted,
            letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8,
          }}>
            Monto
          </label>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)',
              fontSize: 22, fontWeight: 800, color: monto ? T.cobalt : T.muted,
            }}>$</span>
            <input
              type="text" inputMode="decimal" value={monto}
              onChange={e => setMonto(normMonto(e.target.value))}
              placeholder="0,00"
              style={{
                width: '100%', paddingLeft: 44, height: 60, fontSize: 28, fontWeight: 900,
                border: `2px solid ${monto ? T.cobalt : T.border}`, borderRadius: 14,
                background: monto ? T.cobaltLight : T.surface,
                color: T.navy, outline: 'none', letterSpacing: '-.01em',
                transition: 'all .2s',
              }}
            />
          </div>
        </div>

        {/* Categoria */}
        {categories.length > 0 && (
          <div>
            <label style={{
              display: 'block', fontSize: 12, fontWeight: 700, color: T.muted,
              letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10,
            }}>
              Categoria
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {categories.map(c => (
                <button
                  key={c.id} onClick={() => setCategoria(categoria === c.name ? '' : c.name)}
                  style={{
                    padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                    border: categoria === c.name ? `2px solid ${T.cobalt}` : `1.5px solid ${T.border}`,
                    background: categoria === c.name ? T.cobaltLight : T.surface,
                    color: categoria === c.name ? T.cobalt : T.sub,
                    transition: 'all .15s',
                  }}
                >
                  <span className="capitalize">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div style={{
        padding: '16px 20px env(safe-area-inset-bottom, 20px)',
        borderTop: `1px solid ${T.border}`, background: T.bg,
      }}>
        <Button
          onClick={handleSave}
          bg={T.forest} full
          disabled={!concepto.trim() || !monto}
          icon={Check}
        >
          Guardar gasto
        </Button>
      </div>
    </div>
  )
}

// ─── Personal Dashboard ──────────────────────────────────────────────────────
export default function PersonalDashboard({ profile, onSettings }) {
  const [pantalla, setPantalla] = useState('home')
  const [transactions, setTransactions] = useState([])
  const [showGastoModal, setShowGastoModal] = useState(false)

  const activeCategories = useMemo(() =>
    (profile.categories || []).filter(c => c.active),
    [profile.categories]
  )

  // Income from onboarding
  const salary = n(profile.salary || 0)
  const extrasEstimated = n(profile.extrasEstimated || 0)
  const totalIncome = salary + extrasEstimated

  // Fixed expenses from onboarding
  const fixedExpensesList = (profile.fixedExpenses || []).filter(e => n(e.amount) > 0)
  const fixedExpensesTotal = fixedExpensesList.reduce((s, e) => s + n(e.amount), 0)

  // Variable expenses from transactions
  const variableExpenses = transactions
    .filter(t => t.tipo === 'gasto')
    .reduce((s, t) => s + n(t.monto), 0)

  const totalExpenses = fixedExpensesTotal + variableExpenses
  const balance = totalIncome - totalExpenses

  function handleSaveTransaction(tx) {
    setTransactions([{ id: Date.now(), ...tx }, ...transactions])
  }

  return (
    <div style={{ minHeight: '100svh', background: T.bg, paddingBottom: 90 }}>
      {/* Header */}
      <div style={{ padding: '28px 20px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: T.sub }}>Balance personal</p>
          <button onClick={onSettings} style={{
            width: 36, height: 36, borderRadius: 10, background: T.surface,
            border: `1.5px solid ${T.border}`, display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer',
          }}>
            <Settings size={16} color={T.muted} strokeWidth={1.75} />
          </button>
        </div>
        <h1 style={{
          fontSize: 38, fontWeight: 900, letterSpacing: '-.03em',
          color: balance >= 0 ? T.forest : T.rose,
        }}>
          {balance >= 0 ? '' : '- '}$ {formatMoney(Math.abs(balance))}
        </h1>
      </div>

      {/* Summary cards */}
      <div style={{ padding: '0 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <Card style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: T.forestLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowUpRight size={16} color={T.forest} strokeWidth={2} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Ingresos</span>
          </div>
          <p style={{ fontSize: 20, fontWeight: 900, color: T.forest }}>{fUSD(totalIncome)}</p>
          {salary > 0 && extrasEstimated > 0 && (
            <p style={{ fontSize: 11, fontWeight: 500, color: T.sub, marginTop: 4 }}>
              Sueldo {fUSD(salary)} + Extras {fUSD(extrasEstimated)}
            </p>
          )}
        </Card>

        <Card style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: T.roseLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowDownRight size={16} color={T.rose} strokeWidth={2} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Gastos</span>
          </div>
          <p style={{ fontSize: 20, fontWeight: 900, color: T.rose }}>{fUSD(totalExpenses)}</p>
          {fixedExpensesTotal > 0 && variableExpenses > 0 && (
            <p style={{ fontSize: 11, fontWeight: 500, color: T.sub, marginTop: 4 }}>
              Fijos {fUSD(fixedExpensesTotal)} + Variables {fUSD(variableExpenses)}
            </p>
          )}
        </Card>
      </div>

      {/* Expense breakdown */}
      <div style={{ padding: '0 20px', marginBottom: 20 }}>
        <Card>
          <p style={{ fontSize: 12, fontWeight: 700, color: T.muted, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 16 }}>
            Desglose de gastos
          </p>

          {/* Fixed expenses bar */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.navy }}>Gastos fijos</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: T.navy }}>{fUSD(fixedExpensesTotal)}</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: T.bg, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4, background: T.cobalt,
                width: totalIncome > 0 ? `${Math.min((fixedExpensesTotal / totalIncome) * 100, 100)}%` : '0%',
                transition: 'width .4s ease',
              }} />
            </div>
            {/* Individual fixed items */}
            {fixedExpensesList.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {fixedExpensesList.map(e => (
                  <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 8 }}>
                    <span className="capitalize" style={{ fontSize: 12, fontWeight: 600, color: T.sub }}>{e.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.sub }}>{fUSD(n(e.amount))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Variable expenses bar */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.navy }}>Gastos variables</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: T.navy }}>{fUSD(variableExpenses)}</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: T.bg, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4, background: T.amber,
                width: totalIncome > 0 ? `${Math.min((variableExpenses / totalIncome) * 100, 100)}%` : '0%',
                transition: 'width .4s ease',
              }} />
            </div>
          </div>

          {/* Disponible */}
          <div style={{ paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: T.navy }}>Disponible</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: balance >= 0 ? T.forest : T.rose }}>
                {fUSD(balance)}
              </span>
            </div>
            {totalIncome > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ height: 8, borderRadius: 4, background: T.bg, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 4,
                    background: balance >= 0
                      ? `linear-gradient(90deg, ${T.forest}, ${T.forest}88)`
                      : `linear-gradient(90deg, ${T.rose}, ${T.rose}88)`,
                    width: `${Math.min(Math.max((balance / totalIncome) * 100, 0), 100)}%`,
                    transition: 'width .4s ease',
                  }} />
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Register expense button */}
      <div style={{ padding: '0 20px', marginBottom: 24 }}>
        <Button onClick={() => setShowGastoModal(true)} bg={T.cobalt} full icon={Plus}>
          Registrar gasto
        </Button>
      </div>

      {/* Recent transactions */}
      {transactions.length > 0 && (
        <div style={{ padding: '0 20px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: T.muted, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 12 }}>
            Ultimos movimientos
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {transactions.slice(0, 15).map(t => (
              <Card key={t.id} style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 12,
                    background: T.roseLight,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Receipt size={17} color={T.rose} strokeWidth={1.75} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p className="capitalize" style={{ fontSize: 14, fontWeight: 700, color: T.navy }}>{t.concepto}</p>
                    {t.categoria && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <Tag size={10} color={T.muted} strokeWidth={2} />
                        <span className="capitalize" style={{ fontSize: 11, fontWeight: 600, color: T.muted }}>{t.categoria}</span>
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 800, color: T.rose }}>
                    - {fUSD(n(t.monto))}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Gasto modal (full screen overlay) */}
      {showGastoModal && (
        <GastoModal
          categories={activeCategories}
          onSave={handleSaveTransaction}
          onClose={() => setShowGastoModal(false)}
        />
      )}

      <BottomNav pantalla={pantalla} go={setPantalla} />
    </div>
  )
}
