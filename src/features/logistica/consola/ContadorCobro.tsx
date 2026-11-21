import React from 'react'
import { Text, View } from 'react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { formatImporte } from '@/core/ui/fw'

interface Props {
  cobrado: number
  /** Lo que falta cobrar; `null` si el servidor no mandó cuánto hay que cobrar. */
  falta: number | null
}

/**
 * Lámina chofer-04: contador fijo "Cobrado $X · Falta $Y", siempre a la vista arriba del cobro. "Falta"
 * lleva texto además del color. Es informativo: lo que falta no frena nada.
 */
export function ContadorCobro({ cobrado, falta }: Props) {
  const c = useColors()
  // Cobrado va en la tarjeta lime (la única de la pantalla); Falta en superficie. Los dos con tinta de texto.
  const dato = (rotulo: string, valor: number, fondo: string, color: string) => (
    <View style={{ flex: 1, backgroundColor: fondo, borderRadius: radii.fila, paddingVertical: space[3], paddingHorizontal: space[4] }}>
      <Text style={{ ...typeScale.etiqueta, color, opacity: 0.78, textTransform: 'uppercase' }}>{rotulo}</Text>
      <Text maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit style={{ ...typeScale.destacado, ...importe, color }}>
        {formatImporte(valor)}
      </Text>
    </View>
  )
  return (
    <View
      accessibilityLabel="Cobrado y falta"
      accessibilityLiveRegion="polite"
      style={{ flexDirection: 'row', gap: space[3], marginHorizontal: space[4], marginTop: space[3] }}
    >
      {dato('Cobrado', cobrado, c.lime, c.ink)}
      {falta != null ? dato('Falta', falta, c.surface, c.text) : null}
    </View>
  )
}
