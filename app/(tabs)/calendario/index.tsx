import React from 'react'
import { useRouter } from 'expo-router'
import { CalendarioScreen } from '@/features/calendario/CalendarioScreen'
import { MAX_DESCRIPCION, MAX_TITULO } from '@/features/calendario/presentacion'
import { idDeRuta, opcionDeRuta, textoDeRuta, useParametrosDeRuta } from '@/core/navigation/parametrosDeRuta'
import { useAvisosNoLeidos } from '@/features/notificaciones'
import { useRefrescarAlEnfocar } from '@/core/hooks/useRefrescarAlEnfocar'

/** Calendario (PR 5.3). "Agendar" desde una venta llega con título, descripción, número e id de la venta. */
/** Un enlace puede precargar un evento: el texto entra con el largo del formulario y la venta con un id válido. */
const PARAMETROS = {
  titulo: textoDeRuta(MAX_TITULO),
  descripcion: textoDeRuta(MAX_DESCRIPCION),
  origen: textoDeRuta(64),
  ventaId: idDeRuta,
  nonce: idDeRuta,
  nuevo: opcionDeRuta(['1']),
}

export default function CalendarioRoute() {
  useRefrescarAlEnfocar()
  const { titulo, descripcion, origen, ventaId, nonce, nuevo } =
    useParametrosDeRuta(PARAMETROS)
  const router = useRouter()
  const sinLeer = useAvisosNoLeidos()
  const precarga = titulo ? { titulo, descripcion, origen, ventaId } : null
  return (
    <CalendarioScreen
      key={`${titulo ?? ''}|${origen ?? ''}|${nonce ?? ''}|${nuevo ?? ''}`}
      nuevo={nuevo === '1'}
      avisosSinLeer={sinLeer}
      onIrAAvisos={() => router.push('/avisos' as never)}
      precarga={precarga}
      onAbrirVenta={(id) => router.push({ pathname: '/(tabs)/ventas/[id]', params: { id } })}
      onCobrar={(socioId) => router.push({ pathname: '/(tabs)/cuentas/cobro', params: { socioId } })}
    />
  )
}
