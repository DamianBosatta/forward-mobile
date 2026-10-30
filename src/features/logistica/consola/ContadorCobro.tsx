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
  const dato = (rotulo: string, valor: number, color: string) => (
    <View style={{ flex: 1 }}>
      <Text style={{ ...typeScale.etiqueta, color: c.textSecondary, textTransform: 'uppercase' }}>{rotulo}</Text>
      <Text maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit style={{ ...typeScale.titulo, ...importe, fontSize: 26, lineHeight: 32, color }}>
        {formatImporte(valor)}
      </Text>
    </View>
  )
  return (
    <View
      accessibilityLabel="Cobrado y falta"
      accessibilityLiveRegion="polite"
      style={{ flexDirection: 'row', gap: space[3], padding: space[3], marginHorizontal: space[4], marginTop: space[3], borderRadius: radii.tarjeta, backgroundColor: c.surface, borderWidth: 2, borderColor: c.border }}
    >
      {dato('Cobrado', cobrado, c.text)}
      {falta != null ? dato('Falta', falta, falta > 0 ? c.chip.porAutorizar.text : c.brandInk) : null}
    </View>
  )
}
