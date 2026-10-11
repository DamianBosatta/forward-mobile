import { useMemo, useState } from 'react'
import { useDiasEntrega, useFeriados } from '@/libs/api-client/configuracion'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { METODO_ENTREGA, type MetodoEntregaValue } from '@/features/ventas/lib/venta-form-retiro'
import { diaArgentina } from '@/src/utils/date'
import type { TipoDocumento } from '@/features/clientes/components/SeleccionarClienteSheet'
import { proximoHabil, tiraDeDias } from '../lib/calendario'
import { leerNumero, mostrarNumero } from '../lib/linea'
import type { Cabecera } from '../lib/payload'
import type { VentaCargada } from '../lib/hidratar'

/**
 * Estado de la pestaña Cabecera (plan 9 §2.1). La fecha arranca en el próximo día hábil del
 * calendario del servidor (días de entrega + feriados) hasta que el vendedor elija otra. Sin
 * calendario (cargando o con error) no se propone ninguna: no se adivina un día hábil.
 */
export function useCabeceraVenta(tipo: TipoDocumento) {
  const [metodoEntrega, setMetodoEntrega] = useState<MetodoEntregaValue>(METODO_ENTREGA.Logistica)
  const [fechaElegida, setFecha] = useState<string | null>(null)
  // Al editar una venta sin fecha guardada no se propone ninguna: queda vacía hasta que el vendedor elija.
  const [proponer, setProponer] = useState(true)
  const [fleteTexto, setFleteTexto] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [cesionTexto, setCesionTexto] = useState('')
  const [ahora] = useState(() => Date.now())
  const dias = useDiasEntrega()
  const feriados = useFeriados(diaArgentina(ahora))
  // Con datos en caché el calendario sirve aunque falle un refetch de fondo.
  const calendarioListo = dias.data !== undefined && feriados.data !== undefined
  const tira = useMemo(() => tiraDeDias(ahora, { dias: dias.data ?? null, feriados: feriados.data ?? [] }), [ahora, dias.data, feriados.data])
  const user = useAuthStore((s) => s.user)

  const fleteLeido = fleteTexto.trim() ? leerNumero(fleteTexto) : 0
  const fleteInvalido = fleteLeido === null
  // Cesión (D7): solo el propio vendedor con comisión activa, solo en Pedido; entre la mitad y
  // menos que su comisión. El servidor la vuelve a validar y la manda siempre a autorización.
  const comision = user?.comisionActiva ? (user.porcentajeComision ?? 0) : 0
  const puedeCeder = tipo === 'Pedido' && comision > 0
  const cesionLeida = cesionTexto.trim() ? leerNumero(cesionTexto) : null
  const cesionError = !puedeCeder || !cesionTexto.trim() ? null
    : cesionLeida === null || cesionLeida < comision / 2 || cesionLeida >= comision
      ? `Podés ceder desde ${mostrarNumero(comision / 2)} % hasta menos de ${mostrarNumero(comision)} %.` : null

  const cabecera: Cabecera = {
    metodoEntrega,
    fecha: fechaElegida ?? (proponer && calendarioListo ? proximoHabil(tira) : null),
    flete: metodoEntrega === METODO_ENTREGA.Logistica && fleteLeido !== null ? fleteLeido : 0,
    observaciones,
  }
  /** Carga la cabecera de una venta del servidor; sin fecha, `proponerFecha` decide si se propone el próximo hábil. */
  const hidratar = (h: VentaCargada['cabecera'], proponerFecha = true) => {
    setProponer(proponerFecha)
    setMetodoEntrega(h.metodoEntrega)
    setFecha(h.fecha)
    setFleteTexto(h.flete > 0 ? mostrarNumero(h.flete) : '')
    setObservaciones(h.observaciones)
  }
  return {
    cabecera, tira, hidratar,
    calendarioError: (dias.isError && dias.data === undefined) || (feriados.isError && feriados.data === undefined),
    reintentarCalendario: () => { if (dias.isError) void dias.refetch(); if (feriados.isError) void feriados.refetch() }, setMetodoEntrega, setFecha, fleteTexto, setFleteTexto, fleteInvalido, observaciones, setObservaciones,
    comision, puedeCeder, cesionTexto, setCesionTexto, cesionError,
    porcentajeCedido: puedeCeder && !cesionError && cesionLeida ? cesionLeida : undefined,
  }
}

export type CabeceraVentaEstado = ReturnType<typeof useCabeceraVenta>
