import React from 'react'
import { View } from 'react-native'
import { Check } from 'lucide-react-native'
import { useColors } from '@/libs/theme'

/** Círculo de elección de las filas del paso 1 (mockup ventas-nueva-1): vacío si no está elegida; con tilde si lo está. Solo marca: el toque es de la fila. */
export function MarcaRadio({ elegido }: { elegido: boolean }) {
  const c = useColors()
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: elegido ? 0 : 2, borderColor: c.border, backgroundColor: elegido ? c.action : 'transparent' }}>
      {elegido ? <Check size={14} color={c.onAction} strokeWidth={3} /> : null}
    </View>
  )
}
