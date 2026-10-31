import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import type { ChipEstado } from '@/libs/theme'

export interface FilaParaResolver {
  titulo: string
  detalle: string
  /** `null` = sin dato: la fila no se muestra (nunca un 0 inventado). */
  cantidad: number | null
  /** Color de la pastilla, de los chips de estado del tema. */
  tono: ChipEstado
  onPress: () => void
}

/** "Para resolver" (lámina inicio-general): una fila por pendiente con su cantidad en pastilla y un chevron. */
export function ParaResolver({ filas }: { filas: FilaParaResolver[] }) {
  const c = useColors()
  const visibles = filas.filter((f) => f.cantidad != null)
  if (visibles.length === 0) return null
  return (
    <View style={{ paddingHorizontal: space[4], gap: space[3] }}>
      <Text accessibilityRole="header" style={[typeScale.seccion, { color: c.text }]}>Para resolver</Text>
      <View testID="para-resolver" style={{ borderRadius: radii.tarjeta, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
        {visibles.map((f, i) => (
          <Pressable
            key={f.titulo}
            accessibilityRole="button"
            accessibilityLabel={`Para resolver, ${f.titulo}: ${f.cantidad}`}
            onPress={f.onPress}
            android_ripple={{ color: c.surface2 }}
            style={{
              minHeight: 64,
              paddingHorizontal: space[4],
              paddingVertical: space[3],
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[3],
              borderTopWidth: i > 0 ? 1 : 0,
              borderTopColor: c.border,
            }}
          >
            <View style={{ minWidth: 44, height: 44, paddingHorizontal: space[2], borderRadius: radii.pastilla, backgroundColor: c.chip[f.tono].bg, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={[typeScale.cuerpoDestacado, importe, { color: c.chip[f.tono].text }]}>{f.cantidad}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[typeScale.cuerpoDestacado, { color: c.text }]} numberOfLines={1}>{f.titulo}</Text>
              <Text style={[typeScale.secundario, { color: c.textSecondary }]} numberOfLines={1}>{f.detalle}</Text>
            </View>
            <ChevronRight size={20} color={c.textSecondary} strokeWidth={2} />
          </Pressable>
        ))}
      </View>
    </View>
  )
}
