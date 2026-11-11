import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { MarcaRadio } from '@/features/venta-nueva/components/MarcaRadio'

/**
 * Grupo de opciones excluyentes (una por renglón, 48 de alto): condición de IVA, condición de pago.
 * `enTarjeta`: las filas con radio y check dentro de una tarjeta, como el paso Cliente de la venta
 * (formulario de cliente, propuesta "Clientes como venta"). Sin él, los renglones con borde de siempre (proveedores).
 */
export function OpcionesRadio<T extends string>({ titulo, opciones, valor, onChange, enTarjeta = false }: {
  titulo: string; opciones: { value: T; label: string }[]; valor: T; onChange: (v: T) => void; enTarjeta?: boolean
}) {
  const c = useColors()
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={titulo} style={{ gap: space[1] }}>
      <Text style={{ ...typeScale.secundario, fontFamily: typeScale.cuerpoDestacado.fontFamily, fontWeight: '600', color: c.text }}>{titulo}</Text>
      {enTarjeta ? (
        <View style={{ borderRadius: radii.tarjeta, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, overflow: 'hidden' }}>
          {opciones.map((op, i) => {
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
                  borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.border, backgroundColor: elegido ? c.brandSoft : c.surface,
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
                minHeight: 48, justifyContent: 'center', paddingHorizontal: space[3], borderRadius: radii.campo,
                borderWidth: elegido ? 2 : 1, borderColor: elegido ? c.brand : c.border,
                backgroundColor: elegido ? c.brandSoft : c.surface,
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
