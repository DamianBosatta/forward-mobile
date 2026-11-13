import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import { importe as cifras, radii, space, typeScale, useColors } from '@/libs/theme'

/** Mosaico sin borde (galería v2): etiqueta arriba y la cifra; con destino, una flecha y 44 pt de alto como mínimo. */
export function MosaicoDeInicio({ etiqueta, valor, onPress }: { etiqueta: string; valor: string; onPress?: () => void }) {
  const c = useColors()
  const estilo = { flex: 1, minWidth: 0, minHeight: 44, paddingVertical: space[3], paddingHorizontal: space[4], gap: 2, borderRadius: radii.tarjeta, backgroundColor: c.surface }
  const contenido = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[1] }}>
        <Text style={[typeScale.secundario, { color: c.textSecondary, flexShrink: 1 }]} numberOfLines={1}>{etiqueta}</Text>
        {onPress ? <ChevronRight size={18} color={c.textSecondary} strokeWidth={2} /> : null}
      </View>
      <Text style={[typeScale.titulo, cifras, { color: c.text }]} numberOfLines={1} adjustsFontSizeToFit>{valor}</Text>
    </>
  )
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`${etiqueta}: ${valor}`} onPress={onPress} android_ripple={{ color: c.surface2 }} style={estilo}>
        {contenido}
      </Pressable>
    )
  }
  return (
    <View accessible accessibilityLabel={`${etiqueta}: ${valor}`} style={estilo}>
      {contenido}
    </View>
  )
}
