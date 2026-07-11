import { T } from '../../lib/theme'

export default function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: T.surface, borderRadius: 28,
      border: `1px solid ${T.border}`,
      boxShadow: T.shadowCard, padding: '22px',
      cursor: onClick ? 'pointer' : undefined, ...style,
    }}>
      {children}
    </div>
  )
}
