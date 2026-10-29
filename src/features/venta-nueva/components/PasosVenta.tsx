import React from 'react'
import { Text, View } from 'react-native'
import { space, typeScale, useColors } from '@/libs/theme'

const PASOS = ['Cliente', 'Productos', 'Confirmar'] as const

interface Props {
  /** El paso en el que está la venta: 1 cliente, 2 productos, 3 revisar y confirmar. */
  paso: 1 | 2 | 3
}

/**
 * Barra de pasos de la venta nueva (láminas Cliente, Catálogo y Carrito): "1 · Cliente / 2 · Productos / 3 · Confirmar".
 * Va debajo de la barra superior en las tres pantallas; el paso actual se marca con el color de la marca.
 */
export function PasosVenta({ paso }: Props) {
  const c = useColors()
  return (
    <View accessibilityRole="list" accessibilityLabel="Pasos" style={{ flexDirection: 'row', gap: space[2], paddingHorizontal: space[4], paddingTop: space[1], paddingBottom: space[3], backgroundColor: c.topBar }}>
      {PASOS.map((nombre, i) => {
        const actual = i + 1 === paso
        return (
          <View
            key={nombre}
            accessible
            accessibilityLabel={`Paso ${i + 1} de 3: ${nombre}`}
            accessibilityState={{ selected: actual }}
            style={{ flex: 1, gap: space[1] }}
          >
            <View style={{ height: 4, borderRadius: 2, backgroundColor: actual ? c.brand : c.border }} />
            <Text style={{ ...typeScale.etiqueta, color: actual ? c.brand : c.onTopBar, fontWeight: actual ? '600' : '400' }}>{`${i + 1} · ${nombre}`}</Text>
          </View>
        )
      })}
    </View>
  )
}
