import { T } from '../../lib/theme'
import { Check } from 'lucide-react'

export default function StepIndicator({ current, total, labels }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '0 4px', marginBottom: 32 }}>
      {Array.from({ length: total }, (_, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 'none' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? T.forest : active ? T.cobalt : T.bg,
                border: `2px solid ${done ? T.forest : active ? T.cobalt : T.border}`,
                transition: 'all .3s ease',
              }}>
                {done
                  ? <Check size={16} color="#fff" strokeWidth={2.5} />
                  : <span style={{ fontSize: 14, fontWeight: 800, color: active ? '#fff' : T.muted }}>{i + 1}</span>
                }
              </div>
              {labels && labels[i] && (
                <span style={{
                  fontSize: 10, fontWeight: 700, color: active ? T.navy : done ? T.forest : T.muted,
                  textAlign: 'center', maxWidth: 72, lineHeight: 1.2,
                  letterSpacing: '.02em',
                }}>
                  {labels[i]}
                </span>
              )}
            </div>
            {i < total - 1 && (
              <div style={{
                flex: 1, height: 2, margin: labels ? '0 8px 22px' : '0 8px',
                background: done ? T.forest : T.border,
                borderRadius: 1, transition: 'background .3s ease',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
