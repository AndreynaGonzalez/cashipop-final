import { useState } from 'react'
import { UtensilsCrossed, PlusCircle, X, DollarSign, Edit3 } from 'lucide-react'
import { T } from '../../../lib/theme'
import { normMonto } from '../../../lib/helpers'
import Card from '../../ui/Card'
import Button from '../../ui/Button'
import StepIndicator from '../../ui/StepIndicator'

export default function MenuStep({ data, onNext, onBack }) {
  const [items, setItems] = useState(data.menuItems || [])
  const [form, setForm] = useState({ name: '', price: '', category: '' })
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)

  function saveItem() {
    if (!form.name.trim() || !form.price) return
    if (editId) {
      setItems(items.map(i => i.id === editId ? { ...i, ...form, name: form.name.trim() } : i))
      setEditId(null)
    } else {
      setItems([...items, { id: Date.now(), ...form, name: form.name.trim() }])
    }
    setForm({ name: '', price: '', category: '' })
    setShowForm(false)
  }

  function editItem(item) {
    setForm({ name: item.name, price: item.price, category: item.category || '' })
    setEditId(item.id)
    setShowForm(true)
  }

  function removeItem(id) {
    setItems(items.filter(i => i.id !== id))
  }

  return (
    <div style={{ minHeight: '100svh', background: T.bg, padding: '24px 20px 120px' }}>
      <StepIndicator current={1} total={3} labels={['Proveedores', 'Menu', 'Inventario']} />

      <h2 style={{ fontSize: 24, fontWeight: 900, color: T.navy, letterSpacing: '-.02em', marginBottom: 8 }}>
        Menu / Catalogo
      </h2>
      <p style={{ fontSize: 14, fontWeight: 500, color: T.sub, marginBottom: 28, lineHeight: 1.5 }}>
        Agrega los productos o platos que vendes con su precio. Esto permitira calcular margenes y rentabilidad.
      </p>

      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {items.map(item => (
            <Card key={item.id} style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 14,
                  background: T.forestLight,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <UtensilsCrossed size={20} color={T.forest} strokeWidth={1.75} />
                </div>
                <div style={{ flex: 1 }}>
                  <p className="capitalize" style={{ fontSize: 15, fontWeight: 800, color: T.navy }}>{item.name}</p>
                  {item.category && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: T.muted }}>{item.category}</span>
                  )}
                </div>
                <span style={{ fontSize: 16, fontWeight: 900, color: T.forest }}>$ {item.price}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => editItem(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <Edit3 size={15} color={T.cobalt} strokeWidth={1.75} />
                  </button>
                  <button onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <X size={16} color={T.rose} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </Card>
          ))}

          <div style={{
            padding: '12px 18px', borderRadius: 14,
            background: T.forestLight, border: `1px solid ${T.forest}22`,
          }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: T.forest }}>
              {items.length} {items.length === 1 ? 'producto registrado' : 'productos registrados'}
            </p>
          </div>
        </div>
      )}

      {showForm ? (
        <Card style={{ border: `1.5px solid ${T.cobalt}` }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: T.muted, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 16 }}>
            {editId ? 'Editar producto' : 'Nuevo producto'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="text" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Nombre del producto o plato"
              style={{
                width: '100%', height: 46, paddingLeft: 14, fontSize: 14, fontWeight: 600,
                border: `1.5px solid ${T.border}`, borderRadius: 12, background: T.bg,
                color: T.navy, outline: 'none',
              }}
            />
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 14, fontWeight: 700, color: T.muted }}>$</span>
              <input
                type="text" inputMode="decimal" value={form.price}
                onChange={e => setForm({ ...form, price: normMonto(e.target.value) })}
                placeholder="Precio de venta"
                style={{
                  width: '100%', paddingLeft: 30, height: 46, fontSize: 15, fontWeight: 800,
                  border: `1.5px solid ${T.border}`, borderRadius: 12, background: T.bg,
                  color: T.navy, outline: 'none',
                }}
              />
            </div>
            <input
              type="text" value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
              placeholder="Categoria (opcional): Platos fuertes, Bebidas..."
              style={{
                width: '100%', height: 46, paddingLeft: 14, fontSize: 14, fontWeight: 600,
                border: `1.5px solid ${T.border}`, borderRadius: 12, background: T.bg,
                color: T.navy, outline: 'none',
              }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
              <Button onClick={() => { setShowForm(false); setEditId(null); setForm({ name: '', price: '', category: '' }) }} bg={T.bg} color={T.navy} full style={{ border: `1.5px solid ${T.border}`, boxShadow: 'none' }}>
                Cancelar
              </Button>
              <Button onClick={saveItem} bg={T.forest} full disabled={!form.name.trim() || !form.price}>
                {editId ? 'Guardar' : 'Agregar'}
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          style={{
            width: '100%', padding: '18px', borderRadius: 16,
            border: `2px dashed ${T.border}`, background: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
          }}
        >
          <PlusCircle size={20} color={T.cobalt} strokeWidth={1.75} />
          <span style={{ fontSize: 14, fontWeight: 700, color: T.cobalt }}>Agregar producto</span>
        </button>
      )}

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px 20px env(safe-area-inset-bottom, 16px)', background: T.bg, borderTop: `1px solid ${T.border}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Button onClick={onBack} bg={T.bg} color={T.navy} full style={{ border: `1.5px solid ${T.border}`, boxShadow: 'none' }}>
            Atras
          </Button>
          <Button onClick={() => onNext({ menuItems: items })} bg={T.cobalt} full>
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  )
}
