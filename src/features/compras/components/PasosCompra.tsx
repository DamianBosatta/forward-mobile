import React from 'react'
import { Text, View } from 'react-native'
import { Check } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'

/** Los cuatro pasos de la compra nueva, con los mismos lugares que la venta (Cliente / Productos / Carrito / Entrega). */
export const PASOS_COMPRA = ['Proveedor', 'Productos', 'Carrito', 'Recepción'] as const

export type PasoCompra = 1 | 2 | 3 | 4

/**
 * Tarjeta de pasos de la compra nueva (receta FWD "tarjeta de avance"): fondo teal, texto e íconos en ink,
 * "Paso N de 4" arriba y un punto por paso (hecho = relleno ink con tilde, actual = relleno lime, pendiente = solo borde).
 * El estado va escrito en la etiqueta de cada paso: el color nunca va solo.
 */
export function PasosCompra({ paso }: { paso: PasoCompra }) {
  const c = useColors()
  return (
    <View style={{ marginHorizontal: space[4], marginTop: space[2], paddingHorizontal: space[4], paddingTop: space[4], paddingBottom: space[4], gap: space[3], borderRadius: radii.tarjetaGrande, backgroundColor: c.teal }}>
      <Text style={{ ...typeScale.tituloTarjeta, fontSize: 20, lineHeight: 26, color: c.ink }}>{`Paso ${paso} de ${PASOS_COMPRA.length}`}</Text>
      <View accessibilityRole="list" accessibilityLabel="Pasos" style={{ flexDirection: 'row' }}>
        {PASOS_COMPRA.map((nombre, i) => {
          const n = i + 1
          const actual = n === paso
          const hecho = n < paso
          return (
            <View key={nombre} accessible accessibilityLabel={`Paso ${n} de ${PASOS_COMPRA.length}: ${nombre}`} accessibilityState={{ selected: actual }} style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: space[1] }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: hecho ? 0 : 2, borderColor: c.ink, backgroundColor: hecho ? c.ink : actual ? c.lime : 'transparent' }}>
                {hecho ? <Check size={14} color={c.lime} strokeWidth={3} /> : <Text style={{ ...typeScale.etiqueta, color: c.ink }}>{n}</Text>}
              </View>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ ...typeScale.etiquetaChip, alignSelf: 'stretch', textAlign: 'center', color: c.ink }}>{nombre}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}
