import { useState } from 'react'
import { Truck, PlusCircle, X, Phone, Tag, User } from 'lucide-react'
import { T } from '../../../lib/theme'
import Card from '../../ui/Card'
import Button from '../../ui/Button'
import StepIndicator from '../../ui/StepIndicator'

const SUPPLIER_CATEGORIES = [
  'Carnes y proteinas',
  'Frutas y verduras',
  'Lacteos',
  'Abarrotes y secos',
  'Bebidas',
  'Limpieza',
  'Empaques',
  'Otros',
]

export default function SuppliersStep({ data, onNext, onBack }) {
  const [suppliers, setSuppliers] = useState(data.suppliers || [])
  const [form, setForm] = useState({ name: '', contact: '', category: SUPPLIER_CATEGORIES[0] })
  const [showForm, setShowForm] = useState(false)

  function addSupplier() {
    if (!form.name.trim()) return
    setSuppliers([...suppliers, { id: Date.now(), ...form, name: form.name.trim() }])
    setForm({ name: '', contact: '', category: SUPPLIER_CATEGORIES[0] })
    setShowForm(false)
  }

  function removeSupplier(id) {
    setSuppliers(suppliers.filter(s => s.id !== id))
  }

  return (
    <div style={{ minHeight: '100svh', background: T.bg, padding: '24px 20px 120px' }}>
      <StepIndicator current={0} total={3} labels={['Proveedores', 'Menu', 'Inventario']} />

      <h2 style={{ fontSize: 24, fontWeight: 900, color: T.navy, letterSpacing: '-.02em', marginBottom: 8 }}>
        Proveedores
      </h2>
      <p style={{ fontSize: 14, fontWeight: 500, color: T.sub, marginBottom: 28, lineHeight: 1.5 }}>
        Registra a tus proveedores principales. Podras asociar tus compras de insumos con ellos automaticamente.
      </p>

      {suppliers.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {suppliers.map(s => (
            <Card key={s.id} style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 14,
                  background: T.cobaltLight,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Truck size={20} color={T.cobalt} strokeWidth={1.75} />
                </div>
                <div style={{ flex: 1 }}>
                  <p className="capitalize" style={{ fontSize: 15, fontWeight: 800, color: T.navy, marginBottom: 4 }}>{s.name}</p>
                  {s.contact && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                      <Phone size={12} color={T.muted} strokeWidth={1.75} />
                      <span style={{ fontSize: 12, fontWeight: 500, color: T.sub }}>{s.contact}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Tag size={12} color={T.muted} strokeWidth={1.75} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: T.muted }}>{s.category}</span>
                  </div>
                </div>
                <button onClick={() => removeSupplier(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                  <X size={16} color={T.rose} strokeWidth={2} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm ? (
        <Card style={{ border: `1.5px solid ${T.cobalt}` }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: T.muted, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 16 }}>
            Nuevo proveedor
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <User size={14} color={T.cobalt} strokeWidth={1.75} />
                <span style={{ fontSize: 12, fontWeight: 700, color: T.navy }}>Nombre</span>
              </div>
              <input
                type="text" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Nombre del proveedor"
                style={{
                  width: '100%', height: 46, paddingLeft: 14, fontSize: 14, fontWeight: 600,
                  border: `1.5px solid ${T.border}`, borderRadius: 12, background: T.bg,
                  color: T.navy, outline: 'none',
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Phone size={14} color={T.cobalt} strokeWidth={1.75} />
                <span style={{ fontSize: 12, fontWeight: 700, color: T.navy }}>Contacto</span>
              </div>
              <input
                type="text" value={form.contact}
                onChange={e => setForm({ ...form, contact: e.target.value })}
                placeholder="Telefono o email (opcional)"
                style={{
                  width: '100%', height: 46, paddingLeft: 14, fontSize: 14, fontWeight: 600,
                  border: `1.5px solid ${T.border}`, borderRadius: 12, background: T.bg,
                  color: T.navy, outline: 'none',
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Tag size={14} color={T.cobalt} strokeWidth={1.75} />
                <span style={{ fontSize: 12, fontWeight: 700, color: T.navy }}>Categoria de insumos</span>
              </div>
              <select
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                style={{
                  width: '100%', height: 46, paddingLeft: 14, fontSize: 14, fontWeight: 600,
                  border: `1.5px solid ${T.border}`, borderRadius: 12, background: T.bg,
                  color: T.navy, outline: 'none', appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23B8A3B5' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 14px center',
                }}
              >
                {SUPPLIER_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
              <Button onClick={() => setShowForm(false)} bg={T.bg} color={T.navy} full style={{ border: `1.5px solid ${T.border}`, boxShadow: 'none' }}>
                Cancelar
              </Button>
              <Button onClick={addSupplier} bg={T.forest} full disabled={!form.name.trim()}>
                Agregar
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
          <span style={{ fontSize: 14, fontWeight: 700, color: T.cobalt }}>Agregar proveedor</span>
        </button>
      )}

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px 20px env(safe-area-inset-bottom, 16px)', background: T.bg, borderTop: `1px solid ${T.border}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Button onClick={onBack} bg={T.bg} color={T.navy} full style={{ border: `1.5px solid ${T.border}`, boxShadow: 'none' }}>
            Atras
          </Button>
          <Button onClick={() => onNext({ suppliers })} bg={T.cobalt} full>
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  )
}
