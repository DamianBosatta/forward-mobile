import React from 'react'
import { ScrollView, Text, View } from 'react-native'
import { space, typeScale, useColors } from '@/libs/theme'
import { FiltroChip } from '@/core/ui/fw/FiltroChip'
import { useDepositos } from '@/libs/api-client'
import { useDepositoDeVenta, useDepositoElegidoStore, usePuedeElegirDeposito } from '../hooks/useDepositoDeVenta'

/**
 * "¿De qué depósito sale?" Solo lo ve quien tiene `CAP_VER_TODOS_LOS_DEPOSITOS`; el resto vende siempre desde el suyo
 * y no ve nada. Arranca en el propio. Con un solo depósito activo no hay nada que elegir.
 */
export function SelectorDepositoVenta() {
  // La lista de depósitos solo se pide si el usuario puede elegir: el resto no hace ni la consulta.
  return usePuedeElegirDeposito() ? <ListaDepositosDeVenta /> : null
}

function ListaDepositosDeVenta() {
  const c = useColors()
  const { data } = useDepositos()
  const depositoId = useDepositoDeVenta()
  const elegir = useDepositoElegidoStore((s) => s.elegir)
  const depositos = (data ?? []).filter((d) => d.id && d.activo !== false)
  if (depositos.length < 2) return null
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Depósito de la venta" style={{ gap: space[2] }}>
      <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Sale del depósito</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2] }}>
        {depositos.map((d) => (
          <FiltroChip key={d.id} label={d.nombre ?? ''} activo={d.id === depositoId} onPress={() => elegir(d.id!)} />
        ))}
      </ScrollView>
    </View>
  )
}
