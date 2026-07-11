import { useState } from 'react'
import {
  ShoppingCart, Utensils, Shirt, Car, Dumbbell, GraduationCap,
  Heart, Sparkles, PlusCircle, X, Check, GripVertical,
} from 'lucide-react'
import { T } from '../../../lib/theme'
import Card from '../../ui/Card'
import Button from '../../ui/Button'
import StepIndicator from '../../ui/StepIndicator'

const DEFAULT_CATEGORIES = [
  { id: 'food',          name: 'Comida',          icon: 'Utensils',       active: true },
  { id: 'transport',     name: 'Transporte',      icon: 'Car',            active: true },
  { id: 'entertainment', name: 'Salidas',         icon: 'Sparkles',       active: true },
  { id: 'shopping',      name: 'Compras',         icon: 'ShoppingCart',   active: true },
  { id: 'clothing',      name: 'Ropa',            icon: 'Shirt',          active: true },
  { id: 'health',        name: 'Salud',           icon: 'Heart',          active: true },
  { id: 'fitness',       name: 'Gimnasio',        icon: 'Dumbbell',       active: false },
  { id: 'education',     name: 'Educacion',       icon: 'GraduationCap',  active: false },
]

const ICON_MAP = { ShoppingCart, Utensils, Shirt, Car, Dumbbell, GraduationCap, Heart, Sparkles }

export default function CategoriesStep({ data, onFinish, onBack }) {
  const [categories, setCategories] = useState(data.categories || DEFAULT_CATEGORIES)
  const [newCat, setNewCat] = useState('')

  function toggleCategory(id) {
    setCategories(categories.map(c => c.id === id ? { ...c, active: !c.active } : c))
  }

  function addCategory() {
    if (!newCat.trim()) return
    setCategories([...categories, {
      id: `custom-${Date.now()}`,
      name: newCat.trim(),
      icon: 'ShoppingCart',
      active: true,
    }])
    setNewCat('')
  }

  function removeCategory(id) {
    setCategories(categories.filter(c => c.id !== id))
  }

  const activeCount = categories.filter(c => c.active).length

  return (
    <div style={{ minHeight: '100svh', background: T.bg, padding: '24px 20px 120px' }}>
      <StepIndicator current={2} total={3} labels={['Ingresos', 'Gastos fijos', 'Categorias']} />

      <h2 style={{ fontSize: 24, fontWeight: 900, color: T.navy, letterSpacing: '-.02em', marginBottom: 8 }}>
        Categorias de gastos
      </h2>
      <p style={{ fontSize: 14, fontWeight: 500, color: T.sub, marginBottom: 28, lineHeight: 1.5 }}>
        Selecciona las categorias que usas para tus gastos variables. Puedes agregar categorias personalizadas.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
        {categories.map(cat => {
          const Icon = ICON_MAP[cat.icon] || ShoppingCart
          return (
            <div key={cat.id} style={{ position: 'relative' }}>
              <button
                onClick={() => toggleCategory(cat.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 16px', borderRadius: 14,
                  border: `1.5px solid ${cat.active ? T.cobalt : T.border}`,
                  background: cat.active ? T.cobaltLight : T.surface,
                  cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                  transition: 'all .15s',
                }}
              >
                <Icon size={16} color={cat.active ? T.cobalt : T.muted} strokeWidth={1.75} />
                <span className="capitalize" style={{ fontSize: 13, fontWeight: 700, color: cat.active ? T.cobalt : T.sub }}>
                  {cat.name}
                </span>
                {cat.active && <Check size={14} color={T.cobalt} strokeWidth={2.5} />}
              </button>
              {cat.id.startsWith('custom-') && (
                <button
                  onClick={() => removeCategory(cat.id)}
                  style={{
                    position: 'absolute', top: -6, right: -6,
                    width: 20, height: 20, borderRadius: '50%',
                    background: T.rose, border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <X size={12} color="#fff" strokeWidth={2.5} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      <Card>
        <p style={{ fontSize: 12, fontWeight: 700, color: T.muted, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 12 }}>
          Agregar categoria personalizada
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text" value={newCat}
            onChange={e => setNewCat(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCategory()}
            placeholder="Nombre de la categoria"
            style={{
              flex: 1, height: 46, paddingLeft: 14, fontSize: 14, fontWeight: 600,
              border: `1.5px solid ${T.border}`, borderRadius: 12, background: T.bg,
              color: T.navy, outline: 'none',
            }}
          />
          <button onClick={addCategory} style={{
            width: 46, height: 46, borderRadius: 12, background: T.forest, border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <PlusCircle size={20} color="#fff" strokeWidth={2} />
          </button>
        </div>
      </Card>

      <div style={{
        marginTop: 20, padding: '14px 18px', borderRadius: 14,
        background: T.forestLight, border: `1px solid ${T.forest}22`,
      }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: T.forest }}>
          {activeCount} {activeCount === 1 ? 'categoria seleccionada' : 'categorias seleccionadas'}
        </p>
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px 20px env(safe-area-inset-bottom, 16px)', background: T.bg, borderTop: `1px solid ${T.border}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Button onClick={onBack} bg={T.bg} color={T.navy} full style={{ border: `1.5px solid ${T.border}`, boxShadow: 'none' }}>
            Atras
          </Button>
          <Button onClick={() => onFinish({ categories })} bg={T.forest} full disabled={activeCount === 0} icon={Check}>
            Finalizar
          </Button>
        </div>
      </div>
    </div>
  )
}
