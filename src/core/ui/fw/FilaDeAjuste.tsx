import React from 'react'
import { Pressable, Switch, Text, View } from 'react-native'
import { ChevronRight, type LucideIcon } from 'lucide-react-native'
import { space, typeScale, useColors } from '@/libs/theme'

interface FilaBase {
  titulo: string
  /** Línea de apoyo bajo el título: el estado también se dice en palabras, no solo con el interruptor. */
  apoyo?: string
  icono?: LucideIcon
  /** Raya inferior; va en todas las filas de una tarjeta menos la última. */
  conDivisor?: boolean
}

function useFila(conDivisor?: boolean) {
  const c = useColors()
  return {
    c,
    fila: [
      { minHeight: 64, paddingHorizontal: space[4], paddingVertical: space[2], flexDirection: 'row' as const, alignItems: 'center' as const, gap: space[3] },
      conDivisor ? { borderBottomWidth: 1, borderBottomColor: c.border } : null,
    ],
  }
}

function Contenido({ titulo, apoyo, icono: Icono }: FilaBase) {
  const c = useColors()
  return (
    <>
      {Icono ? <Icono size={24} color={c.text} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>{titulo}</Text>
        {apoyo ? <Text style={[typeScale.secundario, { color: c.textSecondary }]}>{apoyo}</Text> : null}
      </View>
    </>
  )
}

/** Fila de ajuste que lleva a otra pantalla: ícono, título, apoyo y flecha. La fila entera es el botón. */
export function FilaDeAjuste({ onPress, ...base }: FilaBase & { onPress: () => void }) {
  const { c, fila } = useFila(base.conDivisor)
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={base.titulo} onPress={onPress} style={fila}>
      <Contenido {...base} />
      <ChevronRight size={20} color={c.textSecondary} />
    </Pressable>
  )
}

/** Fila de ajuste con interruptor. La fila entera es el control; el `Switch` es solo la marca visual. */
export function FilaInterruptor({
  prendido,
  onChange,
  disabled = false,
  ...base
}: FilaBase & { prendido: boolean; onChange: () => void; disabled?: boolean }) {
  const { c, fila } = useFila(base.conDivisor)
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={base.titulo}
      accessibilityState={{ checked: prendido, disabled }}
      onPress={disabled ? undefined : onChange}
      style={fila}
    >
      <Contenido {...base} />
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
        <Switch
          value={prendido}
          disabled={disabled}
          trackColor={{ false: c.border, true: c.action }}
          thumbColor={prendido ? c.onAction : c.textSecondary}
        />
      </View>
    </Pressable>
  )
}
