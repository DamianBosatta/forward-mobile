import React from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { parseDateSafe, partesArgentina } from '@/src/utils/date'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Notice, StatusChip, TopBar, TotalsRow, chipForEstado, formatImporte } from '@/core/ui/fw'
import { api } from '@/core/api/client'
import { useVenta, ventasKeys } from '@/libs/api-client/ventas'
import { useSocio } from '@/libs/api-client/socios'
import type { components } from '@/libs/api-client/generated/schema'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { direccionDeEntrega, nombreDelCliente, textoCondicionPago, type CondicionPago } from '@/features/clientes/lib/cliente'
import { horaDe, tituloDelDia } from '@/features/ventas/lib/agruparPorDia'
import { mostrarNumero } from '../lib/linea'
import { agruparPorPadre, nombreFragancia } from '../lib/fragancias'
import { motivosAutorizacion } from '../lib/motivosAutorizacion'
import { esEstadoVenta } from '@/core/constants/estados'
import { codigoDeVenta, rotuloCliente, tipoDeVenta } from '../lib/ventaGuardada'
import { AccionesVenta } from './AccionesVenta'

type Pagos = components['schemas']['VentaPagosDto']

/**
 * "Vence el 7 de noviembre (30 días)": el día (AAAA-MM-DD) y el plazo los da el servidor; el teléfono
 * no calcula vencimientos. El día se arma sin pasar por un instante, para que no lo corra el huso.
 */
function textoVencimientoSaldo(dia: string | null | undefined, plazo: number | null | undefined): string | null {
  const [anio, mes, d] = (dia ?? '').split('-').map(Number)
  if (!anio || !mes || !d) return null
  const texto = `Vence el ${format(new Date(anio, mes - 1, d), "d 'de' MMMM", { locale: es })}`
  return plazo ? `${texto} (${plazo} días)` : texto
}
type Simulacion = components['schemas']['SimulacionComisionDto']
const ENTREGA: Record<string, string> = { LogisticaPropia: 'Logística propia', RetiroEnLocal: 'Retiro en el local', Expreso: 'Expreso' }
const ESTADO_RECHAZADA = 11

/** "Jueves 8 de octubre": la fecha de entrega llega como instante UTC y el día es el argentino, igual que en la tarjeta. */
export function diaDeEntrega(fecha: string | null | undefined): string | null {
  const instante = parseDateSafe(fecha)
  if (!instante) return null
  const f = partesArgentina(instante.getTime())
  const texto = format(new Date(f.anio, f.mes, f.dia), "EEEE d 'de' MMMM", { locale: es })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

interface Props {
  id: string
  /** Embebido en el panel derecho de la lista (tablet): cierra el panel en vez de navegar. */
  onVolver?: () => void
}

/**
 * Detalle de la venta con el formato nuevo (lámina DetalleVenta, plan 9 §2.1, PR 2.10): estado,
 * número, cliente por dirección, motivos de autorización del servidor, entrega, líneas, totales,
 * comisión estimada (del servidor, solo en una venta propia), cobros y las acciones de la 2.9.
 */
export function DetalleVentaNueva({ id, onVolver }: Props) {
  const c = useColors()
  const router = useRouter()
  const userId = useAuthStore((s) => s.user?.id)
  const q = useVenta(id)
  const h = q.data?.venta
  const socio = useSocio(h?.clienteId ?? '')
  const pagos = useQuery({ queryKey: [...ventasKeys.detail(id), 'pagos'], queryFn: () => api.get<Pagos>(`/api/v1/Ventas/${id}/pagos`), enabled: !!h })
  const propia = !!h && h.vendedorId === userId
  // Sin `monto`: el servidor simula el cobro de lo que falta (saldo pendiente). Mandar el total con
  // cobros parciales le hace responder 400 ("supera el saldo pendiente") y el chip desaparecía.
  const comision = useQuery({
    queryKey: ['comisiones', 'simulacion', 'venta', id, h?.totalAmount, pagos.data?.montoPagado],
    queryFn: () => api.get<Simulacion>(`/api/v1/comisiones/simulacion/ventas/${id}`),
    enabled: propia,
  })
  const volver = { kind: 'atras' as const, onPress: onVolver ?? (() => router.back()) }
  const sec = { ...typeScale.secundario, color: c.textSecondary }
  const vencimiento = textoVencimientoSaldo(pagos.data?.vencimientoSaldo, pagos.data?.plazoVencimientoDias)
  const tarjeta = { padding: space[4], borderRadius: radii.tarjeta, backgroundColor: c.surface, gap: space[2] }
  const titulo = (t: string) => <Text accessibilityRole="header" style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{t}</Text>
  const fila = (k: string, v: string) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[3] }}>
      <Text style={sec}>{k}</Text>
      <Text style={{ ...typeScale.cuerpo, color: c.text, flexShrink: 1, textAlign: 'right' }}>{v}</Text>
    </View>
  )

  if (!q.data || !h) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar title="Venta" leading={volver} />
        <View style={{ padding: space[4] }}>
          {q.isError ? <Notice tone="peligro">No se pudo traer la venta. Volvé a intentar.</Notice> : <ActivityIndicator color={c.brand} />}
        </View>
      </View>
    )
  }
  const chip = chipForEstado('venta', h.estado)
  const cliente = socio.data ?? null
  const direccion = cliente ? direccionDeEntrega(cliente) : (h.clienteNombre ?? '')
  const motivos = motivosAutorizacion(h.motivoPendienteAutorizacion)
  const sim = comision.data
  const fecha = h.fecha ? new Date(h.fecha) : null
  const entrega = diaDeEntrega(h.fechaEntrega)

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title={`${tipoDeVenta(h)} ${codigoDeVenta(h)}`} leading={volver} />
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4] }}>
        <View style={tarjeta}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space[2] }}>
            <Text style={{ ...typeScale.titulo, color: c.text, flex: 1 }}>{direccion}</Text>
            {chip ? <StatusChip estado={chip.estado} label={chip.label} /> : null}
          </View>
          <Text style={sec}>{[fecha ? `${tituloDelDia(fecha)} ${horaDe(h.fecha)}` : null, h.vendedorNombre].filter(Boolean).join(' · ')}</Text>
          <TotalsRow label="Total" importe={h.totalAmount} destacado />
          {sim?.comisionActiva && sim.montoCobro > 0 ? (
            <Text style={{ ...typeScale.secundario, alignSelf: 'flex-start', paddingHorizontal: space[2], borderRadius: radii.pastilla, backgroundColor: c.brandSoft, color: c.brandInk }}>
              {`Tu comisión estimada${sim.montoCobro < h.totalAmount ? ' sobre lo pendiente de cobro' : ''} ${formatImporte(sim.montoComision)}`}
            </Text>
          ) : null}
        </View>
        <AccionesVenta venta={q.data} rotulo={cliente ? rotuloCliente(cliente) : direccion} />
        {esEstadoVenta(h.estado, 'PendienteAutorizacion') ? (
          <Notice tone="advertencia" title="Quedó por autorizar porque:">
            {`${motivos.map((m) => `• ${m.charAt(0).toUpperCase()}${m.slice(1)}.`).join('\n')}${motivos.length ? '\n' : ''}Te avisamos cuando lo resuelvan.`}
          </Notice>
        ) : null}
        {h.motivoAnulacion ? <Notice tone="peligro" title="Se anuló">{h.motivoAnulacion}</Notice> : null}
        {h.estado === ESTADO_RECHAZADA && h.motivoRechazoAutorizacion ? <Notice tone="peligro" title="No se autorizó">{h.motivoRechazoAutorizacion}</Notice> : null}
        <View style={tarjeta}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            {titulo('Cliente')}
            <Pressable accessibilityRole="link" onPress={() => router.push(`/(tabs)/socios/${h.clienteId}` as never)} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ ...typeScale.cuerpoDestacado, color: c.brandInk }}>Ver ficha</Text>
            </Pressable>
          </View>
          <Text style={{ ...typeScale.cuerpo, color: c.text }}>{direccion}</Text>
          {cliente && nombreDelCliente(cliente) ? <Text style={sec}>{nombreDelCliente(cliente)}</Text> : null}
          {cliente ? fila('Condición de pago', textoCondicionPago(cliente.condicionPago as CondicionPago | null)) : null}
        </View>
        <View style={tarjeta}>
          {titulo('Entrega')}
          {entrega && h.metodoEntregaNombre !== 'RetiroEnLocal' ? fila('Fecha', entrega) : null}
          {h.metodoEntregaNombre ? fila('Cómo', ENTREGA[h.metodoEntregaNombre] ?? h.metodoEntregaNombre) : null}
          {h.observaciones ? fila('Observaciones', h.observaciones) : null}
          {h.tipoOperacion === 1 ? <Text style={sec}>No reserva stock.</Text> : null}
        </View>
        <View style={tarjeta}>
          {titulo(`Líneas (${q.data.detalles.length})`)}
          {/* Las fragancias de una línea van juntas (la línea llega con forward-system #884; sin ella, cada una sola). */}
          {agruparPorPadre(q.data.detalles, (d) => d.productoPadreId).map((g) => {
            const items = g.tipo === 'producto' ? [g.item] : g.items
            const padre = g.tipo === 'fragancias' ? (items[0]!.productoPadreNombre ?? items[0]!.productoNombre.split(' - ')[0]!) : null
            const unidades = items.reduce((a, d) => a + d.cantidad, 0)
            const precio = items.every((d) => d.precioUnitario === items[0]!.precioUnitario) ? items[0]!.precioUnitario : null
            const desc = items.every((d) => d.porcentajeDescuentoItem === items[0]!.porcentajeDescuentoItem) ? items[0]!.porcentajeDescuentoItem : null
            return (
              <View key={g.tipo === 'producto' ? g.item.id : g.padreId} style={{ gap: space[1], paddingVertical: space[1] }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
                  <Text style={{ ...typeScale.cuerpo, color: c.text, flex: 1 }}>{padre ? `${padre} · fragancias` : items[0]!.productoNombre}</Text>
                  <Text style={{ ...typeScale.cuerpo, ...importe, color: c.text }}>{formatImporte(items.reduce((a, d) => a + d.subtotal, 0))}</Text>
                </View>
                <Text style={{ ...sec, ...importe }}>{precio !== null ? `${unidades} × ${formatImporte(precio)}` : `${unidades} unidades`}</Text>
                {padre ? <Text style={{ ...typeScale.secundario, color: c.text }}>{items.map((d) => `${nombreFragancia({ nombre: d.productoNombre }, padre)} ${d.cantidad}`).join(' · ')}</Text> : null}
                {desc !== null ? <Text style={sec}>{desc > 0 ? `Desc. ${mostrarNumero(desc)} %` : 'Sin descuento'}</Text> : null}
              </View>
            )
          })}
          <TotalsRow label="Subtotal" importe={h.subtotalBrutoAmount} />
          <TotalsRow label={`Descuento general ${mostrarNumero(h.porcentajeDescuento)} %`} importe={-h.montoDescuentoAmount} />
          {h.cargoFleteAmount ? <TotalsRow label="Flete" importe={h.cargoFleteAmount} /> : null}
          <TotalsRow label="Total" importe={h.totalAmount} destacado />
        </View>
        <View style={tarjeta}>
          {titulo('Cobros')}
          {pagos.isError ? <Text style={sec}>No se pudieron traer los cobros.</Text> : null}
          {pagos.data?.imputaciones.map((p) => (
            <View key={`${p.pagoId}-${p.fechaImputacion}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...typeScale.cuerpo, color: c.text }}>{`${p.medioPago} · ${p.numeroPago}`}</Text>
                <Text style={sec}>{`${tituloDelDia(new Date(p.fechaImputacion))} ${horaDe(p.fechaImputacion)}`}</Text>
              </View>
              <Text style={{ ...typeScale.cuerpo, ...importe, color: c.text }}>{formatImporte(p.monto)}</Text>
            </View>
          ))}
          {pagos.data && pagos.data.imputaciones.length === 0 ? <Text style={sec}>Todavía no tiene cobros.</Text> : null}
          {pagos.data?.montoPagado != null ? <TotalsRow label="Cobrado" importe={pagos.data.montoPagado} /> : null}
          {pagos.data?.saldoPendiente != null ? <TotalsRow label={`Saldo del ${tipoDeVenta(h).toLowerCase()}`} importe={pagos.data.saldoPendiente} destacado /> : null}
          {vencimiento ? <Text style={sec}>{vencimiento}</Text> : null}
        </View>
      </ScrollView>
    </View>
  )
}
