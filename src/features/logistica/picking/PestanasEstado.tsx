import React from 'react'
import { Text, View } from 'react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { PressableFx } from '@/core/ui/fw/PressableFx'
import { COLUMNAS, type ColumnaId } from './tablero'
import { pesoSemibold } from '@/core/ui/fw'


/**
 * Pestañas por estado (PestanasEstado de la web, hasta 899 px) en dos filas de dos: cada una con ícono, nombre y
 * cantidad, así "cuántos hay en cada estado" se lee sin entrar. La elegida va en relleno del botón principal.
 * `conteos` null: el servidor no respondió y van sin número.
 */
export function PestanasEstado({ activa, conteos, onCambiar }: { activa: ColumnaId; conteos: Record<ColumnaId, number> | null; onCambiar: (id: ColumnaId) => void }) {
  const c = useColors()
  const filas = [COLUMNAS.slice(0, 2), COLUMNAS.slice(2, 4)]
  return (
    <View accessibilityRole="tablist" accessibilityLabel="Estados del tablero" style={{ gap: space[2] }}>
      {filas.map((fila, i) => (
        <View key={i} testID="fila-pestanas" style={{ flexDirection: 'row', gap: space[2] }}>
          {fila.map(({ id, titulo, icono: Icono }) => {
            const sel = id === activa
            const n = conteos?.[id]
            return (
              <PressableFx
                key={id}
                onPress={() => onCambiar(id)}
                android_ripple={{ color: c.surfaceAlt }}
                accessibilityRole="tab"
                accessibilityLabel={n === undefined ? titulo : `${titulo}: ${n} ${n === 1 ? 'pedido' : 'pedidos'}`}
                accessibilityState={{ selected: sel }}
                style={{
                  flex: 1, minWidth: 0, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space[2], paddingVertical: space[2], paddingHorizontal: space[4],
                  borderRadius: radii.pastilla, backgroundColor: sel ? c.primaryBg : c.surface,
                }}
              >
                <Icono size={20} color={sel ? c.primaryFg : c.text} />
                <Text style={{ ...typeScale.secundario, ...pesoSemibold, color: sel ? c.primaryFg : c.text, flex: 1 }} numberOfLines={2}>{titulo}</Text>
                {n === undefined ? null : (
                  <View style={{ minWidth: 24, height: 24, borderRadius: radii.pastilla, paddingHorizontal: space[1], alignItems: 'center', justifyContent: 'center', backgroundColor: sel ? c.primaryFg : c.surfaceAlt }}>
                    <Text maxFontSizeMultiplier={1.3} style={{ ...typeScale.etiqueta, ...importe, color: sel ? c.primaryBg : c.text }}>{n}</Text>
                  </View>
                )}
              </PressableFx>
            )
          })}
        </View>
      ))}
    </View>
  )
}
