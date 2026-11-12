import { useEffect, useRef, useState } from 'react'
import { useCreateSocio, useSocio, useUpdateSocio } from '@/libs/api-client/socios'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { leerNumero, mostrarNumero } from '@/core/utils/numero'
import { agruparFranjas, expandirFilas, horaValida, validarFilas, type FilaHorario } from '@/core/utils/horario'
import { condicionPagoParaEnviar, type TipoCondicionPago } from '../lib/cliente'

export interface DatosCliente {
  direccion: string
  nombreFantasia: string
  nombreContacto: string
  telefono: string
  razonSocial: string
  cuit: string
  condicionIva: string
  email: string
  tipoPago: TipoCondicionPago
  /** Días o día del mes, según el tipo de condición. */
  plazo: string
  /** Tope de crédito en pesos; vacío = sin tope. */
  tope: string
  /** Solo en el alta: el cliente nace provisorio y se completan los datos después. */
  altaProvisoria: boolean
  /** Horario de entrega en filas (días + desde/hasta); al guardar se abre en una franja por día. */
  horario: FilaHorario[]
}

const VACIO: DatosCliente = {
  direccion: '', nombreFantasia: '', nombreContacto: '', telefono: '', razonSocial: '', cuit: '',
  condicionIva: 'Responsable Inscripto', email: '', tipoPago: 'Contado', plazo: '', tope: '', altaProvisoria: false, horario: [],
}

export const HORARIO_INVALIDO = 'Revisá el horario de entrega: hay filas con errores.'
export const TOPE_INVALIDO = 'Revisá el tope de crédito: va en pesos, sin signo.'

/**
 * El tope solo viaja si cambió (ausente = no tocar en el servidor; `monto: null` lo quita). Undefined si no
 * hay cambio; `error` si lo tipeado no es un número.
 */
function cambioDeTope(texto: string, actual: number | null | undefined): { topeCredito?: { monto: number | null } } | { error: string } {
  const monto = texto.trim() === '' ? null : leerNumero(texto)
  if (texto.trim() !== '' && monto === null) return { error: TOPE_INVALIDO }
  return monto === (actual ?? null) ? {} : { topeCredito: { monto } }
}

/**
 * Alta y edición de un cliente. Valida el servidor: si rechaza, se muestra su mensaje tal cual.
 * La condición de pago solo se manda con CAP_AUTORIZAR_VENTA; sin ella va ausente, que en el
 * servidor es "no tocar".
 */
export type DestinoAlGuardar = 'ficha' | 'vender'

export function useClienteForm(id: string | undefined, alGuardar: (id: string, destino: DestinoAlGuardar) => void) {
  const editando = !!id
  const puedeCambiarPago = useAuthStore(s => s.hasCapability('CAP_AUTORIZAR_VENTA'))
  const { data: actual, isFetchedAfterMount, isSuccess, error: errorDeCarga, refetch } = useSocio(id ?? '', { fresco: true })
  const crear = useCreateSocio()
  const actualizar = useUpdateSocio()
  const [datos, setDatos] = useState<DatosCliente>(VACIO)
  const [error, setError] = useState<string | null>(null)
  const [intentoGuardar, setIntentoGuardar] = useState(false)

  // Se llena UNA vez por cliente, con el detalle traído al abrir (si el refetch falló, el caché viejo no vale): un refetch posterior no pisa lo tipeado.
  const llenadoDe = useRef<string | null>(null)
  const [cargado, setCargado] = useState(false)

  useEffect(() => {
    if (!editando || !actual || !isFetchedAfterMount || !isSuccess || llenadoDe.current === id) return
    llenadoDe.current = id ?? null
    const cp = actual.condicionPago
    setDatos({
      direccion: actual.direccion ?? '',
      nombreFantasia: actual.nombreFantasia ?? '',
      nombreContacto: actual.nombreContacto ?? '',
      telefono: actual.telefono ?? '',
      razonSocial: actual.razonSocial ?? '',
      cuit: actual.cuit ?? '',
      condicionIva: actual.condicionIva ?? '',
      email: actual.email ?? '',
      tipoPago: cp?.tipo ?? 'Contado',
      plazo: String((cp?.tipo === 'DiaFijoDelMes' ? cp.diaDelMes : cp?.dias) ?? ''),
      tope: actual.topeCredito != null ? mostrarNumero(actual.topeCredito) : '',
      altaProvisoria: false,
      horario: agruparFranjas(actual.horario),
    })
    setCargado(true)
  }, [editando, actual, isFetchedAfterMount, isSuccess, id])

  const cambiar = <K extends keyof DatosCliente>(campo: K, valor: DatosCliente[K]) =>
    setDatos(d => ({ ...d, [campo]: valor }))

  /** `destino` solo cambia a dónde se va después de guardar: el pedido es el mismo. */
  const guardar = async (destino: DestinoAlGuardar = 'ficha') => {
    if (editando && !cargado) return
    setError(null)
    setIntentoGuardar(true)
    if (validarFilas(datos.horario).some(e => e)) return setError(HORARIO_INVALIDO)
    // El tope lo fija solo quien autoriza ventas (el servidor lo exige): sin la capacidad no se manda.
    const tope = puedeCambiarPago ? cambioDeTope(datos.tope, actual?.topeCredito) : {}
    if ('error' in tope) return setError(tope.error)
    const franjas = expandirFilas(datos.horario.map(f => ({ ...f, desde: horaValida(f.desde)!, hasta: horaValida(f.hasta)! })))
    const comun = {
      direccion: datos.direccion.trim(),
      nombreFantasia: datos.nombreFantasia.trim(),
      nombreContacto: datos.nombreContacto.trim(),
      telefono: datos.telefono.trim(),
      razonSocial: datos.razonSocial.trim(),
      cuit: datos.cuit.trim(),
      condicionIva: datos.condicionIva,
      email: datos.email.trim(),
      condicionPago: puedeCambiarPago ? condicionPagoParaEnviar(datos.tipoPago, datos.plazo) : undefined,
      ...tope,
    }
    try {
      if (editando && id) {
        // El servidor pisa el horario con lo que llegue: sin filas se devuelve el actual si ya estaba vacío, y [] si se quitaron todas.
        const horario = franjas.length > 0 || (actual?.horario?.length ?? 0) > 0 ? franjas : actual?.horario
        await actualizar.mutateAsync({ ...comun, id, horario })
        alGuardar(id, destino)
      } else {
        alGuardar(await crear.mutateAsync({ ...comun, ...(franjas.length > 0 ? { horario: franjas } : {}), tipoRaw: 0, altaProvisoria: datos.altaProvisoria, saldoInicial: 0 }), destino)
      }
    } catch (e) {
      setError(mensajeDelServidor(e, 'No se pudo guardar el cliente.'))
    }
  }

  return {
    datos, cambiar, guardar, error, intentoGuardar, editando, puedeCambiarPago,
    cargando: editando && !cargado && !errorDeCarga,
    /** Al editar, el detalle no cargó: no se muestra el formulario (guardaría en blanco). */
    errorDeCarga: editando && !cargado && errorDeCarga ? mensajeDelServidor(errorDeCarga, 'No se pudo cargar el cliente.') : null,
    reintentar: () => { void refetch() },
    guardando: crear.isPending || actualizar.isPending,
    /** El detalle tal como está guardado: de ahí sale qué campos sensibles ya tienen valor (y se bloquean). */
    guardado: editando ? actual : undefined,
  }
}
