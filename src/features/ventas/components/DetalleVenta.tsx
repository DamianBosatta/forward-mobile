import React from 'react'
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { Notice, StatusChip, TopBar, TotalsRow, chipForEstado, formatImporte } from '@/core/ui/fw'
import { api } from '@/core/api/client'
import { usePermissions } from '@/core/auth/RequirePermission'
import { esEstadoVenta } from '@/core/constants/estados'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useVenta, ventasKeys } from '@/libs/api-client/ventas'
import { useSocio } from '@/libs/api-client/socios'
import type { components } from '@/libs/api-client/generated/schema'
import { direccionDeEntrega, nombreDelCliente } from '@/features/clientes/lib/cliente'
import { urlLlamar } from '@/features/clientes/lib/contacto'
import { motivosAutorizacion } from '@/features/venta-nueva/lib/motivosAutorizacion'
import { mostrarNumero } from '@/features/venta-nueva/lib/linea'
import { codigoDeVenta, tipoDeVenta } from '@/features/venta-nueva/lib/ventaGuardada'
import { accionesDeVenta, DIAS_VIGENCIA_PRESUPUESTO } from '../lib/accionesVenta'
import { diaDeEntregaCorto } from '../lib/entrega'
import { pasosDeLaVenta } from '../lib/lineaDeTiempo'
import { horaDe, tituloDelDia } from '../lib/agruparPorDia'
import { AccionesDeVenta, BarraDeLaVenta } from './AccionesDeVenta'
import { LineasDeLaVenta } from './LineasDeLaVenta'
import { VentaRechazada } from './VentaRechazada'

type Pagos = components['schemas']['VentaPagosDto']
type Simulacion = components['schemas']['SimulacionComisionDto']

interface Props {
  id: string
  /** Embebido en el panel derecho de la lista (tablet): cierra el panel en vez de navegar. */
  onVolver?: () => void
}

/** Línea de tiempo del pedido (ResVentaDetalle): cinco tramos; el actual, en blanco y a la mitad si se está preparando. */
function LineaDeTiempo({ pasos }: { pasos: NonNullable<ReturnType<typeof pasosDeLaVenta>> }) {
  const c = useColors()
  return (
    <View accessibilityRole="list" accessibilityLabel="Estado del pedido" style={{ flexDirection: 'row', gap: 4, paddingHorizontal: space[3], paddingBottom: space[4], backgroundColor: c.topBar }}>
      {pasos.map((p) => (
        <View key={p.etiqueta} accessibilityState={{ selected: p.actual }} style={{ flex: 1, gap: 6 }}>
          <View style={{ height: 6, borderRadius: 999, backgroundColor: '#33403D', overflow: 'hidden' }}>
            <View style={{ height: 6, width: p.avance === 'completo' ? '100%' : p.avance === 'medio' ? '50%' : '0%', backgroundColor: c.brand }} />
          </View>
          <Text style={{ fontSize: 11, lineHeight: 14, color: p.actual ? c.onTopBarStrong : c.onTopBar, fontWeight: p.actual ? '700' : '400' }}>{p.etiqueta}</Text>
        </View>
      ))}
    </View>
  )
}

/**
 * Detalle de la venta (láminas ResVentaDetalle, ResPresupuesto, ResRechazada y, en tablet, TabVentasDetalle y
 * TabVentasRechazada, sin salir de la lista). Qué se puede hacer sale de `accionesDeVenta` (reglas de la web).
 */
export function DetalleVenta({ id, onVolver }: Props) {
  const c = useColors()
  const router = useRouter()
  const { canDo } = usePermissions()
  const userId = useAuthStore((s) => s.user?.id)
  const q = useVenta(id)
  const h = q.data?.venta
  const socio = useSocio(h?.clienteId ?? '')
  const pagos = useQuery({ queryKey: [...ventasKeys.detail(id), 'pagos'], queryFn: () => api.get<Pagos>(`/api/v1/Ventas/${id}/pagos`), enabled: !!h })
  const propia = !!h && h.vendedorId === userId
  // Sin `monto`: el servidor simula el cobro de lo que falta (saldo pendiente).
  const comision = useQuery({
    queryKey: ['comisiones', 'simulacion', 'venta', id, h?.totalAmount, pagos.data?.montoPagado],
    queryFn: () => api.get<Simulacion>(`/api/v1/comisiones/simulacion/ventas/${id}`),
    enabled: propia,
  })
  const volver = { kind: 'atras' as const, onPress: onVolver ?? (() => router.back()) }
  const sec = { ...typeScale.secundario, color: c.textSecondary }

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

  const acciones = accionesDeVenta(h, canDo)
  const cliente = socio.data ?? null
  const direccion = cliente ? direccionDeEntrega(cliente) : (h.clienteNombre ?? '')
  const nombre = cliente ? nombreDelCliente(cliente) : ''
  const esPresupuesto = h.tipoOperacion === 1
  const rechazada = esEstadoVenta(h.estado, 'RechazadaAutorizacion')
  const pasos = pasosDeLaVenta(h.estado)
  const chip = chipForEstado('venta', h.estado)
  const motivos = motivosAutorizacion(h.motivoPendienteAutorizacion)
  const sim = comision.data
  const entrega = h.metodoEntregaNombre === 'RetiroEnLocal' ? 'Retiro en el local' : diaDeEntregaCorto(h.fechaEntrega)
  const telefono = cliente?.telefono ?? h.clienteTelefono ?? null
  const cobrar = () => router.push({ pathname: '/(tabs)/cuentas/cobro', params: { socioId: h.clienteId } } as never)
  const fecha = h.fecha ? new Date(h.fecha) : null
  const dato = (k: string, v: string) => (
    <View style={{ flex: 1, padding: space[3], borderRadius: radii.tarjeta, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, gap: space[1] }}>
      <Text style={sec}>{k}</Text>
      <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{v}</Text>
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title={`${tipoDeVenta(h)} ${codigoDeVenta(h)}`} subtitle={nombre ? `${direccion} · ${nombre}` : direccion} leading={volver} />
      {pasos ? <LineaDeTiempo pasos={pasos} /> : null}
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4] }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[2] }}>
          <Text style={sec}>{[fecha ? `${tituloDelDia(fecha)} ${horaDe(h.fecha)}` : null, h.vendedorNombre].filter(Boolean).join(' · ')}</Text>
          {chip ? <StatusChip estado={chip.estado} label={chip.label} /> : null}
        </View>

        {rechazada ? (
          <VentaRechazada
            venta={h}
            deudaVencida={cliente?.deudaVencidaAmount ?? null}
            telefono={telefono}
            onCobrar={acciones.cobrar ? cobrar : null}
            onArmarIgual={canDo('MOD_VENTAS', 'create') ? () => router.push(`/(tabs)/ventas/nueva?duplicar=${h.id}` as never) : null}
            onLlamar={telefono ? () => void Linking.openURL(urlLlamar(telefono)) : null}
          />
        ) : (
          <>
            {esPresupuesto ? (
              <Notice tone="info">{esEstadoVenta(h.estado, 'Vencido')
                ? `Venció. Reabrilo y vuelven a correr los ${DIAS_VIGENCIA_PRESUPUESTO} días. Un presupuesto no reserva stock.`
                : `Vence a los ${DIAS_VIGENCIA_PRESUPUESTO} días de guardado. Si no lo pasás a pedido, queda vencido. Un presupuesto no reserva stock.`}</Notice>
            ) : (
              <View style={{ gap: space[2] }}>
                <Text accessibilityRole="header" style={{ ...typeScale.cuerpoDestacado, color: c.text }}>Entrega y factura</Text>
                <View style={{ flexDirection: 'row', gap: space[2] }}>{dato('Entrega', entrega ?? 'A coordinar')}{dato('Con factura', h.conFactura ? 'Sí' : 'No')}</View>
              </View>
            )}
            {esEstadoVenta(h.estado, 'PendienteAutorizacion') ? (
              <Notice tone="advertencia" title="Quedó por autorizar porque:">
                {`${motivos.map((m) => `• ${m.charAt(0).toUpperCase()}${m.slice(1)}.`).join('\n')}${motivos.length ? '\n' : ''}Te avisamos cuando lo resuelvan.`}
              </Notice>
            ) : null}
            {h.motivoAnulacion ? <Notice tone="peligro" title="Se anuló">{h.motivoAnulacion}</Notice> : null}
            <Text accessibilityRole="header" style={{ ...typeScale.cuerpoDestacado, color: c.text }}>Productos</Text>
            <LineasDeLaVenta detalles={q.data.detalles} />
            <View style={{ gap: space[1] }}>
              {h.montoDescuentoAmount ? <TotalsRow label={`Descuento general ${mostrarNumero(h.porcentajeDescuento)} %`} importe={-h.montoDescuentoAmount} /> : null}
              {h.cargoFleteAmount ? <TotalsRow label="Flete" importe={h.cargoFleteAmount} /> : null}
              <TotalsRow label="Total" importe={h.totalAmount} destacado />
              {sim?.comisionActiva && sim.montoCobro > 0 ? (
                <Text style={{ ...typeScale.secundario, alignSelf: 'flex-start', paddingHorizontal: space[2], borderRadius: radii.pastilla, backgroundColor: c.brandSoft, color: c.brandInk }}>
                  {`Tu comisión estimada${sim.montoCobro < h.totalAmount ? ' sobre lo pendiente de cobro' : ''} ${formatImporte(sim.montoComision)}`}
                </Text>
              ) : null}
              {!esPresupuesto && pagos.data?.montoPagado != null ? <TotalsRow label="Cobrado" importe={pagos.data.montoPagado} /> : null}
              {!esPresupuesto && pagos.data?.saldoPendiente != null ? <TotalsRow label="Saldo del pedido" importe={pagos.data.saldoPendiente} /> : null}
            </View>
            {h.observaciones ? <Text style={sec}>{`Observaciones: ${h.observaciones}`}</Text> : null}
            {acciones.motivoNoEditable ? <Notice tone="info">{acciones.motivoNoEditable}</Notice> : null}
            <Pressable accessibilityRole="link" onPress={() => router.push(`/(tabs)/socios/${h.clienteId}` as never)} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ ...typeScale.cuerpoDestacado, color: c.brandInk }}>Ver ficha del cliente</Text>
            </Pressable>
            <AccionesDeVenta venta={q.data} acciones={acciones} onAnulada={() => (onVolver ? onVolver() : router.back())} />
          </>
        )}
      </ScrollView>
      {rechazada || esEstadoVenta(h.estado, 'Anulada') ? null : (
        <BarraDeLaVenta venta={q.data} acciones={acciones} conSaldo={(pagos.data?.saldoPendiente ?? 0) > 0} onCobrar={cobrar} />
      )}
    </View>
  )
}
