import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { FONT, importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { COLUMNAS, type ColumnaId } from './tablero'

const semibold = { fontFamily: FONT.semibold, fontWeight: '600' as const }

/**
 * Pestañas por estado (PestanasEstado de la web, hasta 899 px) en dos filas de dos: cada una con ícono, nombre y
 * cantidad, así "cuántos hay en cada estado" se lee sin entrar. La elegida toma el color de su columna.
 * `conteos` null: el servidor no respondió y van sin número.
 */
export function PestanasEstado({ activa, conteos, onCambiar }: { activa: ColumnaId; conteos: Record<ColumnaId, number> | null; onCambiar: (id: ColumnaId) => void }) {
  const c = useColors()
  const filas = [COLUMNAS.slice(0, 2), COLUMNAS.slice(2, 4)]
  return (
    <View accessibilityRole="tablist" accessibilityLabel="Estados del tablero" style={{ gap: space[2] }}>
      {filas.map((fila, i) => (
        <View key={i} testID="fila-pestanas" style={{ flexDirection: 'row', gap: space[2] }}>
          {fila.map(({ id, titulo, icono: Icono, tono }) => {
            const sel = id === activa
            const colores = c.chip[tono]
            const n = conteos?.[id]
            return (
              <Pressable
                key={id}
                onPress={() => onCambiar(id)}
                android_ripple={{ color: c.surface2 }}
                accessibilityRole="tab"
                accessibilityLabel={n === undefined ? titulo : `${titulo}: ${n} ${n === 1 ? 'pedido' : 'pedidos'}`}
                accessibilityState={{ selected: sel }}
                style={{
                  flex: 1, minWidth: 0, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: space[2], padding: space[2],
                  borderRadius: radii.campo, borderWidth: sel ? 2 : 1, borderColor: sel ? colores.text : c.border,
                  backgroundColor: sel ? colores.bg : c.surface,
                }}
              >
                <Icono size={20} color={sel ? colores.text : c.textSecondary} />
                <Text style={{ ...typeScale.secundario, ...semibold, color: c.text, flex: 1 }} numberOfLines={2}>{titulo}</Text>
                {n === undefined ? null : (
                  <View style={{ minWidth: 24, height: 24, borderRadius: radii.pastilla, paddingHorizontal: space[1], alignItems: 'center', justifyContent: 'center', backgroundColor: colores.bg }}>
                    <Text maxFontSizeMultiplier={1.3} style={{ ...typeScale.etiqueta, ...importe, color: colores.text }}>{n}</Text>
                  </View>
                )}
              </Pressable>
            )
          })}
        </View>
      ))}
    </View>
  )
}
