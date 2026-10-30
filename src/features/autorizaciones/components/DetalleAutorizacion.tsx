import React, { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Notice, StatusChip, TopBar, TotalsRow, chipForEstado, formatImporte, formatPorcentaje } from '@/core/ui/fw'
import { importe as cifras, radii, space, typeScale, useColors } from '@/libs/theme'
import { useAutorizacionPreview, useVenta } from '@/libs/api-client/ventas'
import { useSocio } from '@/libs/api-client/socios'
import { useAuthStore } from '@/libs/store/auth.store'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { pideRazon, textosDeMotivos } from '../lib/motivos'
import { ClienteParaAutorizar } from './ClienteParaAutorizar'
import { DecisionSheet, type Decision } from './DecisionSheet'

/** El servidor manda el estado como número o como nombre según el endpoint. */
const POR_AUTORIZAR = ['9', 'PendienteAutorizacion']

interface Props {
  id: string
  /** En tablet cierra el panel; en teléfono, vuelve. */
  onVolver?: () => void
}

/**
 * Detalle para autorizar (láminas AutorizarVenta y TabAutorizaciones). Los números de costo
 * y margen solo con CAP_VER_COSTOS: el servidor igual los manda en null sin el permiso. Precio,
 * mínimo y sacrificio de las líneas debajo del piso son del lado del precio: los ve quien autoriza.
 */
export function DetalleAutorizacion({ id, onVolver }: Props) {
  const c = useColors()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const veCostos = useAuthStore((s) => s.hasCapability('CAP_VER_COSTOS'))
  const puedeAutorizar = useAuthStore((s) => s.hasCapability('CAP_AUTORIZAR_VENTA'))
  // Como la web (VentaGestionDetail.tsx:146-149): decidir pide la capacidad Y modificar Ventas.
  const puedeDecidir = useAuthStore((s) => s.hasCapability('CAP_AUTORIZAR_VENTA') && s.canDo('MOD_VENTAS', 'update'))
  const veCuenta = useAuthStore((s) => s.canDo('MOD_CC', 'read'))
  // Igual que el servidor (forward-system #951): la vista previa la abren Ventas:Read y
  // CAP_AUTORIZAR_VENTA. Sin CAP_VER_COSTOS llega igual, pero con el aporte en null.
  const vePreview = useAuthStore((s) => puedeAutorizar && s.canDo('MOD_VENTAS', 'read'))
  // La ficha del cliente la abre Clientes:Read en el servidor; sin ese permiso daría 403 (y quedaría logueado).
  const veClientes = useAuthStore((s) => s.canDo('MOD_CLIENTES', 'read'))
  const q = useVenta(id)
  const venta = q.data?.venta
  const porAutorizar = POR_AUTORIZAR.includes(String(venta?.estado))
  const preview = useAutorizacionPreview(id, vePreview && porAutorizar)
  // Saldo y condición de pago del cliente: es información de apoyo, así que ni la carga ni un error
  // (403, 404, sin red) tocan los botones. `fresco`: para decidir sobre plata no sirve un saldo de hace 5 minutos.
  const socio = useSocio(veClientes ? (venta?.clienteId ?? '') : '', { fresco: true })
  const [decision, setDecision] = useState<Decision | null>(null)
  // La versión cacheada puede tener hasta 60 s: al decidir se vuelve a pedir la venta.
  const [aviso, setAviso] = useState<string | null>(null)
  const abrirDecision = (d: Decision) => { setAviso(null); setDecision(d); void q.refetch() }
  const volver = onVolver ?? (() => router.back())
  const secundario = [typeScale.secundario, { color: c.textSecondary }]
  const tarjeta = { padding: space[4], gap: space[2], borderRadius: radii.tarjeta, backgroundColor: c.surface }

  const titulo = venta?.codigoPedido ?? 'Autorizar venta'
  const barra = <TopBar title={titulo} subtitle={venta ? chipForEstado('venta', venta.estado)?.label : undefined} leading={{ kind: 'atras', onPress: volver }} />

  if (!venta) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        {barra}
        <View style={{ padding: space[4] }}>
          {q.isError ? <Notice tone="peligro">{mensajeDelServidor(q.error, 'No se pudo cargar la venta.')}</Notice> : <ActivityIndicator color={c.brand} />}
        </View>
      </View>
    )
  }

  const debajoDelMinimo = preview.data?.items ?? []
  const motivos = textosDeMotivos(venta.motivoPendienteAutorizacion, q.data?.detalleMotivos)
  const chip = chipForEstado('venta', venta.estado)

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {barra}
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4], paddingBottom: space[12] }}>
        <View style={tarjeta}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
            <Text style={[typeScale.cuerpoDestacado, { color: c.text, flex: 1 }]}>{venta.clienteNombre ?? '—'}</Text>
            {chip ? <StatusChip estado={chip.estado} label={chip.label} /> : null}
          </View>
          <Text style={secundario}>{venta.vendedorNombre ?? ''}</Text>
          <TotalsRow label="Total" importe={venta.totalAmount} destacado />
        </View>

        {aviso ? <Notice tone="peligro">{aviso}</Notice> : null}
        {!porAutorizar ? (
          <Notice tone="info">Esta venta ya no espera autorización.</Notice>
        ) : (
          <>
            <View style={tarjeta}>
              <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>Por qué espera</Text>
              {motivos.map((m) => <Text key={m.clave} style={[typeScale.secundario, { color: c.text }]}>{`• ${m.texto}`}</Text>)}
              {venta.motivoVentaSinStock ? <Text style={secundario}>{`Motivo del vendedor: «${venta.motivoVentaSinStock}»`}</Text> : null}
            </View>
            {puedeDecidir ? null : (
              <Notice tone="info">
                {puedeAutorizar
                  ? 'Para autorizar o rechazar necesitás el permiso de modificar ventas. Pedíselo a un administrador.'
                  : 'Para autorizar o rechazar necesitás el permiso de autorizar ventas. Pedíselo a un administrador.'}
              </Notice>
            )}
          </>
        )}

        {/* Debajo de los botones: si la ficha llega tarde, no los corre de lugar. */}
        <ClienteParaAutorizar socio={socio.isError ? null : socio.data} />
        {veCuenta && venta.clienteId ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Ver cuenta corriente del cliente"
            onPress={() => router.push({ pathname: '/(tabs)/cuentas/[id]', params: { id: venta.clienteId! } })}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Text style={[typeScale.cuerpoDestacado, { color: c.brandInk }]}>Ver cuenta corriente del cliente</Text>
          </Pressable>
        ) : null}

        {veCostos ? (
          <View style={tarjeta} testID="bloque-costos">
            <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>Rentabilidad</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={secundario}>Costo de la venta</Text>
              <Text style={[typeScale.cuerpoDestacado, cifras, { color: c.text }]}>{formatImporte(preview.data?.costoTotal)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={secundario}>Ganancia bruta</Text>
              <Text style={[typeScale.cuerpoDestacado, cifras, { color: c.text }]}>{formatImporte(venta.gananciaBrutaAmount)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={secundario}>Margen de la venta</Text>
              <Text style={[typeScale.cuerpoDestacado, cifras, { color: c.text }]}>{formatPorcentaje(venta.margenBrutoPorcentaje)}</Text>
            </View>
          </View>
        ) : null}

        {debajoDelMinimo.length > 0 ? (
          <View style={tarjeta} testID="bloque-piso">
            <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>Debajo del mínimo</Text>
            {debajoDelMinimo.map((it) => (
              <View key={it.detalleId} accessible style={{ gap: space[1], paddingTop: space[2], borderTopWidth: 1, borderTopColor: c.border }}>
                <Text style={[typeScale.secundario, { color: c.text }]}>{it.productoNombre}</Text>
                <Text style={secundario}>{`Precio ${formatImporte(it.precioEfectivo)} · Mínimo ${formatImporte(it.precioMinimoRentable)}`}</Text>
                <Text style={secundario}>
                  {veCostos ? `Aporte ${formatImporte(it.aporteOverhead)} · Sacrificio ${formatImporte(it.sacrificio)}` : `Sacrificio ${formatImporte(it.sacrificio)}`}
                </Text>
                {veCostos ? <Text style={secundario}>{`Margen ${formatPorcentaje(it.margenPorcentaje)} · Piso ${formatPorcentaje(it.pisoPorcentaje)}`}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        <View style={tarjeta}>
          <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>{`Líneas (${q.data?.detalles.length ?? 0})`}</Text>
          {(q.data?.detalles ?? []).map((d) => (
            <View key={d.id} style={{ gap: space[1], paddingVertical: space[1] }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
                <Text style={[typeScale.secundario, { color: c.text, flex: 1 }]}>{d.productoNombre}</Text>
                <Text style={[typeScale.secundario, cifras, { color: c.text }]}>{formatImporte(d.subtotal)}</Text>
              </View>
              <Text style={secundario}>
                {`${d.cantidad} × ${formatImporte(d.precioUnitario)}${d.porcentajeDescuentoItem > 0 ? ` · Desc. ${formatPorcentaje(d.porcentajeDescuentoItem)}` : ''}`}
              </Text>
            </View>
          ))}
          <TotalsRow label="Subtotal" importe={venta.subtotalBrutoAmount} />
          {venta.montoDescuentoAmount > 0 ? <TotalsRow label="Descuento general" importe={-venta.montoDescuentoAmount} /> : null}
          <TotalsRow label="Flete" importe={venta.cargoFleteAmount} />
          <TotalsRow label="Total" importe={venta.totalAmount} destacado />
        </View>
      </ScrollView>
      {/* Barra fija como la lámina: decidir siempre a mano, con el margen en amarillo pide motivo. */}
      {porAutorizar && puedeDecidir ? (
        <View style={{ flexDirection: 'row', gap: space[3], padding: space[4], paddingBottom: Math.max(insets.bottom, space[4]), borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface }}>
          <View style={{ flex: 1 }}><Button label="Rechazar" variant="secundario" onPress={() => abrirDecision('rechazar')} /></View>
          <View style={{ flex: 1.4 }}><Button label={pideRazon(venta.motivoPendienteAutorizacion) ? 'Revisar y autorizar' : 'Autorizar'} onPress={() => abrirDecision('autorizar')} /></View>
        </View>
      ) : null}
      <DecisionSheet
        decision={decision}
        ventaId={id}
        cliente={venta.clienteNombre ?? ''}
        version={venta.version}
        bloqueado={q.isFetching}
        razonObligatoria={pideRazon(venta.motivoPendienteAutorizacion)}
        ofrecerDescuento
        onConflicto={setAviso}
        onClose={() => setDecision(null)}
        onHecho={volver}
      />
    </View>
  )
}
