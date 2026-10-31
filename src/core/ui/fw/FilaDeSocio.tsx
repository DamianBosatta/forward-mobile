import React from 'react'
import { Pressable, Text, View } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { space, typeScale, useColors } from '@/libs/theme'

interface FilaDeSocioProps {
  /** Línea 1: lo que identifica al socio (dirección en clientes, razón social en proveedores). */
  titulo: string
  /** A la derecha de la línea 1: el saldo, "Sin deuda", un candado... */
  derecha?: React.ReactNode
  /** Línea 2, en texto secundario. */
  linea2?: string
  /** Chips o tags debajo de la línea 2. */
  extra?: React.ReactNode
  /** Acción rápida a la derecha de la fila (llamar, nueva compra), con su área táctil de 44. */
  accion?: { icono: LucideIcon; label: string; hint?: string; onPress: () => void }
  accessibilityLabel: string
  seleccionado?: boolean
  /** Sin `onPress` la fila es de solo lectura: no es un botón (sin rol ni ripple). */
  onPress?: () => void
}

/**
 * Fila plana de un socio (láminas clientes-lista y proveedores): título con algo a la derecha, línea 2,
 * extras y una acción rápida. Es la pieza que comparten clientes y proveedores (y después cuentas).
 */
export function FilaDeSocio({ titulo, derecha, linea2, extra, accion, accessibilityLabel, seleccionado = false, onPress }: FilaDeSocioProps) {
  const c = useColors()
  const estilo = {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        minHeight: 64,
        paddingVertical: space[3],
        paddingLeft: space[4],
        paddingRight: space[2],
        backgroundColor: seleccionado ? c.brandSoft : c.surface,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
  } as const
  const contenido = (
    <>
      <View style={{ flex: 1, minWidth: 0, gap: space[1] }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space[2] }}>
          <Text numberOfLines={1} style={{ ...typeScale.cuerpoDestacado, color: c.text, flexShrink: 1 }}>
            {titulo}
          </Text>
          {derecha}
        </View>
        {linea2 ? (
          <Text numberOfLines={1} style={{ ...typeScale.secundario, color: c.textSecondary }}>
            {linea2}
          </Text>
        ) : null}
        {extra}
      </View>
      {accion ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accion.label}
          accessibilityHint={accion.hint}
          onPress={accion.onPress}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <accion.icono size={20} color={c.brandInk} />
        </Pressable>
      ) : null}
    </>
  )
  if (!onPress) {
    return <View accessible accessibilityLabel={accessibilityLabel} style={estilo}>{contenido}</View>
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: seleccionado }}
      onPress={onPress}
      android_ripple={{ color: c.surface2 }}
      style={estilo}
    >
      {contenido}
    </Pressable>
  )
}
