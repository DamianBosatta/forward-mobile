import React from 'react'
import { Text, View } from 'react-native'
import { space, useColors } from '@/libs/theme'

export interface PasoDeEstado { label: string; estado: 'hecho' | 'actual' | 'pendiente' }

const DESCRIPCION = { hecho: 'hecho', actual: 'paso actual', pendiente: 'pendiente' } as const

/**
 * Camino de un documento bajo la barra superior (lienzo ResCompraDetalle): una barra por paso, llena
 * en los pasos hechos y en el actual, con el nombre debajo. Va sobre el fondo de la barra superior.
 */
export function PasosDeEstado({ pasos, accessibilityLabel }: { pasos: PasoDeEstado[]; accessibilityLabel: string }) {
  const c = useColors()
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={{ flexDirection: 'row', gap: 6, paddingHorizontal: space[3], paddingTop: space[1], paddingBottom: space[4], backgroundColor: c.topBar }}
    >
      {pasos.map((p) => (
        <View key={p.label} accessible accessibilityLabel={`${p.label}, ${DESCRIPCION[p.estado]}`} style={{ flex: 1, gap: 6 }}>
          <View style={{ height: 6, borderRadius: 999, backgroundColor: p.estado === 'pendiente' ? c.topBarBorder : c.brand }} />
          <Text style={{ fontSize: 12, lineHeight: 16, color: p.estado === 'actual' ? c.onTopBarStrong : c.onTopBar, fontWeight: p.estado === 'actual' ? '700' : '400' }}>
            {p.label}
          </Text>
        </View>
      ))}
    </View>
  )
}
