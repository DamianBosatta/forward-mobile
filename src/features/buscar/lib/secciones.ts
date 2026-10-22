import type { SocioListDto } from '@/libs/api-client/types'
import { puedeVerVentas } from '@/src/components/layout/menuModules'

type CanDo = Parameters<typeof puedeVerVentas>[0]

export interface SeccionesVisibles {
  clientes: boolean
  ventas: boolean
  cuentas: boolean
}

/** Mínimo de letras para salir a buscar (el de la lista de ventas). */
export const MINIMO_BUSQUEDA = 2

/**
 * Qué secciones muestra la búsqueda: solo las de los módulos que el usuario puede leer
 * ("La búsqueda solo muestra lo que tu usuario puede ver"). Mismo criterio que el menú.
 */
export function seccionesVisibles(canDo: CanDo): SeccionesVisibles {
  return {
    clientes: canDo('MOD_CLIENTES', 'read'),
    ventas: puedeVerVentas(canDo),
    cuentas: canDo('MOD_CC', 'read'),
  }
}

/**
 * Cuenta corriente: los clientes encontrados cuya cuenta y saldo puede ver este usuario. Son las
 * banderas del servidor por cliente; el teléfono no calcula nada.
 */
export function clientesConCuenta(clientes: SocioListDto[]): SocioListDto[] {
  return clientes.filter((c) => c.puedeVerCuentaCorriente && c.puedeVerSaldo)
}
