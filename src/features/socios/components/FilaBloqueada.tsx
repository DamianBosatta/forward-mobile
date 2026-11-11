import React from 'react'
import { Text, View } from 'react-native'
import { Lock } from 'lucide-react-native'
import { space, typeScale, useColors } from '@/libs/theme'

/**
 * Fila bloqueada (candado y valor, frames 7, 16 y 19): un dato que este usuario no cambia, con la razón debajo
 * si se la da. El lector de pantalla oye todo junto.
 */
export function FilaBloqueada({ etiqueta, valor, razon }: { etiqueta: string; valor: string; razon?: string }) {
  const c = useColors()
  return (
    <View accessible accessibilityLabel={`${etiqueta}: ${valor}${razon ? `. ${razon}` : ''}`} style={{ gap: space[1] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], flexShrink: 1 }}>
          <Lock testID="candado" size={14} color={c.textSecondary} />
          <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{etiqueta}</Text>
        </View>
        <Text style={{ ...typeScale.secundario, fontFamily: typeScale.cuerpoDestacado.fontFamily, fontWeight: '600', color: c.text, textAlign: 'right', flexShrink: 1 }}>{valor}</Text>
      </View>
      {razon ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{razon}</Text> : null}
    </View>
  )
}
