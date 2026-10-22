import React from 'react'
import { Pressable, ScrollView, Text } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { useLocalidades } from '@/libs/api-client/socios'

export interface FiltrosDeCartera {
  /** Solo los de esta localidad. Sin definir = todas. */
  localidad?: string
  /** Solo los clientes con deuda vencida. */
  conDeudaVencida: boolean
}

export const SIN_FILTROS: FiltrosDeCartera = { conDeudaVencida: false }

function Pastilla({ label, activa, onPress }: { label: string; activa: boolean; onPress: () => void }) {
  const c = useColors()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: activa }}
      onPress={onPress}
      style={{
        minHeight: 36,
        justifyContent: 'center',
        paddingHorizontal: space[3],
        borderRadius: radii.pastilla,
        backgroundColor: activa ? c.brandSoft : c.surface,
        borderWidth: 1,
        borderColor: activa ? c.brand : c.border,
      }}
    >
      <Text style={{ ...typeScale.secundario, color: activa ? c.brandInk : c.text }}>{label}</Text>
    </Pressable>
  )
}

/**
 * Filtros de la cartera (lámina Clientes, botón de filtro): deuda vencida y localidad. Los decide el
 * servidor antes de paginar; acá solo se eligen. Sin localidades cargadas (o con un servidor que
 * todavía no las informa) queda solo "Con deuda vencida".
 */
export function FiltrosCartera({ valor, onCambio, totalCartera }: { valor: FiltrosDeCartera; onCambio: (f: FiltrosDeCartera) => void; totalCartera?: number }) {
  const c = useColors()
  const { data } = useLocalidades()
  const localidades = Array.isArray(data) ? data : []

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel="Filtros de la cartera"
      style={{ flexGrow: 0, backgroundColor: c.topBar }}
      contentContainerStyle={{ gap: space[2], paddingHorizontal: space[4], paddingBottom: space[3] }}
    >
      {/* La lista es siempre la cartera del vendedor: la pastilla dice cuántos son, no filtra. */}
      {totalCartera !== undefined ? <Pastilla label={`Mi cartera · ${totalCartera}`} activa onPress={() => onCambio(SIN_FILTROS)} /> : null}
      <Pastilla
        label="Con deuda vencida"
        activa={valor.conDeudaVencida}
        onPress={() => onCambio({ ...valor, conDeudaVencida: !valor.conDeudaVencida })}
      />
      {localidades.map(localidad => (
        <Pastilla
          key={localidad}
          label={localidad}
          activa={valor.localidad === localidad}
          onPress={() => onCambio({ ...valor, localidad: valor.localidad === localidad ? undefined : localidad })}
        />
      ))}
    </ScrollView>
  )
}
