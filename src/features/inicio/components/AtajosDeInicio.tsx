import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { BookOpen, Boxes, Banknote, Plus, type LucideIcon } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'

interface AtajosProps {
  puede: { vender: boolean; cobrar: boolean; catalogo: boolean; stock: boolean }
  onIr: (ruta: string) => void
}

/** Accesos rápidos de Inicio (lámina inicio-general): solo los que el usuario puede usar, cada uno con el permiso de su entrada del menú. */
export function AtajosDeInicio({ puede, onIr }: AtajosProps) {
  const atajos: { label: string; icono: LucideIcon; ruta: string; ok: boolean; primario?: boolean }[] = [
    { label: 'Nueva venta', icono: Plus, ruta: '/(tabs)/ventas/nueva', ok: puede.vender, primario: true },
    { label: 'Cobrar', icono: Banknote, ruta: '/(tabs)/cuentas', ok: puede.cobrar },
    { label: 'Catálogo', icono: BookOpen, ruta: '/(tabs)/inventario', ok: puede.catalogo },
    { label: 'Stock', icono: Boxes, ruta: '/(tabs)/inventario/stock', ok: puede.stock },
  ]
  const visibles = atajos.filter((a) => a.ok)
  if (visibles.length === 0) return null
  return (
    <View style={{ flexDirection: 'row', gap: space[3], paddingHorizontal: space[4] }}>
      {visibles.map((a) => <Atajo key={a.label} label={a.label} icono={a.icono} primario={a.primario} onPress={() => onIr(a.ruta)} />)}
    </View>
  )
}

function Atajo({ label, icono: Icono, onPress, primario = false }: { label: string; icono: LucideIcon; onPress: () => void; primario?: boolean }) {
  const c = useColors()
  // "Nueva venta" es la acción principal de la lámina: relleno de marca; el resto, contorno.
  const fondo = primario ? c.action : c.surface
  const borde = primario ? c.action : c.border
  const tinta = primario ? c.onAction : c.text
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: space[1], borderRadius: radii.tarjeta, backgroundColor: fondo, borderWidth: 1, borderColor: borde }}
    >
      <Icono size={22} color={primario ? c.onAction : c.brandInk} strokeWidth={2} />
      <Text numberOfLines={1} style={[typeScale.etiqueta, { color: tinta }]}>{label}</Text>
    </Pressable>
  )
}
