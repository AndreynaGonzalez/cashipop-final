import { useState } from 'react'
import { Home, Wifi, CreditCard, PlusCircle, X, Zap } from 'lucide-react'
import { T } from '../../../lib/theme'
import { normMonto } from '../../../lib/helpers'
import Card from '../../ui/Card'
import Button from '../../ui/Button'
import StepIndicator from '../../ui/StepIndicator'

const DEFAULT_FIXED = [
  { id: 'rent', name: 'Renta / Alquiler', icon: 'Home', amount: '' },
  { id: 'electricity', name: 'Electricidad', icon: 'Zap', amount: '' },
  { id: 'water', name: 'Agua', icon: 'Zap', amount: '' },
  { id: 'internet', name: 'Internet / Telefono', icon: 'Wifi', amount: '' },
  { id: 'insurance', name: 'Seguros', icon: 'CreditCard', amount: '' },
]

const ICON_MAP = { Home, Wifi, CreditCard, Zap }

export default function FixedExpensesStep({ data, onNext, onBack }) {
  const [expenses, setExpenses] = useState(data.fixedExpenses || DEFAULT_FIXED)
  const [newExpense, setNewExpense] = useState({ name: '', amount: '' })

  function updateAmount(id, val) {
    setExpenses(expenses.map(e => e.id === id ? { ...e, amount: normMonto(val) } : e))
  }

  function addExpense() {
    if (!newExpense.name.trim()) return
    setExpenses([...expenses, {
      id: `custom-${Date.now()}`,
      name: newExpense.name.trim(),
      icon: 'CreditCard',
      amount: newExpense.amount,
    }])
    setNewExpense({ name: '', amount: '' })
  }

  function removeExpense(id) {
    setExpenses(expenses.filter(e => e.id !== id))
  }

  return (
    <div style={{ minHeight: '100svh', background: T.bg, padding: '24px 20px 120px' }}>
      <StepIndicator current={1} total={3} labels={['Ingresos', 'Gastos fijos', 'Categorias']} />

      <h2 style={{ fontSize: 24, fontWeight: 900, color: T.navy, letterSpacing: '-.02em', marginBottom: 8 }}>
        Gastos fijos
      </h2>
      <p style={{ fontSize: 14, fontWeight: 500, color: T.sub, marginBottom: 28, lineHeight: 1.5 }}>
        Agrega los gastos que pagas cada mes de forma recurrente. Puedes dejar en blanco los que no aplican.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {expenses.map(exp => {
          const Icon = ICON_MAP[exp.icon] || CreditCard
          return (
            <Card key={exp.id} style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: exp.amount ? T.cobaltLight : T.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon size={18} color={exp.amount ? T.cobalt : T.muted} strokeWidth={1.75} />
                </div>
                <span className="capitalize" style={{ flex: 1, fontSize: 14, fontWeight: 700, color: T.navy }}>{exp.name}</span>
                <div style={{ position: 'relative', width: 110 }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 700, color: T.muted }}>$</span>
                  <input
                    type="text" inputMode="decimal" value={exp.amount}
                    onChange={e => updateAmount(exp.id, e.target.value)}
                    placeholder="0,00"
                    style={{
                      width: '100%', paddingLeft: 26, height: 44, fontSize: 15, fontWeight: 800,
                      border: `1.5px solid ${exp.amount ? T.cobalt : T.border}`, borderRadius: 12,
                      background: exp.amount ? T.cobaltLight : T.bg,
                      color: T.navy, outline: 'none', textAlign: 'right', paddingRight: 12,
                    }}
                  />
                </div>
                {exp.id.startsWith('custom-') && (
                  <button onClick={() => removeExpense(exp.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <X size={16} color={T.rose} strokeWidth={2} />
                  </button>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      <Card style={{ marginTop: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: T.muted, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 12 }}>
          Agregar otro gasto fijo
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text" value={newExpense.name}
            onChange={e => setNewExpense({ ...newExpense, name: e.target.value })}
            placeholder="Nombre del gasto"
            style={{
              flex: 1, height: 46, paddingLeft: 14, fontSize: 14, fontWeight: 600,
              border: `1.5px solid ${T.border}`, borderRadius: 12, background: T.bg, color: T.navy, outline: 'none',
            }}
          />
          <div style={{ position: 'relative', width: 90 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 700, color: T.muted }}>$</span>
            <input
              type="text" inputMode="decimal" value={newExpense.amount}
              onChange={e => setNewExpense({ ...newExpense, amount: normMonto(e.target.value) })}
              placeholder="0,00"
              style={{
                width: '100%', paddingLeft: 26, height: 46, fontSize: 14, fontWeight: 800,
                border: `1.5px solid ${T.border}`, borderRadius: 12, background: T.bg, color: T.navy, outline: 'none',
              }}
            />
          </div>
          <button onClick={addExpense} style={{
            width: 46, height: 46, borderRadius: 12, background: T.forest, border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <PlusCircle size={20} color="#fff" strokeWidth={2} />
          </button>
        </div>
      </Card>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px 20px env(safe-area-inset-bottom, 16px)', background: T.bg, borderTop: `1px solid ${T.border}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Button onClick={onBack} bg={T.bg} color={T.navy} full style={{ border: `1.5px solid ${T.border}`, boxShadow: 'none' }}>
            Atras
          </Button>
          <Button onClick={() => onNext({ fixedExpenses: expenses })} bg={T.cobalt} full>
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  )
}
