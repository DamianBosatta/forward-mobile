import React from 'react'
import { Text, View } from 'react-native'
import { Pressable } from '@/core/ui/fw/Pressable'
import type { LucideIcon } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'

/** Piezas de la ficha de un socio (clientes y proveedores): dato, acción, sección y cifra. */
export function Dato({ etiqueta, valor }: { etiqueta: string; valor?: string | null }) {
  const c = useColors()
  if (!valor?.trim()) return null
  return (
    <View style={{ gap: space[1] }}>
      <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{etiqueta}</Text>
      <Text style={{ ...typeScale.cuerpo, color: c.text }}>{valor}</Text>
    </View>
  )
}

export function Accion({ icono: Icono, label, onPress }: { icono: LucideIcon; label: string; onPress: () => void }) {
  const c = useColors()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 72,
        minHeight: 64,
        borderRadius: radii.campo,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space[1],
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Icono size={22} color={c.brandInk} />
      <Text style={{ ...typeScale.secundario, color: c.text }}>{label}</Text>
    </Pressable>
  )
}

export function Seccion({ titulo, children }: { titulo?: string; children: React.ReactNode }) {
  const c = useColors()
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[4], gap: space[3] }}>
      {titulo ? <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>{titulo}</Text> : null}
      {children}
    </View>
  )
}

/** Cifra del resumen de la ficha (saldo, vencido, crédito libre...), como las dice el servidor. */
export function Cifra({ etiqueta, valor, alerta = false }: { etiqueta: string; valor: string; alerta?: boolean }) {
  const c = useColors()
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        paddingVertical: space[2],
        paddingHorizontal: space[3],
        borderRadius: radii.tarjeta,
        backgroundColor: alerta ? c.chip.anulado.bg : c.surface,
        borderWidth: alerta ? 0 : 1,
        borderColor: c.border,
      }}
    >
      <Text style={{ ...typeScale.secundario, color: alerta ? c.chip.anulado.text : c.textSecondary }}>{etiqueta}</Text>
      <Text numberOfLines={1} style={[typeScale.cuerpoDestacado, importe, { color: alerta ? c.chip.anulado.text : c.text }]}>{valor}</Text>
    </View>
  )
}
