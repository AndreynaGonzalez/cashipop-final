import { T } from '../../lib/theme'

export default function Toast({ msg }) {
  if (!msg) return null
  return (
    <div style={{
      position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)',
      background: T.navy, color: '#fff', padding: '12px 22px', borderRadius: 14,
      fontSize: 14, fontWeight: 600, zIndex: 9998, whiteSpace: 'nowrap',
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)', animation: 'tu .25s ease',
    }}>
      {msg}
      <style>{`@keyframes tu{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
    </div>
  )
}
