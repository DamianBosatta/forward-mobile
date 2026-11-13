import React from 'react'
import { useRouter } from 'expo-router'
import { usePermissions } from '@/core/auth/RequirePermission'
import { useDeudasResumen } from '@/features/cuentas/api/queries'
import { TarjetaDeudores } from './TarjetaDeudores'

/**
 * Destino de "Ver deudores": la solapa Clientes (MOD_CLIENTES) o, sin ella, Cobros (MOD_CC).
 * TODO(deudores): cuando la cartera acepte el filtro Deudores por ruta, pasarlo acá; hoy solo existe
 * el filtro persistido "con deuda vencida" dentro de la pantalla, sin parámetro de ruta.
 */
export function destinoDeDeudores(canDo: ReturnType<typeof usePermissions>['canDo']): string | null {
  if (canDo('MOD_CLIENTES', 'read')) return '/(tabs)/socios'
  if (canDo('MOD_CC', 'read')) return '/(tabs)/cuentas'
  return null
}

export interface DeudoresDelVendedor {
  cargando: boolean
  error: boolean
  /** `cobrosPendientes` del resumen del vendedor: sus clientes y lo que le deben (sin la parte vencida). */
  datos: { clientes: number; total: number } | null
  reintentar: () => void
}

/**
 * Container de la tarjeta Deudores. Los totales salen de `GET /deudas/resumen` (MOD_PAGOS:Read). Sin ese
 * permiso y sin `respaldo` no se pide ni se muestra nada (nunca un 0 inventado).
 */
export function DeudoresDeInicio({ respaldo }: { respaldo?: DeudoresDelVendedor }) {
  const router = useRouter()
  const { canDo } = usePermissions()
  const puede = canDo('MOD_PAGOS', 'read')
  const q = useDeudasResumen(puede)
  const destino = destinoDeDeudores(canDo)
  const alIr = destino ? () => router.push(destino as never) : undefined
  // Sin MOD_PAGOS (el vendedor típico) y con el resumen del vendedor: la misma tarjeta con sus cobros pendientes.
  if (!puede) {
    if (!respaldo) return null
    const d = respaldo.datos
    return (
      <TarjetaDeudores
        estado={respaldo.cargando ? 'cargando' : respaldo.error || !d ? 'error' : 'datos'}
        datos={d ? { ...d, vencido: null } : null}
        onPress={alIr}
        onReintentar={respaldo.reintentar}
      />
    )
  }
  const estado = q.isLoading ? 'cargando' : q.isError || !q.data ? 'error' : 'datos'
  return (
    <TarjetaDeudores
      estado={estado}
      datos={q.data ? { clientes: q.data.clientesConDeuda, total: q.data.totalDeudaClientes, vencido: q.data.totalDeudaVencidaClientes ?? null } : null}
      onPress={alIr}
      onReintentar={() => q.refetch()}
    />
  )
}
