import React, { useState } from 'react'
import { ProductoIdentidad } from '@/core/ui/fw/ProductoIdentidad'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Button, Field, Notice, PieFijo, StatusChip, TopBar, TotalsRow, chipForEstado, formatImporte, formatPorcentaje } from '@/core/ui/fw'
import { importe as cifras, radii, space, typeScale, useColors } from '@/libs/theme'
import { useAutorizacionPreview, usePendientesAutorizacion, useVenta } from '@/libs/api-client/ventas'
import { useSocio } from '@/libs/api-client/socios'
import { useAuthStore } from '@/libs/store/auth.store'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { formatRelativeTime } from '@/core/utils/fecha'
import { pideRazon, textosDeMotivos } from '../lib/motivos'
import { estimarTotales, leerAjustes } from '../lib/ajustes'
import { ClienteParaAutorizar } from './ClienteParaAutorizar'
import { clienteDeBandeja } from './BandejaAutorizaciones'
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
  // Decidir cambia el estado de la venta y el servidor responde 400 a la vista previa de una venta que ya no espera:
  // mientras la hoja de decisión está abierta, y una vez resuelta, no se pide (la invalidación salta a las consultas apagadas).
  const [decision, setDecision] = useState<Decision | null>(null)
  const [resuelta, setResuelta] = useState(false)
  const preview = useAutorizacionPreview(id, vePreview && porAutorizar && decision === null && !resuelta)
  // Saldo y condición de pago del cliente: es información de apoyo, así que ni la carga ni un error
  // (403, 404, sin red) tocan los botones. `fresco`: para decidir sobre plata no sirve un saldo de hace 5 minutos.
  const socio = useSocio(veClientes ? (venta?.clienteId ?? '') : '', { fresco: true })
  // La dirección y desde cuándo espera no vienen en el detalle de la venta: salen de su fila en la bandeja (misma consulta, en caché).
  const pendientes = usePendientesAutorizacion(puedeAutorizar && porAutorizar)
  const fila = Array.isArray(pendientes.data) ? pendientes.data.find((p) => p.id === id) : undefined
  // La versión cacheada puede tener hasta 60 s: al decidir se vuelve a pedir la venta.
  const [aviso, setAviso] = useState<string | null>(null)
  // Cantidades que escribe quien autoriza por línea (id del detalle); vacío = sin cambio.
  const [cantidades, setCantidades] = useState<Record<string, string>>({})
  const edicion = leerAjustes(q.data?.detalles ?? [], cantidades)
  const totales = q.data ? estimarTotales(q.data.venta, q.data.detalles, edicion) : null
  const puedeEditar = porAutorizar && puedeDecidir
  const abrirDecision = (d: Decision) => { setAviso(null); setDecision(d); void q.refetch() }
  const volver = onVolver ?? (() => router.back())
  const alResolver = () => { setResuelta(true); volver() }
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

  // Con cantidades editadas el total es una estimación (la cuenta definitiva es la del servidor al confirmar).
  const rotuloTotal = totales?.estimado ? 'Total estimado' : 'Total'
  const totalMostrado = totales ? totales.total : venta.totalAmount
  const debajoDelMinimo = preview.data?.items ?? []
  const motivos = textosDeMotivos(venta.motivoPendienteAutorizacion, q.data?.detalleMotivos)
  const chip = chipForEstado('venta', venta.estado)
  const cliente = fila ? clienteDeBandeja(fila) : { titulo: venta.clienteNombre ?? '—', nombre: null }
  const desde = fila?.fechaPendiente ?? (porAutorizar ? venta.fechaModificacion : null)
  const lineaDeApoyo = [cliente.nombre, venta.vendedorNombre, desde ? formatRelativeTime(desde) : null].filter(Boolean).join(' · ')

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {barra}
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4], paddingBottom: space[12] }} keyboardShouldPersistTaps="handled">
        <View style={tarjeta}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
            <Text style={[typeScale.cuerpoDestacado, { color: c.text, flex: 1 }]}>{cliente.titulo}</Text>
            {chip ? <StatusChip estado={chip.estado} label={chip.label} /> : null}
          </View>
          <Text style={secundario}>{lineaDeApoyo}</Text>
          <TotalsRow label={rotuloTotal} importe={totalMostrado} destacado />
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
                <ProductoIdentidad nombre={it.productoNombre} marca={it.marca} codigo={it.codigoPropio} estiloNombre={typeScale.secundario} />
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
                <View style={{ flex: 1 }}><ProductoIdentidad nombre={d.productoNombre} marca={d.marca} codigo={d.codigoPropio} estiloNombre={typeScale.secundario} /></View>
                <Text style={[typeScale.secundario, cifras, { color: c.text }]}>{formatImporte(totales?.subtotalDeLinea[d.id] ?? d.subtotal)}</Text>
              </View>
              <Text style={secundario}>
                {`${d.cantidad} × ${formatImporte(d.precioUnitario)}${d.porcentajeDescuentoItem > 0 ? ` · Desc. ${formatPorcentaje(d.porcentajeDescuentoItem)}` : ''}`}
              </Text>
              {puedeEditar ? (
                <Field
                  label={`Cantidad de ${d.productoNombre}`}
                  help="Podés bajarla o poner 0 para quitar la línea."
                  error={edicion.errores[d.id]}
                  keyboardType="decimal-pad"
                  alignRight
                  placeholder={String(d.cantidad).replace('.', ',')}
                  value={cantidades[d.id] ?? ''}
                  onChangeText={(t) => setCantidades((prev) => ({ ...prev, [d.id]: t }))}
                  maxLength={9}
                />
              ) : null}
            </View>
          ))}
          <TotalsRow label="Subtotal" importe={totales?.subtotalBruto ?? venta.subtotalBrutoAmount} />
          {(totales?.montoDescuento ?? venta.montoDescuentoAmount) > 0 ? <TotalsRow label="Descuento general" importe={-(totales?.montoDescuento ?? venta.montoDescuentoAmount)} /> : null}
          <TotalsRow label="Flete" importe={venta.cargoFleteAmount} />
          <TotalsRow label={rotuloTotal} importe={totalMostrado} destacado />
        </View>
      </ScrollView>
      {/* Barra fija como la lámina: decidir siempre a mano, con el margen en amarillo pide motivo. */}
      {porAutorizar && puedeDecidir ? (
        <PieFijo conInsetInferior>
          <View style={{ flexDirection: 'row', gap: space[3] }}>
          <View style={{ flex: 1 }}><Button label="Rechazar" variant="secundario" onPress={() => abrirDecision('rechazar')} /></View>
          <View style={{ flex: 1.4 }}><Button label={pideRazon(venta.motivoPendienteAutorizacion) ? 'Revisar y autorizar' : 'Autorizar'} onPress={() => abrirDecision('autorizar')} /></View>
          </View>
        </PieFijo>
      ) : null}
      <DecisionSheet
        decision={decision}
        ventaId={id}
        cliente={venta.clienteNombre ?? ''}
        version={venta.version}
        bloqueado={q.isFetching}
        razonObligatoria={pideRazon(venta.motivoPendienteAutorizacion)}
        ofrecerDescuento
        ajustes={edicion.ajustes}
        cambios={edicion.cambios}
        bloqueoDeAjustes={edicion.bloqueo}
        onConflicto={setAviso}
        onClose={() => setDecision(null)}
        onHecho={alResolver}
      />
    </View>
  )
}
