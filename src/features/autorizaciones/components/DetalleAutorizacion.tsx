import React, { useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Button, Notice, StatusChip, TopBar, TotalsRow, chipForEstado, formatImporte } from '@/core/ui/fw'
import { importe as cifras, radii, space, typeScale, useColors } from '@/libs/theme'
import { useAutorizacionPreview, useVenta } from '@/libs/api-client/ventas'
import { useAuthStore } from '@/libs/store/auth.store'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { motivosDe, pideRazon } from '../lib/motivos'
import { DecisionSheet, type Decision } from './DecisionSheet'

/** El servidor manda el estado como número o como nombre según el endpoint. */
const POR_AUTORIZAR = ['9', 'PendienteAutorizacion']

/** "26,7 %"; sin dato, "—" (un margen que no llegó no es 0). */
export function formatPorcentaje(valor: number | null | undefined): string {
  return valor == null || !Number.isFinite(valor) ? '—' : `${valor.toFixed(1).replace('.', ',')} %`
}

interface Props {
  id: string
  /** En tablet cierra el panel; en teléfono, vuelve. */
  onVolver?: () => void
}

/**
 * Detalle para autorizar (láminas AutorizarVenta y TabAutorizaciones). Los números de costo
 * y margen solo con CAP_VER_COSTOS: el servidor igual los manda en null sin el permiso.
 */
export function DetalleAutorizacion({ id, onVolver }: Props) {
  const c = useColors()
  const router = useRouter()
  const veCostos = useAuthStore((s) => s.hasCapability('CAP_VER_COSTOS'))
  // La vista previa la abre Reportes:Read en el servidor; sin ese permiso daría 403.
  const vePreview = useAuthStore((s) => veCostos && s.canDo('MOD_REPORTES', 'read'))
  const puedeAutorizar = useAuthStore((s) => s.hasCapability('CAP_AUTORIZAR_VENTA'))
  const q = useVenta(id)
  const venta = q.data?.venta
  const porAutorizar = POR_AUTORIZAR.includes(String(venta?.estado))
  const preview = useAutorizacionPreview(id, vePreview && porAutorizar)
  const [decision, setDecision] = useState<Decision | null>(null)
  // La versión cacheada puede tener hasta 60 s: al decidir se vuelve a pedir la venta.
  const [aviso, setAviso] = useState<string | null>(null)
  const abrirDecision = (d: Decision) => { setAviso(null); setDecision(d); void q.refetch() }
  const volver = onVolver ?? (() => router.back())
  const secundario = [typeScale.secundario, { color: c.textSecondary }]
  const tarjeta = { padding: space[4], gap: space[2], borderRadius: radii.tarjeta, backgroundColor: c.surface }

  const titulo = venta?.codigoPedido ? `Autorizar ${venta.codigoPedido}` : 'Autorizar venta'
  const barra = <TopBar title={titulo} leading={{ kind: 'atras', onPress: volver }} />

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

  const motivos = motivosDe(venta.motivoPendienteAutorizacion)
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
              <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>Quedó por autorizar porque:</Text>
              {motivos.map((m) => <Text key={m.clave} style={[typeScale.secundario, { color: c.text }]}>{`• ${m.texto}`}</Text>)}
              {venta.motivoVentaSinStock ? <Text style={secundario}>{`Motivo del vendedor: «${venta.motivoVentaSinStock}»`}</Text> : null}
            </View>
            {puedeAutorizar ? (
              <View style={{ flexDirection: 'row', gap: space[3] }}>
                <View style={{ flex: 1 }}><Button label="Rechazar" variant="secundario" onPress={() => abrirDecision('rechazar')} /></View>
                <View style={{ flex: 1 }}><Button label="Autorizar" onPress={() => abrirDecision('autorizar')} /></View>
              </View>
            ) : (
              <Notice tone="info">Para autorizar o rechazar necesitás el permiso de autorizar ventas. Pedíselo a un administrador.</Notice>
            )}
          </>
        )}

        {veCostos ? (
          <View style={tarjeta} testID="bloque-costos">
            <Text style={secundario}>Solo con permiso de ver costos</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={secundario}>Ganancia bruta</Text>
              <Text style={[typeScale.cuerpoDestacado, cifras, { color: c.text }]}>{formatImporte(venta.gananciaBrutaAmount)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={secundario}>Margen de la venta</Text>
              <Text style={[typeScale.cuerpoDestacado, cifras, { color: c.text }]}>{formatPorcentaje(venta.margenBrutoPorcentaje)}</Text>
            </View>
            {(preview.data?.items ?? []).map((it) => (
              <View key={it.detalleId} accessible style={{ gap: space[1], paddingTop: space[2], borderTopWidth: 1, borderTopColor: c.border }}>
                <Text style={[typeScale.secundario, { color: c.text }]}>{it.productoNombre}</Text>
                <Text style={secundario}>{`Precio ${formatImporte(it.precioEfectivo)} · Mínimo ${formatImporte(it.precioMinimoRentable)}`}</Text>
                <Text style={secundario}>{`Aporte ${formatImporte(it.aporteOverhead)} · Sacrificio ${formatImporte(it.sacrificio)}`}</Text>
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
      <DecisionSheet
        decision={decision}
        ventaId={id}
        cliente={venta.clienteNombre ?? ''}
        version={venta.version}
        bloqueado={q.isFetching}
        razonObligatoria={pideRazon(venta.motivoPendienteAutorizacion)}
        onConflicto={setAviso}
        onClose={() => setDecision(null)}
        onHecho={volver}
      />
    </View>
  )
}
