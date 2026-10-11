import React from 'react'
import { Pressable, Text, View } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { importe, radii, shadowMd, space, typeScale, useColors, useIsDark } from '@/libs/theme'
import { formatImporte } from '@/core/ui/fw'
import type { DatoPendiente } from '../hooks/usePendientesInicio'

export interface FilaPendiente extends DatoPendiente {
  label: string
  /** Resalta el número con el color de "por autorizar". */
  alerta?: boolean
  onPress: () => void
}

interface TarjetaPendientesProps {
  titulo: string
  icono: LucideIcon
  filas: FilaPendiente[]
  /** En fila de tablet la tarjeta reparte el ancho; en teléfono tiene ancho fijo y se desliza. */
  ancho: number | 'flex'
}

/**
 * Tarjeta "Pendientes" de un módulo (lámina Main). Sin dato del servidor, la fila dice "—". Al lado de
 * la cantidad, el importe redondeado como en la lámina; si hay varias monedas, una por línea debajo
 * (cada línea es un importe completo y la fila no se corta a mitad de frase en la tarjeta angosta).
 */
export function TarjetaPendientes({ titulo, icono: Icono, filas, ancho }: TarjetaPendientesProps) {
  const c = useColors()
  const sombra = shadowMd[useIsDark() ? 'dark' : 'light']

  return (
    <View
      accessibilityLabel={`${titulo} pendientes`}
      style={[
        ancho === 'flex' ? { flex: 1 } : { width: ancho },
        { backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[4], gap: space[2] },
        sombra,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={[typeScale.seccion, { color: c.text }]}>{titulo}</Text>
          <Text style={[typeScale.secundario, { color: c.textSecondary }]}>Pendientes</Text>
        </View>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radii.pastilla,
            backgroundColor: c.brandSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icono size={20} color={c.brandInk} strokeWidth={2} />
        </View>
      </View>
      {filas.map((f, i) => {
        const texto = f.cantidad == null ? '—' : String(f.cantidad)
        const montos = (f.importes ?? []).map((m) => formatImporte(m.total, { moneda: m.moneda, centavos: false }))
        const monto = (m: string) => (
          <Text key={m} style={[typeScale.secundario, importe, { color: c.textSecondary }]}>{m}</Text>
        )
        return (
          <Pressable
            key={f.label}
            accessibilityRole="button"
            accessibilityLabel={`${f.label}: ${f.cantidad == null ? 'sin dato' : [texto, ...montos].join(', ')}`}
            onPress={f.onPress}
            style={({ pressed }) => ({
              minHeight: 44,
              paddingVertical: space[1],
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              columnGap: space[2],
              borderBottomWidth: i < filas.length - 1 ? 1 : 0,
              borderBottomColor: c.border,
              backgroundColor: pressed ? c.surface2 : 'transparent',
            })}
          >
            <Text style={[typeScale.secundario, { color: c.text }]}>{f.label}</Text>
            {/* marginLeft auto: a la derecha, también si un importe largo la baja de renglón. */}
            <View style={{ marginLeft: 'auto', alignItems: 'flex-end' }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[1] }}>
                <Text
                  style={[
                    typeScale.cuerpoDestacado,
                    importe,
                    { color: f.alerta && f.cantidad ? c.chip.porAutorizar.text : c.text },
                  ]}
                >
                  {texto}
                </Text>
                {montos.slice(0, 1).map(monto)}
              </View>
              {montos.slice(1).map(monto)}
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}
