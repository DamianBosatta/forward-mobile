import React from 'react'
import { Pressable, Text, View } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { importe, radii, shadowMd, space, typeScale, useColors, useIsDark } from '@/libs/theme'
import type { Contador } from '../hooks/usePendientesInicio'

export interface FilaPendiente {
  label: string
  valor: Contador
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

/** Tarjeta "Pendientes" de un módulo (lámina Main). Sin dato del servidor, la fila dice "—". */
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
        const texto = f.valor == null ? '—' : String(f.valor)
        return (
          <Pressable
            key={f.label}
            accessibilityRole="button"
            accessibilityLabel={`${f.label}: ${f.valor == null ? 'sin dato' : texto}`}
            onPress={f.onPress}
            style={({ pressed }) => ({
              minHeight: 44,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottomWidth: i < filas.length - 1 ? 1 : 0,
              borderBottomColor: c.border,
              backgroundColor: pressed ? c.surface2 : 'transparent',
            })}
          >
            <Text style={[typeScale.secundario, { color: c.text }]}>{f.label}</Text>
            <Text
              style={[
                typeScale.cuerpoDestacado,
                importe,
                { color: f.alerta && f.valor ? c.chip.porAutorizar.text : c.text },
              ]}
            >
              {texto}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
