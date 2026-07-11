import { useState } from 'react'
import { Package, PlusCircle, X, ChevronDown, ChevronUp, Check, Link } from 'lucide-react'
import { T } from '../../../lib/theme'
import { normMonto } from '../../../lib/helpers'
import Card from '../../ui/Card'
import Button from '../../ui/Button'
import StepIndicator from '../../ui/StepIndicator'

export default function InventoryStep({ data, onFinish, onBack }) {
  const menuItems = data.menuItems || []
  const [inventory, setInventory] = useState(data.inventory || {})
  const [expandedItem, setExpandedItem] = useState(null)
  const [newIngredient, setNewIngredient] = useState({ name: '', quantity: '', unit: 'kg', costPerUnit: '' })

  function toggleExpand(itemId) {
    setExpandedItem(expandedItem === itemId ? null : itemId)
  }

  function getIngredients(itemId) {
    return inventory[itemId] || []
  }

  function addIngredient(itemId) {
    if (!newIngredient.name.trim()) return
    const updated = {
      ...inventory,
      [itemId]: [
        ...getIngredients(itemId),
        { id: Date.now(), ...newIngredient, name: newIngredient.name.trim() },
      ],
    }
    setInventory(updated)
    setNewIngredient({ name: '', quantity: '', unit: 'kg', costPerUnit: '' })
  }

  function removeIngredient(itemId, ingredientId) {
    setInventory({
      ...inventory,
      [itemId]: getIngredients(itemId).filter(i => i.id !== ingredientId),
    })
  }

  const totalIngredients = Object.values(inventory).reduce((sum, arr) => sum + arr.length, 0)

  return (
    <div style={{ minHeight: '100svh', background: T.bg, padding: '24px 20px 120px' }}>
      <StepIndicator current={2} total={3} labels={['Proveedores', 'Menu', 'Inventario']} />

      <h2 style={{ fontSize: 24, fontWeight: 900, color: T.navy, letterSpacing: '-.02em', marginBottom: 8 }}>
        Inventario inteligente
      </h2>
      <p style={{ fontSize: 14, fontWeight: 500, color: T.sub, marginBottom: 8, lineHeight: 1.5 }}>
        Desglosa los insumos que requiere cada plato o producto. Al registrar compras de materia prima, el sistema las conectara automaticamente.
      </p>
      {menuItems.length === 0 && (
        <div style={{
          padding: '16px 18px', borderRadius: 14, marginBottom: 20,
          background: T.amberLight, border: `1px solid ${T.amber}33`,
        }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: T.navy }}>
            No registraste productos en el paso anterior. Puedes volver y agregarlos, o continuar y configurar el inventario despues.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
        {menuItems.map(item => {
          const isExpanded = expandedItem === item.id
          const ingredients = getIngredients(item.id)
          return (
            <Card key={item.id} style={{ padding: 0, overflow: 'hidden' }}>
              <button
                onClick={() => toggleExpand(item.id)}
                style={{
                  width: '100%', padding: '16px 18px',
                  display: 'flex', alignItems: 'center', gap: 14,
                  background: 'none', border: 'none', cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: ingredients.length > 0 ? T.forestLight : T.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Package size={18} color={ingredients.length > 0 ? T.forest : T.muted} strokeWidth={1.75} />
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <p className="capitalize" style={{ fontSize: 15, fontWeight: 800, color: T.navy }}>{item.name}</p>
                  <span style={{ fontSize: 11, fontWeight: 600, color: T.muted }}>
                    {ingredients.length > 0
                      ? `${ingredients.length} ${ingredients.length === 1 ? 'insumo' : 'insumos'}`
                      : 'Sin insumos asignados'}
                  </span>
                </div>
                {isExpanded
                  ? <ChevronUp size={18} color={T.muted} strokeWidth={1.75} />
                  : <ChevronDown size={18} color={T.muted} strokeWidth={1.75} />
                }
              </button>

              {isExpanded && (
                <div style={{ padding: '0 18px 18px', borderTop: `1px solid ${T.border}` }}>
                  {ingredients.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14, marginBottom: 14 }}>
                      {ingredients.map(ing => (
                        <div key={ing.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 12px', background: T.bg, borderRadius: 10,
                        }}>
                          <Link size={12} color={T.cobalt} strokeWidth={2} />
                          <span className="capitalize" style={{ flex: 1, fontSize: 13, fontWeight: 600, color: T.navy }}>
                            {ing.name}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: T.sub }}>
                            {ing.quantity} {ing.unit}
                          </span>
                          {ing.costPerUnit && (
                            <span style={{ fontSize: 11, fontWeight: 600, color: T.forest }}>
                              $ {ing.costPerUnit}/{ing.unit}
                            </span>
                          )}
                          <button onClick={() => removeIngredient(item.id, ing.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                            <X size={14} color={T.rose} strokeWidth={2} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: ingredients.length ? 0 : 14 }}>
                    <input
                      type="text" value={newIngredient.name}
                      onChange={e => setNewIngredient({ ...newIngredient, name: e.target.value })}
                      placeholder="Nombre del insumo"
                      style={{
                        width: '100%', height: 42, paddingLeft: 12, fontSize: 13, fontWeight: 600,
                        border: `1.5px solid ${T.border}`, borderRadius: 10, background: T.surface,
                        color: T.navy, outline: 'none',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="text" inputMode="decimal" value={newIngredient.quantity}
                        onChange={e => setNewIngredient({ ...newIngredient, quantity: normMonto(e.target.value) })}
                        placeholder="Cant."
                        style={{
                          width: 70, height: 42, paddingLeft: 10, fontSize: 13, fontWeight: 700,
                          border: `1.5px solid ${T.border}`, borderRadius: 10, background: T.surface,
                          color: T.navy, outline: 'none',
                        }}
                      />
                      <select
                        value={newIngredient.unit}
                        onChange={e => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                        style={{
                          width: 70, height: 42, paddingLeft: 8, fontSize: 13, fontWeight: 600,
                          border: `1.5px solid ${T.border}`, borderRadius: 10, background: T.surface,
                          color: T.navy, outline: 'none',
                        }}
                      >
                        {['kg', 'g', 'lt', 'ml', 'und', 'oz', 'lb'].map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, fontWeight: 700, color: T.muted }}>$</span>
                        <input
                          type="text" inputMode="decimal" value={newIngredient.costPerUnit}
                          onChange={e => setNewIngredient({ ...newIngredient, costPerUnit: normMonto(e.target.value) })}
                          placeholder="Costo"
                          style={{
                            width: '100%', paddingLeft: 22, height: 42, fontSize: 13, fontWeight: 700,
                            border: `1.5px solid ${T.border}`, borderRadius: 10, background: T.surface,
                            color: T.navy, outline: 'none',
                          }}
                        />
                      </div>
                      <button onClick={() => addIngredient(item.id)} disabled={!newIngredient.name.trim()} style={{
                        width: 42, height: 42, borderRadius: 10, background: T.forest, border: 'none',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: newIngredient.name.trim() ? 1 : 0.4,
                      }}>
                        <PlusCircle size={18} color="#fff" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {totalIngredients > 0 && (
        <div style={{
          marginTop: 20, padding: '14px 18px', borderRadius: 14,
          background: T.forestLight, border: `1px solid ${T.forest}22`,
        }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: T.forest }}>
            {totalIngredients} {totalIngredients === 1 ? 'insumo registrado' : 'insumos registrados'} en total
          </p>
        </div>
      )}

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px 20px env(safe-area-inset-bottom, 16px)', background: T.bg, borderTop: `1px solid ${T.border}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Button onClick={onBack} bg={T.bg} color={T.navy} full style={{ border: `1.5px solid ${T.border}`, boxShadow: 'none' }}>
            Atras
          </Button>
          <Button onClick={() => onFinish({ inventory })} bg={T.forest} full icon={Check}>
            Finalizar
          </Button>
        </div>
      </div>
    </div>
  )
}
