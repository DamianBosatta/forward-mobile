import React from 'react'
import { View } from 'react-native'
import { radii, space, useColors } from '@/libs/theme'

interface Bloque {
  alto: number
  radio?: number
  testID?: string
}

/**
 * Bloques quietos que ocupan el lugar de lo que carga (propuesta "Clientes como venta", frames 3, 12, 14 y 20).
 * Sin animación a propósito: el `Skeleton` de src/core/ui late y no respeta Reduce Motion.
 * El lector de pantalla oye "Cargando" una sola vez.
 */
export function Esqueletos({ bloques }: { bloques: Bloque[] }) {
  const c = useColors()
  return (
    <View accessible accessibilityLabel="Cargando" accessibilityRole="progressbar" style={{ gap: space[3] }}>
      {bloques.map((b, i) => (
        <View key={i} testID={b.testID ?? 'esqueleto-fila'} style={{ height: b.alto, borderRadius: b.radio ?? radii.tarjeta, backgroundColor: c.surface2 }} />
      ))}
    </View>
  )
}

/** Dos filas de lista (cartera, ventas, movimientos). */
export const FILAS_CARGANDO: Bloque[] = [{ alto: 76 }, { alto: 76 }]
/** El hero de saldo y dos filas (ficha cargando, frame 12). */
export const FICHA_CARGANDO: Bloque[] = [{ alto: 180, radio: radii.hoja, testID: 'esqueleto-hero' }, ...FILAS_CARGANDO]
/** Las tarjetas del formulario (editar cliente cargando, frame 20). */
export const FORMULARIO_CARGANDO: Bloque[] = [{ alto: 160, testID: 'esqueleto-tarjeta' }, { alto: 76 }]
