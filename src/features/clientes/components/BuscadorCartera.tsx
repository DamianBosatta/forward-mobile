import React from 'react'
import { TextInput, View } from 'react-native'
import { Search } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'

/** Buscador de la cartera, pegado a la barra superior (láminas Clientes y TabCuentaCorriente). */
export function BuscadorCartera({ valor, onCambio, etiqueta = 'Buscar cliente', placeholder = 'Dirección, nombre o CUIT' }: { valor: string; onCambio: (texto: string) => void; etiqueta?: string; placeholder?: string }) {
  const c = useColors()
  return (
    <View style={{ backgroundColor: c.topBar, paddingHorizontal: space[4], paddingBottom: space[3] }}>
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
          accessibilityLabel={etiqueta}
          placeholder={placeholder}
          placeholderTextColor={c.textSecondary}
          value={valor}
          onChangeText={onCambio}
          autoCorrect={false}
          returnKeyType="search"
          style={{ ...typeScale.cuerpo, flex: 1, color: c.text, paddingVertical: 0 }}
        />
      </View>
    </View>
  )
}
