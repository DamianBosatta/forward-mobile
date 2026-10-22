import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/core/api/client'
import { ventasKeys } from '@/libs/api-client/ventas'
import type { components } from '@/libs/api-client/generated/schema'
import { useDiasEntrega, useFeriados } from '@/libs/api-client/configuracion'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { METODO_ENTREGA, type MetodoEntregaValue } from '@/features/ventas/lib/venta-form-retiro'
import { diaArgentina } from '@/src/utils/date'
import type { TipoDocumento } from '@/features/clientes/components/SeleccionarClienteSheet'
import { fechaEntregaPorDefecto, tiraDeDias } from '../lib/calendario'
import { leerNumero, mostrarNumero } from '../lib/linea'
import type { Cabecera } from '../lib/payload'
import type { VentaCargada } from '../lib/hidratar'

/**
 * Estado de la pestaña Cabecera (plan 9 §2.1). La fecha arranca en la que propone el servidor al
 * crear una venta sin fecha (primer día hábil desde mañana, días de entrega + feriados; ver
 * `fechaEntregaPorDefecto`) hasta que el vendedor elija otra. Sin calendario (cargando o con
 * error) no se propone ninguna: no se adivina un día hábil.
 */
export function useCabeceraVenta(tipo: TipoDocumento, pedirDefectoConFactura = true) {
  const [metodoEntrega, setMetodoEntrega] = useState<MetodoEntregaValue>(METODO_ENTREGA.Logistica)
  const [fechaElegida, setFecha] = useState<string | null>(null)
  // Al editar una venta sin fecha guardada no se propone ninguna: queda vacía hasta que el vendedor elija.
  const [proponer, setProponer] = useState(true)
  const [fleteTexto, setFleteTexto] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [cesionTexto, setCesionTexto] = useState('')
  // Con factura (venta-form.tsx de la web): nace con el default de ventas; lo elegido gana; sin default no hay valor.
  const [conFacturaElegido, setConFactura] = useState<boolean | null>(null)
  const conFacturaDefecto = useQuery({
    queryKey: [...ventasKeys.all, 'con-factura-por-defecto'] as const,
    queryFn: () => api.get<components['schemas']['VentaConFacturaPorDefectoDto']>('/api/v1/Ventas/con-factura-por-defecto'),
    staleTime: 60_000,
    // Como la web (venta-form.tsx:275): al editar el tilde sale de la venta y no se pide el default.
    enabled: pedirDefectoConFactura,
  })
  const conFactura = conFacturaElegido ?? conFacturaDefecto.data?.ventaConFacturaPorDefecto
  const [ahora] = useState(() => Date.now())
  const dias = useDiasEntrega()
  const feriados = useFeriados(diaArgentina(ahora))
  // Con datos en caché el calendario sirve aunque falle un refetch de fondo.
  const calendarioListo = dias.data !== undefined && feriados.data !== undefined
  const calendario = useMemo(() => ({ dias: dias.data ?? null, feriados: feriados.data ?? [] }), [dias.data, feriados.data])
  const tira = useMemo(() => tiraDeDias(ahora, calendario), [ahora, calendario])
  const propuesta = useMemo(() => (calendarioListo ? fechaEntregaPorDefecto(ahora, calendario) : null), [ahora, calendario, calendarioListo])
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
    fecha: fechaElegida ?? (proponer ? propuesta : null),
    flete: metodoEntrega === METODO_ENTREGA.Logistica && fleteLeido !== null ? fleteLeido : 0,
    observaciones,
    conFactura,
  }
  /** Carga la cabecera de una venta del servidor; sin fecha, `proponerFecha` decide si se propone la del servidor. */
  const hidratar = (h: VentaCargada['cabecera'], proponerFecha = true, conFacturaDeLaVenta = false) => {
    setProponer(proponerFecha)
    setMetodoEntrega(h.metodoEntrega)
    setFecha(h.fecha)
    setFleteTexto(h.flete > 0 ? mostrarNumero(h.flete) : '')
    setObservaciones(h.observaciones)
    // Editar y retomar traen el tilde de la venta (web: setConFacturaElegido(hydration.conFactura)); duplicar parte del default.
    if (conFacturaDeLaVenta) setConFactura(h.conFactura)
  }
  return {
    cabecera, tira, hidratar, setConFactura,
    calendarioError: (dias.isError && dias.data === undefined) || (feriados.isError && feriados.data === undefined),
    reintentarCalendario: () => { if (dias.isError) void dias.refetch(); if (feriados.isError) void feriados.refetch() }, setMetodoEntrega, setFecha, fleteTexto, setFleteTexto, fleteInvalido, observaciones, setObservaciones,
    comision, puedeCeder, cesionTexto, setCesionTexto, cesionError,
    porcentajeCedido: puedeCeder && !cesionError && cesionLeida ? cesionLeida : undefined,
  }
}

export type CabeceraVentaEstado = ReturnType<typeof useCabeceraVenta>
