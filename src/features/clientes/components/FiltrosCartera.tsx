import React from 'react'
import { ScrollView } from 'react-native'
import { space, useColors } from '@/libs/theme'
import { FiltroChip } from '@/core/ui/fw/FiltroChip'
import { useLocalidades } from '@/libs/api-client/socios'

export interface FiltrosDeCartera {
  /** Solo los de esta localidad. Sin definir = todas. */
  localidad?: string
  /** Solo los clientes con deuda vencida. */
  conDeudaVencida: boolean
}

export const SIN_FILTROS: FiltrosDeCartera = { conDeudaVencida: false }

/**
 * Filtros de la cartera (lámina Clientes, botón de filtro): deuda vencida y localidad. Los decide el
 * servidor antes de paginar; acá solo se eligen. Sin localidades cargadas (o con un servidor que
 * todavía no las informa) queda solo "Con deuda vencida".
 */
export function FiltrosCartera({
  valor,
  onCambio,
  totalCartera,
  sobre = 'barra',
}: {
  valor: FiltrosDeCartera
  onCambio: (f: FiltrosDeCartera) => void
  totalCartera?: number
  /** 'barra' (por defecto): sobre el color de la barra superior; 'pantalla': sobre el fondo. */
  sobre?: 'barra' | 'pantalla'
}) {
  const c = useColors()
  const { data } = useLocalidades()
  const localidades = Array.isArray(data) ? data : []

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel="Filtros de la cartera"
      style={{ flexGrow: 0, backgroundColor: sobre === 'barra' ? c.topBar : c.bg }}
      contentContainerStyle={{ gap: space[2], paddingHorizontal: space[4], paddingBottom: space[3], paddingTop: sobre === 'barra' ? 0 : space[1] }}
    >
      {/* La lista es siempre la cartera del vendedor: la pastilla dice cuántos son, no filtra. */}
      {totalCartera !== undefined ? <FiltroChip label={`Mi cartera · ${totalCartera}`} activo onPress={() => onCambio(SIN_FILTROS)} /> : null}
      <FiltroChip
        label="Con deuda vencida"
        activo={valor.conDeudaVencida}
        onPress={() => onCambio({ ...valor, conDeudaVencida: !valor.conDeudaVencida })}
      />
      {localidades.map(localidad => (
        <FiltroChip
          key={localidad}
          label={localidad}
          activo={valor.localidad === localidad}
          onPress={() => onCambio({ ...valor, localidad: valor.localidad === localidad ? undefined : localidad })}
        />
      ))}
    </ScrollView>
  )
}
