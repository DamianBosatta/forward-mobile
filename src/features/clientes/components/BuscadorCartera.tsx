import React from 'react'
import { TextInput, View } from 'react-native'
import { Search } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'

/** Buscador de la cartera, pegado a la barra superior (láminas Clientes y TabCuentaCorriente). */
export function BuscadorCartera({
  valor,
  onCambio,
  etiqueta = 'Buscar cliente',
  placeholder = 'Buscar dirección, nombre o CUIT',
  sobre = 'barra',
}: {
  valor: string
  onCambio: (texto: string) => void
  etiqueta?: string
  placeholder?: string
  /** 'barra' (por defecto): pegado a la barra superior; 'pantalla': sobre el fondo, con borde (lámina clientes-lista). */
  sobre?: 'barra' | 'pantalla'
}) {
  const c = useColors()
  return (
    <View style={sobre === 'barra' ? { backgroundColor: c.topBar, paddingHorizontal: space[4], paddingBottom: space[3] } : { paddingHorizontal: space[4], paddingTop: space[3], paddingBottom: space[2] }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[2],
          height: space[12],
          borderRadius: radii.campo,
          backgroundColor: sobre === 'barra' ? c.surface : c.surface2,
          borderWidth: sobre === 'barra' ? 0 : 1,
          borderColor: c.border,
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
