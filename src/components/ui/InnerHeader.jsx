import { ArrowLeft } from 'lucide-react'
import { T } from '../../lib/theme'

export default function InnerHeader({ title, onBack }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '18px 20px 12px', background: T.bg,
    }}>
      {onBack && (
        <button onClick={onBack} style={{
          width: 40, height: 40, borderRadius: 14,
          border: `1.5px solid ${T.border}`, background: T.surface,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}>
          <ArrowLeft size={18} color={T.navy} strokeWidth={2} />
        </button>
      )}
      <h2 style={{ fontSize: 20, fontWeight: 800, color: T.navy, letterSpacing: '-.02em' }}>
        {title}
      </h2>
    </div>
  )
}
