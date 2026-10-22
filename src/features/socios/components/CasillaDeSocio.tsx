import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Check } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'

/** Casilla con ayuda debajo (alta provisoria). */
export function CasillaDeSocio({ label, ayuda, valor, onChange }: { label: string; ayuda: string; valor: boolean; onChange: (v: boolean) => void }) {
  const c = useColors()
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityHint={ayuda}
      accessibilityState={{ checked: valor }}
      onPress={() => onChange(!valor)}
      style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space[3] }}
    >
      <View style={{ width: 24, height: 24, borderRadius: radii.campo, borderWidth: 2, borderColor: valor ? c.brand : c.border, backgroundColor: valor ? c.brandSoft : c.surface, alignItems: 'center', justifyContent: 'center' }}>
        {valor ? <Check size={16} color={c.brandInk} /> : null}
      </View>
      <View style={{ flex: 1, gap: space[1] }}>
        <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{label}</Text>
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{ayuda}</Text>
      </View>
    </Pressable>
  )
}
