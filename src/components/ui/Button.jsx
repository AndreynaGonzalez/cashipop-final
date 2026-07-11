import { T } from '../../lib/theme'

export default function Button({ children, onClick, bg, color = '#fff', full, style, disabled, icon: Icon }) {
  const base = bg || T.cobalt
  const sh = `0 4px 0 ${base}44`
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: base, color, border: 'none', borderRadius: 16,
      padding: '14px 20px', fontSize: 15, fontWeight: 700,
      cursor: disabled ? 'not-allowed' : 'pointer',
      width: full ? '100%' : undefined, opacity: disabled ? .45 : 1,
      boxShadow: sh, display: 'flex', alignItems: 'center',
      justifyContent: 'center', gap: 8,
      transition: 'transform .08s, box-shadow .08s',
      WebkitTapHighlightColor: 'transparent',
      letterSpacing: '-.01em', ...style,
    }}
      onPointerDown={e => { if (!disabled) { e.currentTarget.style.transform = 'translateY(3px)'; e.currentTarget.style.boxShadow = `0 1px 0 ${base}44` } }}
      onPointerUp={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = sh }}
      onPointerLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = sh }}
    >
      {Icon && <Icon size={17} strokeWidth={1.75} />}{children}
    </button>
  )
}
