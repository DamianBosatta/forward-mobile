import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { rotuloDeModo, type ModoCantidad, type Presentacion } from '../lib/presentacion'

interface Props {
  presentacion: Presentacion
  modo: ModoCantidad
  onCambiar: (modo: ModoCantidad) => void
  /** Compacto en la tarjeta del catálogo; normal en la hoja de la línea. */
  compacto?: boolean
}

/** "Se vende por" (mockups ventas-nueva-2-productos): Unid. / Pack · N / Bulto · N. Con un solo modo no se dibuja. */
export function SeVendePor({ presentacion, modo, onCambiar, compacto = false }: Props) {
  const c = useColors()
  if (presentacion.modos.length < 2) return null
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Se vende por" style={{ flexDirection: 'row', alignSelf: 'flex-start', padding: 2, borderRadius: radii.campo, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border }}>
      {presentacion.modos.map((m) => {
        const activo = modo === m
        return (
          <Pressable key={m} accessibilityRole="button" accessibilityLabel={rotuloDeModo(presentacion, m)} accessibilityState={{ selected: activo }} onPress={() => onCambiar(m)}
            style={{ minHeight: compacto ? 32 : 40, paddingHorizontal: space[3], borderRadius: radii.campo, justifyContent: 'center', backgroundColor: activo ? c.action : 'transparent' }}>
            <Text style={{ ...(compacto ? typeScale.secundario : typeScale.cuerpoDestacado), color: activo ? c.onAction : c.textSecondary }}>{rotuloDeModo(presentacion, m)}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}
