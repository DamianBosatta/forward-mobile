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
 * Barra de pasos de un flujo de alta (compra nueva): un punto por paso con su número, tilde en los hechos y una
 * barra entre punto y punto, sobre el fondo de la barra superior. El color nunca va solo: el hecho lleva tilde
 * y el actual, número. Misma forma que PasosVenta, que lleva sus nombres fijos.
 */
export function PasosNumerados({ nombres, paso }: Props) {
  const c = useColors()
  return (
    <View accessibilityRole="list" accessibilityLabel="Pasos" style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], paddingHorizontal: space[4], paddingTop: space[1], paddingBottom: space[3], backgroundColor: c.topBar }}>
      {nombres.map((nombre, i) => {
        const n = i + 1
        const actual = n === paso
        const hecho = n < paso
        return (
          <React.Fragment key={nombre}>
            {i > 0 ? <View style={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: n <= paso ? c.action : c.topBarBorder }} /> : null}
            <View accessible accessibilityLabel={`Paso ${n} de ${nombres.length}: ${nombre}`} accessibilityState={{ selected: actual }} style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: actual || hecho ? c.action : 'transparent', borderWidth: actual || hecho ? 0 : 1, borderColor: c.onTopBar }}>
                {hecho ? <Check size={14} color={c.onAction} strokeWidth={3} /> : (
                  <Text style={{ ...typeScale.etiqueta, color: actual ? c.onAction : c.onTopBar, fontWeight: '600' }}>{n}</Text>
                )}
              </View>
              <Text style={{ ...typeScale.etiqueta, color: actual ? c.onTopBarStrong : c.onTopBar, fontWeight: actual ? '600' : '400' }}>{nombre}</Text>
            </View>
          </React.Fragment>
        )
      })}
    </View>
  )
}
