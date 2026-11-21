import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { MarcaRadio } from '@/core/ui/fw/MarcaRadio'

/**
 * Grupo de opciones excluyentes (una por renglón, 48 de alto): condición de IVA, condición de pago.
 * `enTarjeta`: las filas con radio y check dentro de una tarjeta, como el paso Cliente de la venta
 * (formulario de cliente, propuesta "Clientes como venta"). `enPastilla`: opciones como filas en pastilla (mockups proveedores-nuevo*):
 * 56 de alto, `surfaceAlt`, la elegida en teal con texto `ink` y la marca invertida. Sin ninguno, los renglones de siempre (proveedores).
 */
export function OpcionesRadio<T extends string>({ titulo, opciones, valor, onChange, enTarjeta = false, enPastilla = false }: {
  titulo: string; opciones: { value: T; label: string }[]; valor: T; onChange: (v: T) => void; enTarjeta?: boolean; enPastilla?: boolean
}) {
  const c = useColors()
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={titulo} style={{ gap: space[1] }}>
      <Text style={{ ...typeScale.secundario, fontFamily: typeScale.cuerpoDestacado.fontFamily, fontWeight: '600', color: c.text }}>{titulo}</Text>
      {enPastilla ? (
        <View style={{ gap: space[2] }}>
          {opciones.map(op => {
            const elegido = op.value === valor
            return (
              <Pressable
                key={op.value}
                accessibilityRole="radio"
                accessibilityLabel={op.label}
                accessibilityState={{ checked: elegido, selected: elegido }}
                onPress={() => onChange(op.value)}
                android_ripple={{ color: c.ink }}
                style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4], borderRadius: radii.fila, backgroundColor: elegido ? c.teal : c.surfaceAlt }}
              >
                <View testID={elegido ? 'marca-radio-elegida' : undefined}>
                  <MarcaRadio elegido={elegido} sobreTeal={elegido} />
                </View>
                <Text style={{ ...typeScale.cuerpoDestacado, color: elegido ? c.ink : c.text, flex: 1 }}>{op.label}</Text>
              </Pressable>
            )
          })}
        </View>
      ) : enTarjeta ? (
        <View style={{ borderRadius: radii.fila, backgroundColor: c.bg, overflow: 'hidden' }}>
          {opciones.map(op => {
            const elegido = op.value === valor
            return (
              <Pressable
                key={op.value}
                accessibilityRole="radio"
                accessibilityLabel={op.label}
                accessibilityState={{ checked: elegido, selected: elegido }}
                onPress={() => onChange(op.value)}
                android_ripple={{ color: c.surface2 }}
                style={{
                  minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[2], paddingHorizontal: space[3],
                  backgroundColor: 'transparent',
                }}
              >
                <View testID={elegido ? 'marca-radio-elegida' : undefined}>
                  <MarcaRadio elegido={elegido} />
                </View>
                <Text style={{ ...(elegido ? typeScale.cuerpoDestacado : typeScale.cuerpo), color: c.text, flex: 1 }}>{op.label}</Text>
              </Pressable>
            )
          })}
        </View>
      ) : (
        opciones.map(op => {
          const elegido = op.value === valor
          return (
            <Pressable
              key={op.value}
              accessibilityRole="radio"
              accessibilityLabel={op.label}
              accessibilityState={{ checked: elegido, selected: elegido }}
              onPress={() => onChange(op.value)}
              style={{
                minHeight: 48, justifyContent: 'center', paddingHorizontal: space[3], borderRadius: radii.fila,
                backgroundColor: elegido ? c.surfaceAlt : c.surface,
              }}
            >
              <Text style={{ ...(elegido ? typeScale.cuerpoDestacado : typeScale.cuerpo), color: c.text }}>{op.label}</Text>
            </Pressable>
          )
        })
      )}
    </View>
  )
}
