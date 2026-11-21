import React from 'react'
import { Text, View } from 'react-native'
import { ChevronRight, Lock, type LucideIcon } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { MotivoDeshabilitado } from '@/core/ui/fw/MotivoDeshabilitado'
import { PressableFx } from '@/core/ui/fw/PressableFx'

interface Props {
  icon: LucideIcon
  title: string
  subtitle: string
  onPress: () => void
  /** Sin permiso: la fila no se oculta; el ícono pasa a candado, el título va en gris, sin flecha, con el motivo adentro. */
  motivo?: string
}

/**
 * Fila de acción de Tesorería (propuesta "Finanzas como venta", frames 8 y 9; galería v2, tesoreria-inicio):
 * píldora separada de 76 px (FWD), ícono en un cuadrado de 48 y flecha. Sin permiso, en lugar de atenuar toda la fila, candado y motivo completo.
 */
export function FilaDeTesoreria({ icon: Icono, title, subtitle, onPress, motivo }: Props) {
  const c = useColors()
  const bloqueada = motivo !== undefined
  return (
    <PressableFx
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={motivo ?? subtitle}
      accessibilityState={{ disabled: bloqueada }}
      disabled={bloqueada}
      onPress={onPress}
      android_ripple={bloqueada ? undefined : { color: c.surface2 }}
      style={{ minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], paddingLeft: space[3], paddingRight: space[4], borderRadius: radii.fila, backgroundColor: c.surface }}
    >
      <View
        testID="fila-icono"
        style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center', alignSelf: bloqueada ? 'flex-start' : 'center' }}
      >
        {bloqueada ? <View testID="fila-candado"><Lock size={24} color={c.textSecondary} /></View> : <Icono size={24} color={c.text} />}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...typeScale.textoFila, color: bloqueada ? c.textSecondary : c.text }}>{title}</Text>
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{subtitle}</Text>
        {bloqueada ? <View style={{ marginTop: space[2] }}><MotivoDeshabilitado>{motivo}</MotivoDeshabilitado></View> : null}
      </View>
      {bloqueada ? null : (
        <View testID="fila-chevron">
          <ChevronRight size={20} color={c.text} />
        </View>
      )}
    </PressableFx>
  )
}
