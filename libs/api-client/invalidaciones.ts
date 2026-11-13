import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { inicioKeys } from '@/core/query/inicioKeys'
import { cuentasKeys } from '@/features/cuentas/api/queries'
import { gastosKeys } from '@/features/gastos/api/gastos'
import { pagosKeys } from '@/features/pagos/api/pagos'
import { adminKeys } from './admin'
import { calendarioKeys } from './calendario'
import { catalogoKeys } from './catalogo'
import { comprasKeys } from './compras'
import { depositosKeys } from './depositos'
import { finanzasKeys } from './finanzas'
import { logisticaKeys, pickingKeys } from './logistica'
import { notificacionesKeys } from './notificaciones'
import { productosKeys } from './productos'
import { reportesKeys } from './reportes'
import { sociosKeys } from './socios'
import { stockConsultaKeys, stockKeys } from './stock'
import { tesoreriaKeys } from './tesoreria'
import { comisionesKeys, ventasKeys } from './ventas'

/**
 * LA regla de qué se refresca cuando cambia algo (datos-al-dia, S3). Una función por cambio de
 * dominio, nombrada por lo que cambió: cada mutación llama a la que le toca en vez de acordarse a
 * mano de cada pantalla que muestra ese dato. Si una pantalla nueva muestra algo, su clave tiene que
 * colgar de una raíz que se invalida acá; si cambia algo que ya existe, el efecto cruzado se agrega
 * acá y lo heredan todas las mutaciones.
 *
 * Es el único archivo fuera de los tests que puede llamar a `invalidateQueries`, `refetchQueries` o
 * `resetQueries` (lo vigila `libs/api-client/__tests__/invalidaciones.guarda.test.ts`).
 *
 * Todas devuelven la promesa para que el `onSuccess` la retorne: la mutación termina cuando las
 * pantallas abiertas ya tienen el dato fresco. `invalidarPorEntidad` es la puerta de entrada del
 * aviso en vivo del backend (`{ tipo, id }`).
 */

type Qc = QueryClient

/** Invalida cada clave y espera a que se refresquen las consultas activas. */
async function refrescar(queryClient: Qc, ...claves: readonly QueryKey[]): Promise<void> {
  await Promise.all(claves.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
}

/** Junta varios efectos en una sola promesa. */
async function juntar(...efectos: Promise<void>[]): Promise<void> {
  await Promise.all(efectos)
}

// ── Inicio, todo y lo que se ve al volver ────────────────────────────────────

/** El resumen de Inicio (Ventas y Compras): lo mueve cualquier mutación. */
export function invalidarInicio(queryClient: Qc): Promise<void> {
  // Sin cancelar un pedido en vuelo: la regla de la propia mutación ya pudo haber pedido el resumen y se comparte ese pedido.
  return queryClient.invalidateQueries({ queryKey: inicioKeys.all }, { cancelRefetch: false })
}

/**
 * Todo lo que está en caché queda vieja y las consultas activas se vuelven a pedir. Para cuando no
 * se sabe qué cambió: otro usuario o depósito en el teléfono, o el aviso en vivo que volvió a
 * conectar (pudo perderse algún aviso).
 */
export async function invalidarTodo(queryClient: Qc): Promise<void> {
  await queryClient.invalidateQueries()
}

/**
 * Al volver a una pantalla ya montada: vuelve a pedir lo activo que ya venció (`staleTime`), no lo que
 * está fresco. Sin `claves` son todas las consultas activas; con `claves`, solo las de esas raíces.
 */
export async function refrescarVencidas(queryClient: Qc, claves?: readonly QueryKey[]): Promise<void> {
  const raices = claves && claves.length > 0 ? claves : [undefined]
  await Promise.all(
    raices.map((queryKey) => queryClient.refetchQueries({ queryKey, type: 'active', stale: true })),
  )
}

/** Vuelve a pedir una consulta exacta aunque su pantalla esté desactivada pero montada (revalidar el stock antes de confirmar). */
export function refrescarExacta(queryClient: Qc, queryKey: QueryKey): Promise<void> {
  return queryClient.refetchQueries({ queryKey, exact: true })
}

/** Marca vieja una consulta sin volver a pedirla (el borrador que se está editando acá). */
export function marcarVieja(queryClient: Qc, queryKey: QueryKey): Promise<void> {
  return queryClient.invalidateQueries({ queryKey, refetchType: 'none' })
}

// ── Stock y productos ────────────────────────────────────────────────────────

/** Stock físico y virtual: listados de stock, consultas de inventario, catálogo de venta y reportes. */
export function invalidarStock(queryClient: Qc): Promise<void> {
  return refrescar(
    queryClient,
    stockKeys.all,
    stockConsultaKeys.all,
    productosKeys.all,
    catalogoKeys.all,
    reportesKeys.all,
  )
}

/** Precio, costo, estado o variantes de un producto: ficha, listados, stock y catálogo. */
export function invalidarProductosYCatalogo(queryClient: Qc): Promise<void> {
  return refrescar(queryClient, productosKeys.all, catalogoKeys.all, stockKeys.all, stockConsultaKeys.all)
}

/** Depósitos (alta, edición, baja). */
export function invalidarDepositos(queryClient: Qc): Promise<void> {
  return refrescar(queryClient, depositosKeys.all)
}

/** Un depósito cambió y con él lo que mostraba el stock. */
export function invalidarDepositosYStock(queryClient: Qc): Promise<void> {
  return juntar(invalidarDepositos(queryClient), invalidarStock(queryClient))
}

// ── Cuentas, caja y tesorería ────────────────────────────────────────────────

/** Cuentas corrientes, sus deudas y los socios (saldo y deuda de cada uno). */
export function invalidarCuentasYDeudas(queryClient: Qc): Promise<void> {
  return refrescar(queryClient, cuentasKeys.all, sociosKeys.all)
}

/** La caja del depósito: cajas activas y movimientos. */
export function invalidarCaja(queryClient: Qc): Promise<void> {
  return refrescar(queryClient, finanzasKeys.caja, finanzasKeys.cajas)
}

/** Tesorería y la lista de pagos y cobros (sale de la misma fuente). */
export function invalidarTesoreria(queryClient: Qc): Promise<void> {
  return refrescar(queryClient, tesoreriaKeys.all, pagosKeys.all)
}

/** Se movió dinero (cobro, pago, devolución): cuentas, deudas, caja, tesorería, ventas y compras. */
export function invalidarPorMovimientoDeDinero(queryClient: Qc): Promise<void> {
  return juntar(
    invalidarCuentasYDeudas(queryClient),
    invalidarCaja(queryClient),
    invalidarTesoreria(queryClient),
    refrescar(queryClient, ventasKeys.all, comprasKeys.all, comisionesKeys.simulacion, reportesKeys.all),
  )
}

/** Un gasto: gastos, cuentas, tesorería y caja. */
export function invalidarPorCambioDeGasto(queryClient: Qc): Promise<void> {
  return juntar(
    refrescar(queryClient, gastosKeys.all),
    invalidarCuentasYDeudas(queryClient),
    invalidarTesoreria(queryClient),
    invalidarCaja(queryClient),
  )
}

/** Un movimiento interno entre cuentas: cuentas y tesorería. */
export function invalidarPorMovimientoInterno(queryClient: Qc): Promise<void> {
  return juntar(invalidarCuentasYDeudas(queryClient), invalidarTesoreria(queryClient))
}

// ── Ventas y logística ───────────────────────────────────────────────────────

/**
 * Cambió una venta (alta, edición, confirmación, autorización, cancelación, preparación, empaque,
 * entrega, o la cola sin señal que se acaba de enviar): ventas, preparación, logística, cuentas,
 * stock, comisiones, avisos e Inicio.
 */
export function invalidarPorCambioDeVenta(queryClient: Qc): Promise<void> {
  return juntar(
    refrescar(
      queryClient,
      ventasKeys.all,
      pickingKeys.all,
      logisticaKeys.all,
      comisionesKeys.simulacion,
      notificacionesKeys.all,
      inicioKeys.all,
    ),
    invalidarStock(queryClient),
    invalidarCuentasYDeudas(queryClient),
  )
}

/** Borradores automáticos de la venta del usuario. */
export function invalidarBorradoresDeVenta(queryClient: Qc): Promise<void> {
  return refrescar(queryClient, ventasKeys.borradoresMios())
}

/** El tablero de preparación (picking). */
export function invalidarPreparacion(queryClient: Qc): Promise<void> {
  return refrescar(queryClient, pickingKeys.all)
}

/**
 * Una hoja de ruta cambió (armar, iniciar, reportar parada, entregar, cancelar). Con `hojaId` se
 * refrescan esa hoja y el listado; sin él, toda la logística. En los dos casos también ventas,
 * preparación, cuentas e Inicio: una entrega cambia el estado de las ventas y lo que se debe.
 */
export function invalidarPorCambioDeHojaDeRuta(queryClient: Qc, hojaId?: string | null): Promise<void> {
  return juntar(
    refrescar(
      queryClient,
      ...(hojaId
        ? [logisticaKeys.hojaRuta(hojaId), logisticaKeys.hojasRuta(), logisticaKeys.ventasEmpacadas()]
        : [logisticaKeys.all]),
      pickingKeys.all,
      ventasKeys.all,
      inicioKeys.all,
    ),
    invalidarCuentasYDeudas(queryClient),
  )
}

/** El chofer cobró (o no) una parada de cobro: la hoja de ruta y el dinero que entró. */
export function invalidarPorCobroDeParada(queryClient: Qc, hojaId: string): Promise<void> {
  return juntar(invalidarPorCambioDeHojaDeRuta(queryClient, hojaId), invalidarPorMovimientoDeDinero(queryClient))
}

/** Flota, choferes y demás datos de logística que no tocan ventas. */
export function invalidarLogistica(queryClient: Qc): Promise<void> {
  return refrescar(queryClient, logisticaKeys.all)
}

// ── Compras ──────────────────────────────────────────────────────────────────

/** Cambió una compra (alta, edición, recepción, pago, anulación): compras, stock, cuentas e Inicio. */
export function invalidarPorCambioDeCompra(queryClient: Qc): Promise<void> {
  return juntar(
    refrescar(queryClient, comprasKeys.all, inicioKeys.all),
    invalidarStock(queryClient),
    invalidarCuentasYDeudas(queryClient),
  )
}

/** Borradores automáticos de la compra del usuario. */
export function invalidarBorradoresDeCompra(queryClient: Qc): Promise<void> {
  return refrescar(queryClient, comprasKeys.borradoresMios())
}

// ── Socios, usuarios, calendario y avisos ────────────────────────────────────

/** Cambió un socio (datos, estado, vendedor): listas, ficha y cuentas. */
export function invalidarPorCambioDeSocio(queryClient: Qc): Promise<void> {
  return refrescar(queryClient, sociosKeys.all, cuentasKeys.all)
}

/** Un usuario: su ficha y el listado. Sin id, solo el listado. */
export function invalidarUsuarios(queryClient: Qc, userId?: string): Promise<void> {
  return refrescar(queryClient, ...(userId ? [adminKeys.user(userId)] : []), adminKeys.allUsers)
}

/** Eventos del calendario. Con `soloSemanas` no se vuelve a pedir la ficha de un evento (el que se acaba de borrar ya no existe). */
export function invalidarCalendario(queryClient: Qc, soloSemanas = false): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: calendarioKeys.all,
    predicate: (q) => !soloSemanas || q.queryKey[1] !== 'evento',
  })
}

/** La bandeja, el contador y las preferencias de avisos. */
export function invalidarNotificaciones(queryClient: Qc): Promise<void> {
  return refrescar(queryClient, notificacionesKeys.all)
}

/** Solo las preferencias de avisos. */
export function invalidarPreferenciasDeAvisos(queryClient: Qc): Promise<void> {
  return refrescar(queryClient, notificacionesKeys.preferencias())
}

// ── Aviso en vivo del backend ────────────────────────────────────────────────

/** Los `tipo` que manda el backend en `EntidadCambio` (contrato "Aviso de cambios en vivo"). */
export type TipoDeEntidad =
  | 'venta'
  | 'socio'
  | 'producto'
  | 'stock'
  | 'hojaRuta'
  | 'compra'
  | 'pago'
  | 'caja'
  | 'tesoreria'
  | 'cheque'

type Regla = (queryClient: Qc, id?: string | null) => Promise<void>

const REGLA_POR_ENTIDAD: Record<TipoDeEntidad, Regla> = {
  venta: invalidarPorCambioDeVenta,
  socio: invalidarPorCambioDeSocio,
  producto: invalidarProductosYCatalogo,
  stock: invalidarStock,
  hojaRuta: invalidarPorCambioDeHojaDeRuta,
  compra: invalidarPorCambioDeCompra,
  // Cobros y pagos a proveedores: mueven cuentas, deudas, caja, tesorería, ventas y compras.
  pago: invalidarPorMovimientoDeDinero,
  caja: invalidarCaja,
  tesoreria: invalidarTesoreria,
  // Mobile no tiene cartera de cheques: un cheque mueve lo que ve la tesorería.
  cheque: invalidarTesoreria,
}

/**
 * Puerta única del aviso en vivo: `{ tipo, id }` del evento del backend llega acá y se aplica la
 * misma regla que si el cambio lo hubiera hecho esta pantalla. `id: null` es "todo ese tipo". Un tipo
 * que esta app no conoce (backend más nuevo) no hace nada: la vuelta a la pantalla lo refresca.
 */
export function invalidarPorEntidad(queryClient: Qc, tipo: string, id?: string | null): Promise<void> {
  const regla = (REGLA_POR_ENTIDAD as Record<string, Regla | undefined>)[tipo]
  return regla ? regla(queryClient, id ?? undefined) : Promise.resolve()
}

/**
 * Un lote de avisos (el backend los junta cada ~300 ms). Descarta lo que no tiene forma de aviso y
 * los repetidos, y aplica cada uno por `invalidarPorEntidad`.
 */
export async function invalidarPorAvisos(queryClient: Qc, avisos: unknown): Promise<void> {
  if (!Array.isArray(avisos)) return
  const vistos = new Set<string>()
  const efectos: Promise<void>[] = []
  for (const aviso of avisos) {
    if (!aviso || typeof aviso !== 'object') continue
    const { tipo, id } = aviso as { tipo?: unknown; id?: unknown }
    if (typeof tipo !== 'string') continue
    const idValido = typeof id === 'string' && id ? id : undefined
    const llave = `${tipo}|${idValido ?? ''}`
    if (vistos.has(llave)) continue
    vistos.add(llave)
    efectos.push(invalidarPorEntidad(queryClient, tipo, idValido))
  }
  await juntar(...efectos)
}
