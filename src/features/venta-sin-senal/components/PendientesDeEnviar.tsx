import React from 'react'
import { Alert, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { FONT, space, typeScale, useColors } from '@/libs/theme'
import { Button, Notice } from '@/core/ui/fw'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useNetworkStatus } from '@/core/utils/useNetworkStatus'
import { agrupar, useColaDelUsuario } from '../hooks/useVentasSinSenal'
import { useHoraDelCatalogo } from '../hooks/useHoraDelCatalogo'
import { useAvisosDeCola } from '../hooks/useAvisosDeCola'
import { textoDeLineaCambiada } from '../lib/cambiosEnCola'
import { detenidaPorTope, quitarDeCola, reintentarVenta, type VentaEnCola } from '../lib/cola'
import { enviarPendientes } from '../lib/enviar'
import { VentasSinSenalLista } from './VentasSinSenalLista'

/**
 * V9: bloque "Pendientes de enviar" al tope de "Mis ventas". Solo aparece si la cola del usuario logueado tiene ventas.
 * Solo lee: el envío lo hace EnvioVentasSinSenal (montado una vez en la app).
 */
export function PendientesDeEnviar() {
  const items = useColaDelUsuario()
  return items.length === 0 ? null : <Bloque items={items} />
}

/** Retoma las detenidas por el tope de intentos (desde su fase, con su clave) y manda todo lo que espera. */
function enviarAhora(usuarioId: string, items: VentaEnCola[]) {
  items.filter(detenidaPorTope).forEach((v) => reintentarVenta(usuarioId, v.clave))
  void enviarPendientes(usuarioId)
}

/** Descartar pide confirmación: la venta se borra solo de este teléfono; si el servidor no la tiene, no queda registrada. */
function confirmarDescarte(usuarioId: string, v: VentaEnCola) {
  Alert.alert(
    '¿Descartar esta venta?',
    'Se borra solo de este teléfono. Si el servidor no la tiene, no queda registrada: avisale a la oficina.',
    [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: () => quitarDeCola(usuarioId, v.clave) },
    ],
  )
}

function Bloque({ items }: { items: VentaEnCola[] }) {
  const c = useColors()
  const router = useRouter()
  const { isConnected } = useNetworkStatus({ desconocidoCuentaComoSinRed: false })
  const horaCatalogo = useHoraDelCatalogo()
  const cambiadas = useAvisosDeCola(items)
  const usuarioId = useAuthStore((st) => st.user?.id)
  const sinSenal = isConnected === false
  const { esperando, paraRevisar } = agrupar(items)
  const porEnviar = esperando.length + paraRevisar.length

  // Enviada o en Borradores: la venta ya existe en el servidor. Las rechazadas no tienen a dónde ir.
  const abrir = (v: VentaEnCola) => {
    if (v.estado.tipo === 'enviada' || v.estado.tipo === 'enBorradores') router.push(`/(tabs)/ventas/${v.estado.ventaId}` as never)
  }
  return (
    <View style={{ gap: space[2], paddingHorizontal: 20, paddingBottom: space[3] }}>
      <Text accessibilityRole="header" style={[typeScale.titulo, { fontFamily: FONT.semibold, color: c.text }]}>{`Pendientes de enviar (${porEnviar})`}</Text>
      {cambiadas.map((l) => <Notice key={`${l.clave}:${l.productoId}`} tone="advertencia" title="Cambió el stock:">{textoDeLineaCambiada(l)}</Notice>)}
      <VentasSinSenalLista items={items} sinSenal={sinSenal} horaCatalogo={horaCatalogo} onAbrir={abrir} onDescartar={usuarioId ? (v) => confirmarDescarte(usuarioId, v) : undefined} />
      {porEnviar > 0 && usuarioId ? (
        <Button variant="secundario" label={sinSenal ? 'Enviar ahora (sin señal)' : 'Enviar ahora'} disabled={sinSenal} onPress={() => enviarAhora(usuarioId, items)} />
      ) : null}
    </View>
  )
}
