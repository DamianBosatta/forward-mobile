import React from 'react'
import { Text, View, type ViewStyle } from 'react-native'
import { Check } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'

/** Los cuatro pasos de la compra nueva, con los mismos lugares que la venta (Cliente / Productos / Carrito / Entrega). */
export const PASOS_COMPRA = ['Proveedor', 'Productos', 'Carrito', 'Recepción'] as const

export type PasoCompra = 1 | 2 | 3 | 4

export interface PasoDeAvance {
  label: string
  estado: 'hecho' | 'actual' | 'pendiente'
  /** Lo que lee el lector de pantalla del paso (el estado va escrito: el color nunca va solo). */
  accessibilityLabel: string
}

/**
 * Tarjeta de avance (receta FWD): fondo teal, texto e íconos en ink, "titulo" arriba si viene y un punto por paso
 * (hecho = relleno ink con tilde, actual = relleno lime, pendiente = solo borde). La usan los pasos de la compra
 * nueva y el camino de estado del detalle de una compra.
 */
export function TarjetaDeAvance({ pasos, titulo, accessibilityLabel, style }: { pasos: PasoDeAvance[]; titulo?: string; accessibilityLabel?: string; style?: ViewStyle }) {
  const c = useColors()
  return (
    <View accessibilityLabel={accessibilityLabel} style={[{ paddingHorizontal: space[4], paddingTop: space[4], paddingBottom: space[4], gap: space[3], borderRadius: radii.tarjetaGrande, backgroundColor: c.teal }, style]}>
      {titulo ? <Text style={{ ...typeScale.tituloTarjeta, fontSize: 20, lineHeight: 26, color: c.ink }}>{titulo}</Text> : null}
      <View accessibilityRole="list" accessibilityLabel="Pasos" style={{ flexDirection: 'row' }}>
        {pasos.map((p, i) => {
          const actual = p.estado === 'actual'
          const hecho = p.estado === 'hecho'
          return (
            <View key={p.label} accessible accessibilityLabel={p.accessibilityLabel} accessibilityState={{ selected: actual }} style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: space[1] }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: hecho ? 0 : 2, borderColor: c.ink, backgroundColor: hecho ? c.ink : actual ? c.lime : 'transparent' }}>
                {hecho ? <Check size={14} color={c.lime} strokeWidth={3} /> : <Text style={{ ...typeScale.etiqueta, color: c.ink }}>{i + 1}</Text>}
              </View>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ ...typeScale.etiquetaChip, alignSelf: 'stretch', textAlign: 'center', color: c.ink }}>{p.label}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

/** Tarjeta de pasos de la compra nueva: "Paso N de 4" y los cuatro pasos. */
export function PasosCompra({ paso }: { paso: PasoCompra }) {
  const pasos: PasoDeAvance[] = PASOS_COMPRA.map((nombre, i) => ({
    label: nombre,
    estado: i + 1 < paso ? 'hecho' : i + 1 === paso ? 'actual' : 'pendiente',
    accessibilityLabel: `Paso ${i + 1} de ${PASOS_COMPRA.length}: ${nombre}`,
  }))
  return <TarjetaDeAvance titulo={`Paso ${paso} de ${PASOS_COMPRA.length}`} pasos={pasos} style={{ marginHorizontal: space[4], marginTop: space[2] }} />
}
