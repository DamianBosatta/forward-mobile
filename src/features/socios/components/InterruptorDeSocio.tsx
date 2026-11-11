import React from 'react'
import { Pressable, Switch, Text, View } from 'react-native'
import { space, typeScale, useColors } from '@/libs/theme'

/**
 * Interruptor con ayuda debajo (alta provisoria), como "Con factura" de la venta (propuesta "Clientes como venta",
 * frame 15). La fila entera es el control; el `Switch` es solo la marca visual. Antes era una casilla.
 */
export function InterruptorDeSocio({ label, ayuda, valor, onChange }: { label: string; ayuda: string; valor: boolean; onChange: (v: boolean) => void }) {
  const c = useColors()
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={ayuda}
      accessibilityState={{ checked: valor }}
      onPress={() => onChange(!valor)}
      style={{ minHeight: 48, flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}
    >
      <View style={{ flex: 1, gap: space[1] }}>
        <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{label}</Text>
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{ayuda}</Text>
      </View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
        <Switch value={valor} trackColor={{ false: c.border, true: c.action }} thumbColor={valor ? c.onAction : c.textSecondary} />
      </View>
    </Pressable>
  )
}
