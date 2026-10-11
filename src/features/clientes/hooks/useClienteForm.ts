import { useEffect, useRef, useState } from 'react'
import { useCreateSocio, useSocio, useUpdateSocio } from '@/libs/api-client/socios'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import type { TipoCondicionPago } from '../lib/cliente'

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
}

const VACIO: DatosCliente = {
  direccion: '', nombreFantasia: '', nombreContacto: '', telefono: '', razonSocial: '', cuit: '',
  condicionIva: 'Responsable Inscripto', email: '', tipoPago: 'Contado', plazo: '',
}

function condicionPago(d: DatosCliente) {
  const n = d.plazo.trim() === '' ? null : Number(d.plazo)
  if (d.tipoPago === 'DiaFijoDelMes') return { tipo: d.tipoPago, diaDelMes: n }
  if (d.tipoPago === 'Contado') return { tipo: d.tipoPago }
  return { tipo: d.tipoPago, dias: n }
}

/**
 * Alta y edición de un cliente. Valida el servidor: si rechaza, se muestra su mensaje tal cual.
 * La condición de pago solo se manda con CAP_AUTORIZAR_VENTA; sin ella va ausente, que en el
 * servidor es "no tocar".
 */
export function useClienteForm(id: string | undefined, alGuardar: (id: string) => void) {
  const editando = !!id
  const puedeCambiarPago = useAuthStore(s => s.hasCapability('CAP_AUTORIZAR_VENTA'))
  const { data: actual, isFetchedAfterMount, error: errorDeCarga, refetch } = useSocio(id ?? '', { fresco: true })
  const crear = useCreateSocio()
  const actualizar = useUpdateSocio()
  const [datos, setDatos] = useState<DatosCliente>(VACIO)
  const [error, setError] = useState<string | null>(null)

  // Se llena UNA vez por cliente, con el detalle traído al abrir: un refetch posterior no pisa lo tipeado.
  const llenadoDe = useRef<string | null>(null)
  const [cargado, setCargado] = useState(false)

  useEffect(() => {
    if (!editando || !actual || !isFetchedAfterMount || llenadoDe.current === id) return
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
    })
    setCargado(true)
  }, [editando, actual, isFetchedAfterMount, id])

  const cambiar = <K extends keyof DatosCliente>(campo: K, valor: DatosCliente[K]) =>
    setDatos(d => ({ ...d, [campo]: valor }))

  const guardar = async () => {
    if (editando && !cargado) return
    setError(null)
    const comun = {
      direccion: datos.direccion.trim(),
      nombreFantasia: datos.nombreFantasia.trim(),
      nombreContacto: datos.nombreContacto.trim(),
      telefono: datos.telefono.trim(),
      razonSocial: datos.razonSocial.trim(),
      cuit: datos.cuit.trim(),
      condicionIva: datos.condicionIva,
      email: datos.email.trim(),
      condicionPago: puedeCambiarPago ? condicionPago(datos) : undefined,
    }
    try {
      if (editando && id) {
        // El horario no se edita acá, pero el servidor lo pisa con lo que llegue: se devuelve el actual.
        await actualizar.mutateAsync({ ...comun, id, horario: actual?.horario })
        alGuardar(id)
      } else {
        alGuardar(await crear.mutateAsync({ ...comun, tipoRaw: 0, altaProvisoria: false, saldoInicial: 0 }))
      }
    } catch (e) {
      setError(mensajeDelServidor(e, 'No se pudo guardar el cliente.'))
    }
  }

  return {
    datos, cambiar, guardar, error, editando, puedeCambiarPago,
    cargando: editando && !cargado && !errorDeCarga,
    /** Al editar, el detalle no cargó: no se muestra el formulario (guardaría en blanco). */
    errorDeCarga: editando && !cargado && errorDeCarga ? mensajeDelServidor(errorDeCarga, 'No se pudo cargar el cliente.') : null,
    reintentar: () => { void refetch() },
    guardando: crear.isPending || actualizar.isPending,
  }
}
