import { User, ArrowRight, Wallet, Receipt, Tag } from 'lucide-react'
import { T } from '../../../lib/theme'
import Button from '../../ui/Button'

const STEPS_PREVIEW = [
  { icon: Wallet,  label: 'Configurar ingresos',          desc: 'Sueldo y extras mensuales' },
  { icon: Receipt, label: 'Definir gastos fijos',          desc: 'Renta, servicios, suscripciones' },
  { icon: Tag,     label: 'Personalizar categorias',       desc: 'Comida, salidas, compras...' },
]

export default function WelcomePersonal({ onStart, onBack }) {
  return (
    <div style={{
      minHeight: '100svh', background: T.bg,
      display: 'flex', flexDirection: 'column',
      padding: '0 20px',
    }}>
      {/* Top spacer */}
      <div style={{ flex: 1, minHeight: 60 }} />

      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 22,
          background: T.cobaltLight,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <User size={32} color={T.cobalt} strokeWidth={1.5} />
        </div>
        <h1 style={{
          fontSize: 26, fontWeight: 900, color: T.navy,
          letterSpacing: '-.03em', lineHeight: 1.2, marginBottom: 12,
        }}>
          Comencemos a configurar tu cuenta personal
        </h1>
        <p style={{
          fontSize: 15, fontWeight: 500, color: T.sub,
          lineHeight: 1.6, maxWidth: 340, margin: '0 auto',
        }}>
          En 3 pasos rapidos tendras tu dashboard listo para controlar tus finanzas del dia a dia.
        </p>
      </div>

      {/* Steps preview */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 0,
        maxWidth: 380, margin: '0 auto', width: '100%',
      }}>
        {STEPS_PREVIEW.map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Step connector */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 14,
                  background: T.surface, border: `1.5px solid ${T.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={20} color={T.cobalt} strokeWidth={1.75} />
                </div>
                {i < STEPS_PREVIEW.length - 1 && (
                  <div style={{ width: 2, height: 24, background: T.border }} />
                )}
              </div>
              {/* Label */}
              <div style={{ paddingBottom: i < STEPS_PREVIEW.length - 1 ? 24 : 0 }}>
                <p style={{ fontSize: 15, fontWeight: 800, color: T.navy, marginBottom: 2 }}>{s.label}</p>
                <p style={{ fontSize: 13, fontWeight: 500, color: T.sub }}>{s.desc}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom spacer + CTA */}
      <div style={{ flex: 1, minHeight: 40 }} />

      <div style={{ padding: '0 0 env(safe-area-inset-bottom, 24px)', maxWidth: 380, margin: '0 auto', width: '100%' }}>
        <Button onClick={onStart} bg={T.cobalt} full icon={ArrowRight} style={{ marginBottom: 12 }}>
          Comenzar configuracion
        </Button>
        <button
          onClick={onBack}
          style={{
            width: '100%', padding: '14px', background: 'none', border: 'none',
            fontSize: 14, fontWeight: 600, color: T.sub, cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          Volver a seleccion de perfil
        </button>
      </div>
    </div>
  )
}
