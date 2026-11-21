import React from 'react'
import { Text, View } from 'react-native'
import { Check } from 'lucide-react-native'
import { space, typeScale, useColors } from '@/libs/theme'

interface Props {
  /** Nombres de los pasos, en orden (tres en los flujos de documento: p. ej. Proveedor, Productos, Confirmar). */
  nombres: readonly string[]
  /** El paso en el que está el flujo, desde 1. */
  paso: number
}

/**
 * Barra de pasos de un flujo de alta (compra nueva): un círculo por paso (hecho: teal con tilde; actual: lima con el número; pendiente: contorno)
 * y una barra entre círculo y círculo (teal en lo hecho), sobre el fondo de la barra superior. Texto sobre teal y lima: siempre `ink`. El color nunca va solo: el hecho lleva tilde
 * y el actual, número. Misma forma que PasosVenta, que lleva sus nombres fijos.
 */
export function PasosNumerados({ nombres, paso }: Props) {
  const c = useColors()
  const ultimo = nombres.length - 1
  // Cada paso ocupa una columna del mismo ancho (punto arriba, nombre abajo): con cuatro pasos entran en 360 de ancho
  // sin que el último quede cortado. La barra va de un punto al otro, centrada en el punto; la de relleno marca lo hecho.
  const barra = (lleno: boolean) => (
    <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: lleno ? c.teal : c.surfaceAlt }} />
  )
  return (
    <View accessibilityRole="list" accessibilityLabel="Pasos" style={{ flexDirection: 'row', paddingHorizontal: space[2], paddingTop: space[1], paddingBottom: space[3], backgroundColor: c.topBar }}>
      {nombres.map((nombre, i) => {
        const n = i + 1
        const actual = n === paso
        const hecho = n < paso
        return (
          <View key={nombre} accessible accessibilityLabel={`Paso ${n} de ${nombres.length}: ${nombre}`} accessibilityState={{ selected: actual }} style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: space[1] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
              {i > 0 ? barra(n <= paso) : <View style={{ flex: 1 }} />}
              <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: hecho ? c.teal : actual ? c.lime : 'transparent', borderWidth: actual || hecho ? 0 : 2, borderColor: c.textSecondary }}>
                {hecho ? <Check size={16} color={c.ink} strokeWidth={3} /> : (
                  <Text style={{ ...typeScale.etiqueta, color: actual ? c.ink : c.textSecondary }}>{n}</Text>
                )}
              </View>
              {i < ultimo ? barra(n < paso) : <View style={{ flex: 1 }} />}
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ ...typeScale.etiqueta, alignSelf: 'stretch', textAlign: 'center', color: actual ? c.onTopBarStrong : c.onTopBar, fontWeight: actual ? '600' : '400' }}>{nombre}</Text>
          </View>
        )
      })}
    </View>
  )
}
