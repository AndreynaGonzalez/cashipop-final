import { AlertCircle } from 'lucide-react'
import { T } from '../../lib/theme'

export default function Confirm({
  title, msg, children, onYes, onNo,
  yesLabel = 'Confirmar', noLabel = 'Cancelar',
  yesColor = T.forest, icon: ConfIcon = AlertCircle, iconColor = T.amber,
}) {
  if (!msg && !children) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 9990, display: 'flex', alignItems: 'flex-end', padding: '0 16px 28px' }}>
      <div style={{ background: T.surface, borderRadius: 28, padding: '28px 24px', width: '100%', boxShadow: '0 -8px 40px rgba(0,0,0,0.12)' }}>
        <ConfIcon size={26} color={iconColor} strokeWidth={1.75} style={{ margin: '0 auto 14px', display: 'block' }} />
        {title && <p style={{ fontSize: 18, fontWeight: 800, color: T.navy, textAlign: 'center', marginBottom: 8 }}>{title}</p>}
        {msg && <p style={{ fontSize: 15, fontWeight: 600, color: T.sub, textAlign: 'center', lineHeight: 1.5 }}>{msg}</p>}
        {children}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 20 }}>
          <button onClick={onNo} style={{ padding: '15px', borderRadius: 14, border: `1.5px solid ${T.border}`, background: T.bg, fontSize: 14, fontWeight: 700, color: T.sub, cursor: 'pointer' }}>
            {noLabel}
          </button>
          <button onClick={onYes} style={{ padding: '15px', borderRadius: 14, border: 'none', background: yesColor, fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
            {yesLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
