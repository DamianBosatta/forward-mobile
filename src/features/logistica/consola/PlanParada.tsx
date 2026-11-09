import React from 'react'
import { Text, View } from 'react-native'
import { space, typeScale, useColors } from '@/libs/theme'
import { StatusChip } from '@/core/ui/fw'
import { formatToLocalTime } from '@/core/utils/fecha'

export interface PlanDeParada {
  llegadaEstimadaEn?: string | null
  ventanaDesde?: string | null
  ventanaHasta?: string | null
  /** 0 Ninguna, 1 FueraDeHorario, 2 SinHorarioCargado, 3 SinCoordenadas. */
  advertenciaVentana: number
}

const ADVERTENCIA: Record<number, string> = {
  1: 'Fuera de horario',
  2: 'Sin horario cargado',
  3: 'Sin coordenadas',
}

/** Llegada estimada y ventana del cliente, solo lectura. Sin plan ni advertencia no dibuja nada. */
export function PlanParada({ parada }: { parada: PlanDeParada }) {
  const c = useColors()
  const advertencia = ADVERTENCIA[parada.advertenciaVentana]
  const llegada = parada.llegadaEstimadaEn
    ? `Llegada estimada ${formatToLocalTime(parada.llegadaEstimadaEn, 'HH:mm')}`
    : null
  const ventana = parada.ventanaDesde && parada.ventanaHasta ? `ventana ${parada.ventanaDesde} a ${parada.ventanaHasta}` : null
  const texto = [llegada, ventana].filter(Boolean).join(' · ')
  if (!texto && !advertencia) return null
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space[2] }}>
      {texto ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{texto}</Text> : null}
      {advertencia ? <StatusChip estado="porAutorizar" label={advertencia} /> : null}
    </View>
  )
}
