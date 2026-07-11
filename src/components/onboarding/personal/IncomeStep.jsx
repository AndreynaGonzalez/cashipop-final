import { useState } from 'react'
import { Wallet, PlusCircle, X, Banknote } from 'lucide-react'
import { T } from '../../../lib/theme'
import { normMonto } from '../../../lib/helpers'
import Card from '../../ui/Card'
import Button from '../../ui/Button'
import StepIndicator from '../../ui/StepIndicator'

export default function IncomeStep({ data, onNext, onBack }) {
  const [salary, setSalary] = useState(data.salary || '')
  const [extras, setExtras] = useState(data.extras || [])
  const [newExtra, setNewExtra] = useState({ name: '', amount: '' })

  function addExtra() {
    if (!newExtra.name.trim() || !newExtra.amount) return
    setExtras([...extras, { id: Date.now(), name: newExtra.name.trim(), amount: newExtra.amount }])
    setNewExtra({ name: '', amount: '' })
  }

  function removeExtra(id) {
    setExtras(extras.filter(e => e.id !== id))
  }

  function handleNext() {
    onNext({ salary, extras })
  }

  return (
    <div style={{ minHeight: '100svh', background: T.bg, padding: '24px 20px 120px' }}>
      <StepIndicator current={0} total={3} labels={['Ingresos', 'Gastos fijos', 'Categorias']} />

      <h2 style={{ fontSize: 24, fontWeight: 900, color: T.navy, letterSpacing: '-.02em', marginBottom: 8 }}>
        Tus ingresos
      </h2>
      <p style={{ fontSize: 14, fontWeight: 500, color: T.sub, marginBottom: 28, lineHeight: 1.5 }}>
        Registra tu sueldo mensual y cualquier ingreso adicional que recibas de forma regular.
      </p>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Wallet size={18} color={T.cobalt} strokeWidth={1.75} />
          <span className="capitalize" style={{ fontSize: 15, fontWeight: 700, color: T.navy }}>Sueldo mensual</span>
        </div>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, fontWeight: 700, color: salary ? T.cobalt : T.muted }}>$</span>
          <input
            type="text" inputMode="decimal" value={salary}
            onChange={e => setSalary(normMonto(e.target.value))}
            placeholder="0,00"
            style={{
              width: '100%', paddingLeft: 34, paddingRight: 14, height: 52,
              fontSize: 20, fontWeight: 800, border: `1.5px solid ${salary ? T.cobalt : T.border}`,
              borderRadius: 14, background: salary ? T.cobaltLight : T.bg,
              color: T.navy, outline: 'none',
            }}
          />
        </div>
      </Card>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Banknote size={18} color={T.forest} strokeWidth={1.75} />
          <span className="capitalize" style={{ fontSize: 15, fontWeight: 700, color: T.navy }}>Ingresos extras</span>
        </div>

        {extras.map(ex => (
          <div key={ex.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', background: T.forestLight, borderRadius: 12, marginBottom: 8,
          }}>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: T.navy }}>{ex.name}</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: T.forest }}>$ {ex.amount}</span>
            <button onClick={() => removeExtra(ex.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <X size={16} color={T.rose} strokeWidth={2} />
            </button>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, marginTop: extras.length ? 12 : 0 }}>
          <input
            type="text" value={newExtra.name}
            onChange={e => setNewExtra({ ...newExtra, name: e.target.value })}
            placeholder="Concepto"
            style={{
              flex: 1, height: 46, paddingLeft: 14, fontSize: 14, fontWeight: 600,
              border: `1.5px solid ${T.border}`, borderRadius: 12,
              background: T.bg, color: T.navy, outline: 'none',
            }}
          />
          <div style={{ position: 'relative', width: 100 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 700, color: T.muted }}>$</span>
            <input
              type="text" inputMode="decimal" value={newExtra.amount}
              onChange={e => setNewExtra({ ...newExtra, amount: normMonto(e.target.value) })}
              placeholder="0,00"
              style={{
                width: '100%', paddingLeft: 26, height: 46, fontSize: 14, fontWeight: 800,
                border: `1.5px solid ${T.border}`, borderRadius: 12,
                background: T.bg, color: T.navy, outline: 'none',
              }}
            />
          </div>
          <button onClick={addExtra} style={{
            width: 46, height: 46, borderRadius: 12,
            background: T.forest, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <PlusCircle size={20} color="#fff" strokeWidth={2} />
          </button>
        </div>
      </Card>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px 20px env(safe-area-inset-bottom, 16px)', background: T.bg, borderTop: `1px solid ${T.border}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: onBack ? '1fr 1fr' : '1fr', gap: 12 }}>
          {onBack && (
            <Button onClick={onBack} bg={T.bg} color={T.navy} full style={{ border: `1.5px solid ${T.border}`, boxShadow: 'none' }}>
              Atras
            </Button>
          )}
          <Button onClick={handleNext} bg={T.cobalt} full>
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  )
}
