import { useSyncExternalStore } from 'react'
import { hasCapability } from '@/features/auth/lib/capabilities'
import { useAuthStore } from '@/features/auth/store/auth.store'
import {
  depositoDeSesionDe,
  depositoParaRegistrarDe,
  depositoPropioODefecto,
  depositoSesionEfectivo,
  suscribirDepositoDeSesion,
} from '../lib/depositoDeSesion'

/** ¿Elige el depósito de la sesión (y el de la venta y la compra)? Por capacidad, nunca por rol (X3). */
export function usePuedeElegirDeposito(): boolean {
  return hasCapability(useAuthStore((s) => s.user?.permissions), 'CAP_VER_TODOS_LOS_DEPOSITOS')
}

/** El depósito del usuario conectado; sin uno en el perfil, el Central (el que el servidor usa por defecto). */
export function useDepositoPropio(): string {
  return depositoPropioODefecto(useAuthStore((s) => s.user?.depositoId))
}

function useEntradas() {
  const usuarioId = useAuthStore((s) => s.user?.id ?? null)
  const propioId = useAuthStore((s) => s.user?.depositoId)
  const puedeVerTodos = usePuedeElegirDeposito()
  const eleccion = useSyncExternalStore(suscribirDepositoDeSesion, () => depositoDeSesionDe(usuarioId))
  return { puedeVerTodos, propioId, eleccion }
}

/**
 * Depósito de la sesión con el que se LEE (Stock, tablero de preparación, calendario). `null` es "Todos": solo lo
 * tiene quien ve todos los depósitos. Sin ese permiso es siempre el propio.
 */
export function useDepositoSesionEfectivo(): string | null {
  const { puedeVerTodos, propioId, eleccion } = useEntradas()
  return depositoSesionEfectivo(puedeVerTodos, propioId, eleccion)
}

/**
 * El depósito en el que una pantalla REGISTRA o consulta disponibilidad (venta, compra, ficha, stock en vivo): el de
 * la sesión; con "Todos", el Central; sin permiso de ver todos, el propio. Nunca vacío.
 */
export function useDepositoParaRegistrar(): string {
  const { puedeVerTodos, propioId, eleccion } = useEntradas()
  return depositoParaRegistrarDe(puedeVerTodos, propioId, eleccion)
}
