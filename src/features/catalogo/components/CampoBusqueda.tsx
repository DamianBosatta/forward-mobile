import React from 'react'
import { TextInput, View } from 'react-native'
import { Search } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'

interface Props {
  value: string
  onChangeText: (texto: string) => void
}

/** Buscador por código o nombre bajo la barra superior (láminas ModCatalogo y ModStock). */
export function CampoBusqueda({ value, onChangeText }: Props) {
  const c = useColors()
  return (
    <View style={{ backgroundColor: c.topBar, paddingHorizontal: space[4], paddingBottom: space[3], gap: space[3] }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[2],
          height: space[12],
          borderRadius: radii.campo,
          backgroundColor: c.surface,
          paddingHorizontal: space[3],
        }}
      >
        <Search size={20} color={c.textSecondary} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Buscar por código o nombre"
          placeholderTextColor={c.textSecondary}
          accessibilityLabel="Buscar por código o nombre"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          style={[typeScale.cuerpo, { flex: 1, color: c.text, paddingVertical: 0 }]}
        />
      </View>
    </View>
  )
}
