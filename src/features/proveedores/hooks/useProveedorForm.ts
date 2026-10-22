import { useEffect, useRef, useState } from 'react'
import { useCreateSocio, useSocio, useUpdateSocio } from '@/libs/api-client/socios'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { sensiblesBloqueados } from '@/features/socios/lib/camposSensibles'
import { errorDeCuit } from '@/features/socios/lib/cuit'
import { condicionPagoParaEnviar, type TipoCondicionPago } from '@/features/clientes/lib/cliente'
import { DIA_DEL_MES_FALTANTE, PLAZO_FALTANTE, RAZON_SOCIAL_CORTA } from '../lib/proveedor'

export interface DatosProveedor {
  razonSocial: string
  cuit: string
  condicionIva: string
  telefono: string
  tipoPago: TipoCondicionPago
  /** Días o día del mes, según el tipo de condición. */
  plazo: string
}

const VACIO: DatosProveedor = {
  razonSocial: '', cuit: '', condicionIva: 'Responsable Inscripto', telefono: '', tipoPago: 'Contado', plazo: '',
}

/** Lo que el servidor rechazaría igual, dicho antes de mandar (X5). Null si está bien. */
function errorDe(d: DatosProveedor, bloqueo: { razonSocial: boolean; cuit: boolean }, esAltaNueva: boolean): string | null {
  if (!bloqueo.razonSocial && d.razonSocial.trim().length < 3) return RAZON_SOCIAL_CORTA
  const cuit = bloqueo.cuit ? null : errorDeCuit(d.cuit, { esAltaNueva, altaProvisoria: false })
  if (cuit) return cuit
  if (d.tipoPago !== 'Contado' && !(Number(d.plazo) > 0)) return d.tipoPago === 'DiaFijoDelMes' ? DIA_DEL_MES_FALTANTE : PLAZO_FALTANTE
  return null
}

/**
 * Alta y edición de un proveedor. Mismo endpoint que la web (`/socios-comerciales`, `tipoRaw: 1`) y
 * la misma regla de campos sensibles. La condición de pago viaja siempre (la web la exige a todo
 * proveedor). Lo que esta pantalla no edita (dirección, contacto, email, horario, franja de entrega)
 * se devuelve como está: el servidor pisa con lo que llegue.
 */
export function useProveedorForm(id: string | undefined, alGuardar: (id: string) => void) {
  const editando = !!id
  const esAdmin = useAuthStore(s => s.isAdmin())
  const { data: actual, isFetchedAfterMount, isSuccess, error: errorDeCarga, refetch } = useSocio(id ?? '', { fresco: true })
  const crear = useCreateSocio()
  const actualizar = useUpdateSocio()
  const [datos, setDatos] = useState<DatosProveedor>(VACIO)
  const [error, setError] = useState<string | null>(null)

  // Se llena UNA vez por proveedor, con el detalle traído al abrir: un refetch posterior no pisa lo tipeado.
  const llenadoDe = useRef<string | null>(null)
  const [cargado, setCargado] = useState(false)

  useEffect(() => {
    if (!editando || !actual || !isFetchedAfterMount || !isSuccess || llenadoDe.current === id) return
    llenadoDe.current = id ?? null
    const cp = actual.condicionPago
    setDatos({
      razonSocial: actual.razonSocial ?? '',
      cuit: actual.cuit ?? '',
      condicionIva: actual.condicionIva ?? '',
      telefono: actual.telefono ?? '',
      tipoPago: cp?.tipo ?? 'Contado',
      plazo: String((cp?.tipo === 'DiaFijoDelMes' ? cp.diaDelMes : cp?.dias) ?? ''),
    })
    setCargado(true)
  }, [editando, actual, isFetchedAfterMount, isSuccess, id])

  const cambiar = <K extends keyof DatosProveedor>(campo: K, valor: DatosProveedor[K]) =>
    setDatos(d => ({ ...d, [campo]: valor }))

  const bloqueo = sensiblesBloqueados(esAdmin, editando, actual)

  const guardar = async () => {
    if (editando && !cargado) return
    setError(null)
    const invalido = errorDe(datos, bloqueo, !editando)
    if (invalido) return setError(invalido)
    const comun = {
      razonSocial: datos.razonSocial.trim(),
      cuit: datos.cuit.trim(),
      condicionIva: datos.condicionIva,
      telefono: datos.telefono.trim(),
      condicionPago: condicionPagoParaEnviar(datos.tipoPago, datos.plazo),
      direccion: actual?.direccion ?? '',
      nombreFantasia: actual?.nombreFantasia ?? '',
      nombreContacto: actual?.nombreContacto ?? '',
      email: actual?.email ?? '',
      horario: actual?.horario,
      franjaEntrega: actual?.franjaEntrega,
    }
    try {
      if (editando && id) {
        await actualizar.mutateAsync({ ...comun, id })
        alGuardar(id)
      } else {
        alGuardar(await crear.mutateAsync({ ...comun, tipoRaw: 1, saldoInicial: 0 }))
      }
    } catch (e) {
      setError(mensajeDelServidor(e, 'No se pudo guardar el proveedor.'))
    }
  }

  return {
    datos, cambiar, guardar, error, editando, bloqueo,
    cargando: editando && !cargado && !errorDeCarga,
    /** Al editar, el detalle no cargó: no se muestra el formulario (guardaría en blanco). */
    errorDeCarga: editando && !cargado && errorDeCarga ? mensajeDelServidor(errorDeCarga, 'No se pudo cargar el proveedor.') : null,
    reintentar: () => { void refetch() },
    guardando: crear.isPending || actualizar.isPending,
    guardado: editando ? actual : undefined,
  }
}
