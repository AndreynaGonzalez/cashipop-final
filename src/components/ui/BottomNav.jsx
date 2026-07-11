import { Home, Receipt, BarChart3, CalendarDays, Settings } from 'lucide-react'
import { T } from '../../lib/theme'

const TABS = [
  { id: 'home',      icon: Home,         label: 'Inicio' },
  { id: 'gastos',    icon: Receipt,      label: 'Gastos' },
  { id: 'metricas',  icon: BarChart3,    label: 'Metricas' },
  { id: 'historial', icon: CalendarDays, label: 'Historial' },
  { id: 'config',    icon: Settings,     label: 'Ajustes' },
]

export default function BottomNav({ pantalla, go }) {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: T.surface, borderTop: `1px solid ${T.border}`,
      display: 'flex', justifyContent: 'space-around', padding: '6px 0 env(safe-area-inset-bottom, 8px)',
      zIndex: 100, boxShadow: T.shadowNav,
    }}>
      {TABS.map(tab => {
        const active = pantalla === tab.id
        const Icon = tab.icon
        return (
          <button key={tab.id} onClick={() => go(tab.id)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            background: 'none', border: 'none', padding: '8px 12px',
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
          }}>
            <div style={{
              width: 40, height: 32, borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: active ? T.cobaltLight : 'transparent',
              transition: 'background .2s',
            }}>
              <Icon size={20} strokeWidth={active ? 2 : 1.5} color={active ? T.cobalt : T.muted} />
            </div>
            <span style={{
              fontSize: 10, fontWeight: active ? 700 : 500,
              color: active ? T.cobalt : T.muted,
              letterSpacing: '.02em',
            }}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
