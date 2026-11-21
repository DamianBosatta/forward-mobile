import React from 'react'
import { Text, View } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import { importe as cifras, radii, space, typeScale, useColors } from '@/libs/theme'
import { PressableFx } from '@/core/ui/fw/PressableFx'

/** Mosaico de grilla (receta `.tile`, radio 28, sin borde): etiqueta arriba y la cifra en `accentText`; con destino, una flecha y 44 pt como mínimo. */
export function MosaicoDeInicio({ etiqueta, valor, onPress }: { etiqueta: string; valor: string; onPress?: () => void }) {
  const c = useColors()
  const estilo = { flex: 1, minWidth: 0, minHeight: 96, paddingVertical: space[4], paddingHorizontal: space[5], gap: space[2], justifyContent: 'space-between' as const, borderRadius: radii.tile, backgroundColor: c.surface }
  const contenido = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[1] }}>
        <Text style={[typeScale.secundario, { color: c.textSecondary, flexShrink: 1 }]} numberOfLines={1}>{etiqueta}</Text>
        {onPress ? <ChevronRight size={18} color={c.textSecondary} strokeWidth={2} /> : null}
      </View>
      <Text style={[typeScale.titulo, cifras, { color: c.accentText }]} numberOfLines={1} adjustsFontSizeToFit>{valor}</Text>
    </>
  )
  if (onPress) {
    return (
      <PressableFx accessibilityRole="button" accessibilityLabel={`${etiqueta}: ${valor}`} onPress={onPress} android_ripple={{ color: c.surface2 }} style={estilo}>
        {contenido}
      </PressableFx>
    )
  }
  return (
    <View accessible accessibilityLabel={`${etiqueta}: ${valor}`} style={estilo}>
      {contenido}
    </View>
  )
}
