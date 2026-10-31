import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { ChevronRight, type LucideIcon } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'

interface Props {
  title: string
  /** Segunda línea ("Mové plata entre tus cuentas"). */
  subtitle?: string
  icon: LucideIcon
  disabled?: boolean
  /** Dentro de una tarjeta de lista: sin borde ni fondo propios y con ícono gris; la tarjeta y los divisores los pone quien agrupa. */
  agrupada?: boolean
  onPress: () => void
}

/**
 * Fila de acción de una lista de inicio (lámina tesoreria-inicio): ícono en recuadro, título, subtítulo y
 * flecha. Alto mínimo 72. Deshabilitada baja la opacidad y avisa por `accessibilityState`; el motivo lo
 * pone quien la usa con MotivoDeshabilitado.
 */
export function FilaDeAccion({ title, subtitle, icon: Icono, disabled = false, agrupada = false, onPress }: Props) {
  const c = useColors()
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      style={{
        minHeight: 72,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        paddingHorizontal: space[4],
        ...(agrupada ? {} : { borderRadius: radii.tarjeta, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }),
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <View style={{ width: 40, height: 40, borderRadius: radii.campo, alignItems: 'center', justifyContent: 'center', backgroundColor: agrupada ? c.surface2 : c.brandSoft }}>
        <Icono size={22} color={agrupada ? c.textSecondary : c.brandInk} strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{title}</Text>
        {subtitle ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{subtitle}</Text> : null}
      </View>
      <ChevronRight size={20} color={c.textSecondary} strokeWidth={2} />
    </Pressable>
  )
}
