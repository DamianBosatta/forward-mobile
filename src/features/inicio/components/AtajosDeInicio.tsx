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
  const atajos: { label: string; icono: LucideIcon; ruta: string; ok: boolean }[] = [
    { label: 'Nueva venta', icono: Plus, ruta: '/(tabs)/ventas/nueva', ok: puede.vender },
    { label: 'Cobrar', icono: Banknote, ruta: '/(tabs)/cuentas', ok: puede.cobrar },
    { label: 'Catálogo', icono: BookOpen, ruta: '/(tabs)/inventario', ok: puede.catalogo },
    { label: 'Stock', icono: Boxes, ruta: '/(tabs)/inventario/stock', ok: puede.stock },
  ]
  const visibles = atajos.filter((a) => a.ok)
  if (visibles.length === 0) return null
  return (
    <View style={{ flexDirection: 'row', gap: space[3], paddingHorizontal: space[4] }}>
      {visibles.map((a) => <Atajo key={a.label} {...a} onPress={() => onIr(a.ruta)} />)}
    </View>
  )
}

function Atajo({ label, icono: Icono, onPress }: { label: string; icono: LucideIcon; onPress: () => void }) {
  const c = useColors()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: space[1], borderRadius: radii.tarjeta, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}
    >
      <Icono size={22} color={c.brandInk} strokeWidth={2} />
      <Text numberOfLines={1} style={[typeScale.etiqueta, { color: c.text }]}>{label}</Text>
    </Pressable>
  )
}
