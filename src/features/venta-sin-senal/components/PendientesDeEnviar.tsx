import React from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { FONT, space, typeScale, useColors } from '@/libs/theme'
import { Notice } from '@/core/ui/fw'
import { useNetworkStatus } from '@/core/utils/useNetworkStatus'
import { useColaDelUsuario } from '../hooks/useVentasSinSenal'
import { useHoraDelCatalogo } from '../hooks/useHoraDelCatalogo'
import { useAvisosDeCola } from '../hooks/useAvisosDeCola'
import { textoDeLineaCambiada } from '../lib/cambiosEnCola'
import type { VentaEnCola } from '../lib/cola'
import { VentasSinSenalLista } from './VentasSinSenalLista'

/**
 * V9: bloque "Pendientes de enviar" al tope de "Mis ventas". Solo aparece si la cola del usuario logueado tiene ventas.
 * Solo lee: el envío lo hace EnvioVentasSinSenal (montado una vez en la app).
 */
export function PendientesDeEnviar() {
  const items = useColaDelUsuario()
  return items.length === 0 ? null : <Bloque items={items} />
}

function Bloque({ items }: { items: VentaEnCola[] }) {
  const c = useColors()
  const router = useRouter()
  const { isConnected } = useNetworkStatus()
  const horaCatalogo = useHoraDelCatalogo()
  const cambiadas = useAvisosDeCola(items)

  // Enviada o en Borradores: la venta ya existe en el servidor. Las rechazadas no tienen a dónde ir.
  const abrir = (v: VentaEnCola) => {
    if (v.estado.tipo === 'enviada' || v.estado.tipo === 'enBorradores') router.push(`/(tabs)/ventas/${v.estado.ventaId}` as never)
  }
  return (
    <View style={{ gap: space[2], paddingHorizontal: 20, paddingBottom: space[3] }}>
      <Text accessibilityRole="header" style={[typeScale.titulo, { fontFamily: FONT.semibold, color: c.text }]}>Pendientes de enviar</Text>
      {cambiadas.map((l) => <Notice key={`${l.clave}:${l.productoId}`} tone="advertencia" title="Cambió el stock:">{textoDeLineaCambiada(l)}</Notice>)}
      <VentasSinSenalLista items={items} sinSenal={isConnected === false} horaCatalogo={horaCatalogo} onAbrir={abrir} />
    </View>
  )
}
