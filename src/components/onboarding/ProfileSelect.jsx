import { User, Store, ChevronRight } from 'lucide-react'
import { T } from '../../lib/theme'

const profiles = [
  {
    id: 'personal',
    icon: User,
    title: 'Uso Personal',
    desc: 'Controla tus ingresos, gastos fijos y variables del dia a dia.',
  },
  {
    id: 'business',
    icon: Store,
    title: 'Mi Negocio',
    desc: 'Gestiona proveedores, inventario, menu y metricas avanzadas.',
  },
]

export default function ProfileSelect({ onSelect }) {
  return (
    <div style={{
      minHeight: '100svh', background: T.bg,
      display: 'flex', flexDirection: 'column',
      justifyContent: 'center', padding: '40px 20px',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20,
          background: `linear-gradient(135deg, ${T.brand}, ${T.brandGold})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px', boxShadow: '0 8px 32px rgba(94,64,91,0.2)',
        }}>
          <span style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '-.03em' }}>C</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: T.navy, letterSpacing: '-.03em', marginBottom: 12 }}>
          Bienvenido a Cashipop
        </h1>
        <p style={{ fontSize: 16, fontWeight: 500, color: T.sub, lineHeight: 1.5, maxWidth: 320, margin: '0 auto' }}>
          Como vas a usar la aplicacion?
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400, margin: '0 auto', width: '100%' }}>
        {profiles.map(p => {
          const Icon = p.icon
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              style={{
                background: T.surface, borderRadius: 24,
                border: `1.5px solid ${T.border}`,
                padding: '24px 20px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 16,
                textAlign: 'left', boxShadow: T.shadowCard,
                transition: 'border-color .2s, box-shadow .2s',
                WebkitTapHighlightColor: 'transparent',
              }}
              onPointerDown={e => {
                e.currentTarget.style.borderColor = T.cobalt
                e.currentTarget.style.boxShadow = `0 2px 32px rgba(94,64,91,0.12)`
              }}
              onPointerUp={e => {
                e.currentTarget.style.borderColor = T.border
                e.currentTarget.style.boxShadow = T.shadowCard
              }}
              onPointerLeave={e => {
                e.currentTarget.style.borderColor = T.border
                e.currentTarget.style.boxShadow = T.shadowCard
              }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: 16,
                background: T.cobaltLight,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon size={24} color={T.cobalt} strokeWidth={1.75} />
              </div>
              <div style={{ flex: 1 }}>
                <p className="capitalize" style={{ fontSize: 17, fontWeight: 800, color: T.navy, marginBottom: 4 }}>
                  {p.title}
                </p>
                <p style={{ fontSize: 13, fontWeight: 500, color: T.sub, lineHeight: 1.4 }}>
                  {p.desc}
                </p>
              </div>
              <ChevronRight size={20} color={T.muted} strokeWidth={1.75} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
