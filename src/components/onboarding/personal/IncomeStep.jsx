import { useState } from 'react'
import { Wallet, Banknote } from 'lucide-react'
import { T } from '../../../lib/theme'
import { normMonto } from '../../../lib/helpers'
import Card from '../../ui/Card'
import Button from '../../ui/Button'
import StepIndicator from '../../ui/StepIndicator'

export default function IncomeStep({ data, onNext, onBack }) {
  const [salary, setSalary] = useState(data.salary || '')
  const [extras, setExtras] = useState(data.extrasEstimated || '')

  return (
    <div style={{ minHeight: '100svh', background: T.bg, padding: '24px 20px 120px' }}>
      <StepIndicator current={0} total={3} labels={['Ingresos', 'Gastos fijos', 'Categorias']} />

      <h2 style={{ fontSize: 24, fontWeight: 900, color: T.navy, letterSpacing: '-.02em', marginBottom: 8 }}>
        Configura tus ingresos
      </h2>
      <p style={{ fontSize: 14, fontWeight: 500, color: T.sub, marginBottom: 32, lineHeight: 1.5 }}>
        Ingresa los montos mensuales que recibes de forma regular. Esto permite calcular tu balance disponible.
      </p>

      {/* Sueldo mensual principal */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: T.cobaltLight,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Wallet size={22} color={T.cobalt} strokeWidth={1.75} />
          </div>
          <div>
            <p className="capitalize" style={{ fontSize: 16, fontWeight: 800, color: T.navy }}>
              Sueldo mensual principal
            </p>
            <p style={{ fontSize: 12, fontWeight: 500, color: T.sub, marginTop: 2 }}>
              Tu ingreso fijo mas importante
            </p>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <span style={{
            position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)',
            fontSize: 20, fontWeight: 800, color: salary ? T.cobalt : T.muted,
          }}>$</span>
          <input
            type="text" inputMode="decimal" value={salary}
            onChange={e => setSalary(normMonto(e.target.value))}
            placeholder="0,00"
            style={{
              width: '100%', paddingLeft: 42, paddingRight: 18, height: 60,
              fontSize: 24, fontWeight: 900, letterSpacing: '-.01em',
              border: `2px solid ${salary ? T.cobalt : T.border}`,
              borderRadius: 16, background: salary ? T.cobaltLight : T.bg,
              color: T.navy, outline: 'none',
              transition: 'border-color .2s, background .2s',
            }}
          />
        </div>
      </Card>

      {/* Ingresos extras estimados */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: T.forestLight,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Banknote size={22} color={T.forest} strokeWidth={1.75} />
          </div>
          <div>
            <p className="capitalize" style={{ fontSize: 16, fontWeight: 800, color: T.navy }}>
              Ingresos extras estimados
            </p>
            <p style={{ fontSize: 12, fontWeight: 500, color: T.sub, marginTop: 2 }}>
              Freelance, comisiones, rentas u otros ingresos adicionales
            </p>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <span style={{
            position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)',
            fontSize: 20, fontWeight: 800, color: extras ? T.forest : T.muted,
          }}>$</span>
          <input
            type="text" inputMode="decimal" value={extras}
            onChange={e => setExtras(normMonto(e.target.value))}
            placeholder="0,00"
            style={{
              width: '100%', paddingLeft: 42, paddingRight: 18, height: 60,
              fontSize: 24, fontWeight: 900, letterSpacing: '-.01em',
              border: `2px solid ${extras ? T.forest : T.border}`,
              borderRadius: 16, background: extras ? T.forestLight : T.bg,
              color: T.navy, outline: 'none',
              transition: 'border-color .2s, background .2s',
            }}
          />
        </div>
      </Card>

      {/* Bottom CTA */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '16px 20px env(safe-area-inset-bottom, 16px)',
        background: T.bg, borderTop: `1px solid ${T.border}`,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Button onClick={onBack} bg={T.bg} color={T.navy} full style={{ border: `1.5px solid ${T.border}`, boxShadow: 'none' }}>
            Atras
          </Button>
          <Button onClick={() => onNext({ salary, extrasEstimated: extras })} bg={T.cobalt} full>
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  )
}
