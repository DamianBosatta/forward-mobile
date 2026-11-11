import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { useDepositos } from '@/libs/api-client/depositos'
import { useAuthStore } from '@/features/auth/store/auth.store'
import {
  depositoDeSesionDe,
  depositoPropioODefecto,
  descartarSiEsDeOtro,
  elegirDepositoDeSesion,
  limpiarDepositoDeSesion,
  suscribirDepositoDeSesion,
} from '../lib/depositoDeSesion'
import { useDepositoSesionEfectivo, usePuedeElegirDeposito } from '../hooks/useDepositoDeSesion'
import { DepositoDelTablero, ElegirDepositoSheet } from './ElegirDeposito'

const NOTA = 'Stock, catálogo, ventas y compras nuevas arrancan en este depósito. Lo que ya está guardado sigue en el suyo.'

/**
 * Depósito de la sesión en Inicio (S8, como la barra de arriba de la web: DepositoSesion.tsx). Solo para quien ve
 * todos los depósitos (CAP_VER_TODOS_LOS_DEPOSITOS); el resto no ve nada y opera siempre en el suyo.
 *
 * Al entrar, quien ve todos arranca en SU depósito (o el Central), no en "Todos"; lo que elija después, "Todos"
 * incluido, se recuerda (también al cerrar la app). Sin el permiso, una elección vieja se borra.
 */
export function DepositoSesion({ style }: { style?: StyleProp<ViewStyle> } = {}) {
  const usuarioId = useAuthStore((s) => s.user?.id ?? null)
  const puedeElegir = usePuedeElegirDeposito()
  const guardado = useSyncExternalStore(suscribirDepositoDeSesion, () => depositoDeSesionDe(usuarioId))
  const queryClient = useQueryClient()

  // Otro usuario en el mismo teléfono no hereda la elección del anterior; lo pedido con ella se vuelve a pedir.
  useEffect(() => {
    if (descartarSiEsDeOtro(usuarioId)) void queryClient.invalidateQueries()
  }, [usuarioId, queryClient])
  // Primera vez de este usuario: arranca en su depósito (o el Central), no en "Todos", y queda guardado para que
  // viaje en el encabezado X-Deposito-Sesion (como la web).
  const propioId = useAuthStore((s) => s.user?.depositoId)
  useEffect(() => {
    if (puedeElegir && usuarioId && depositoDeSesionDe(usuarioId) === undefined) {
      elegirDepositoDeSesion(usuarioId, depositoPropioODefecto(propioId))
      void queryClient.invalidateQueries()
    }
  }, [puedeElegir, usuarioId, propioId, queryClient])
  useEffect(() => {
    if (!puedeElegir && guardado !== undefined) limpiarDepositoDeSesion()
  }, [puedeElegir, guardado])

  if (!puedeElegir || !usuarioId) return null
  return <DepositoSesionConPermiso usuarioId={usuarioId} style={style} />
}

function DepositoSesionConPermiso({ usuarioId, style }: { usuarioId: string; style?: StyleProp<ViewStyle> }) {
  const depositoId = useDepositoSesionEfectivo()
  const { data, isSuccess, isLoading, isError } = useDepositos()
  const [abierta, setAbierta] = useState(false)
  const queryClient = useQueryClient()

  // Todo lo que está en caché se pidió con el depósito anterior (como la web). El catálogo de la venta se vuelve a
  // pedir igual (va sin depósito de sesión) y sin señal conserva lo que tenía; la cola de ventas no es una consulta.
  const cambiar = (nuevo: string | null) => {
    if (nuevo === depositoId) return
    elegirDepositoDeSesion(usuarioId, nuevo)
    void queryClient.invalidateQueries()
  }

  const depositos = useMemo(
    () => (data ?? []).flatMap((d) => (d.id && d.activo !== false ? [{ id: d.id, nombre: d.nombre ?? 'Sin nombre' }] : [])),
    [data],
  )

  // Un depósito que se dio de baja deja de filtrar: se vuelve a "Todos" (como la web).
  useEffect(() => {
    if (isSuccess && depositoId && !depositos.some((d) => d.id === depositoId)) {
      elegirDepositoDeSesion(usuarioId, null)
      void queryClient.invalidateQueries()
    }
  }, [isSuccess, depositoId, depositos, usuarioId, queryClient])

  const nombre = depositoId === null
    ? 'Todos los depósitos'
    : (depositos.find((d) => d.id === depositoId)?.nombre ?? 'Tu depósito')

  return (
    <View style={style}>
      <DepositoDelTablero testID="deposito-sesion" etiqueta="Depósito" nombre={nombre} asignado={false} onElegir={() => setAbierta(true)} />
      <ElegirDepositoSheet
        visible={abierta}
        depositos={depositos}
        elegido={depositoId}
        cargando={isLoading}
        error={isError}
        nota={NOTA}
        onElegir={(id) => { cambiar(id); setAbierta(false) }}
        onClose={() => setAbierta(false)}
      />
    </View>
  )
}
