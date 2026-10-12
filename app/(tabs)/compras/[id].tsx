import React, { useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { comprasKeys, useAnularRecepcionCompra, useCompra, useCancelarCompra, useConfirmarCompra, useRecibirCompra } from '@/libs/api-client/compras'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { hasCapability } from '@/features/auth/lib/capabilities'
import type { CompraDto } from '@/libs/api-client'
import { usePermissions } from '@/core/auth/RequirePermission'
import { BottomSheet, Button, Field, Notice, StatusChip, TopBar, TotalsRow, chipForEstado, formatImporte } from '@/core/ui/fw'
import { importe as cifras, radii, space, typeScale, useColors } from '@/libs/theme'
import { diaArgentina } from '@/src/utils/date'
import { mostrarNumero } from '@/src/utils/numero'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { ddmmaaaa, fechaIso, hoyTexto } from '@/features/compras/lib/fecha'
import { confirmarYRecibir } from '@/features/compras/lib/confirmar-y-recibir'
import { ConfirmarYRecibirSheet } from '@/features/compras/components/ConfirmarYRecibirSheet'
import { inicioKeys } from '@/core/query/queryClient'

/** Ruta `compras/[id]`: el id viene de la URL. */
export default function CompraDetailScreen() {
  // `aviso` y `tono`: lo que dijo el servidor al confirmar y recibir desde la compra nueva.
  const { id, aviso, tono } = useLocalSearchParams<{ id: string; aviso?: string; tono?: string }>()
  return <CompraDetalle id={id ?? ''} aviso={aviso ? { texto: aviso, tono: tono === 'advertencia' ? 'advertencia' : 'exito' } : undefined} />
}

type Hoja = 'recibir' | 'cancelar' | 'anularRecepcion' | 'confirmarYRecibir' | null
type Aviso = { texto: string; tono: 'exito' | 'advertencia' }

/**
 * Detalle de una compra con el formato nuevo (Bloque 9A, PR 3.5). Los botones dependen del estado
 * y del permiso: nota de pedido → confirmar; confirmada → recibir (con fecha de factura si la
 * condición de pago es por días desde la factura); en las dos, editar y cancelar con motivo;
 * recibida → anular la recepción con motivo, solo con el permiso del servidor (PR 3.6).
 * Embebible en el panel derecho de la lista en tablet horizontal (`onVolver` cierra el panel).
 */
export function CompraDetalle({ id, onVolver, aviso: avisoInicial }: { id: string; onVolver?: () => void; aviso?: Aviso }) {
  const c = useColors()
  const router = useRouter()
  const { canDo } = usePermissions()
  const q = useCompra(id)
  const confirmar = useConfirmarCompra()
  const recibir = useRecibirCompra()
  const cancelar = useCancelarCompra()
  const anularRecepcion = useAnularRecepcionCompra()
  const permisos = useAuthStore((s) => s.user?.permissions)
  const [hoja, setHoja] = useState<Hoja>(null)
  const [error, setError] = useState<string | null>(null)
  const [fechaFactura, setFechaFactura] = useState(hoyTexto)
  const [motivo, setMotivo] = useState('')
  // La versión que el usuario estaba mirando al abrir la hoja: si cambió después, el servidor da 409.
  const [versionVista, setVersionVista] = useState(0)
  const [aviso, setAviso] = useState<Aviso | null>(avisoInicial ?? null)
  const [recibiendo, setRecibiendo] = useState(false)
  const queryClient = useQueryClient()
  const volver = onVolver ?? (() => router.back())
  const secundario = [typeScale.secundario, { color: c.textSecondary }]

  const compra: CompraDto | undefined = q.data
  if (!compra) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar title="Compra" leading={{ kind: 'atras', onPress: volver }} />
        <View style={{ padding: space[4] }}>
          {q.isError ? <Notice tone="peligro">{mensajeDelServidor(q.error, 'No se pudo cargar la compra.')}</Notice> : <ActivityIndicator color={c.brand} />}
        </View>
      </View>
    )
  }

  const estado = String(compra.estado)
  const abierta = estado === 'NotaPedido' || estado === 'Confirmado'
  const pideFactura = compra.condicionPago?.tipo === 'DiasDesdeFactura'
  const fechaLeida = fechaIso(fechaFactura)
  const ocupado = recibiendo || confirmar.isPending || recibir.isPending || cancelar.isPending || anularRecepcion.isPending
  // Mismo permiso que el servidor: MOD_COMPRAS:Delete y CAP_ANULAR_RECEPCION_COMPRAS.
  const puedeAnularRecepcion = estado === 'Entregado' && canDo('MOD_COMPRAS', 'delete') && hasCapability(permisos, 'CAP_ANULAR_RECEPCION_COMPRAS')
  const puedeEditar = canDo('MOD_COMPRAS', 'update')

  // Cada hoja arranca limpia: ni el motivo ni el error de otra quedan a la vista.
  const abrirHoja = (h: Hoja) => { setError(null); setAviso(null); setMotivo(''); if (h === 'anularRecepcion' || h === 'confirmarYRecibir') setVersionVista(compra.version); setHoja(h) }
  const cerrarHoja = () => { setError(null); setMotivo(''); setHoja(null) }

  const correr = async (accion: () => Promise<unknown>, titulo: string) => {
    setError(null)
    try {
      await accion()
      cerrarHoja()
    } catch (e) {
      setError(`${titulo}: ${mensajeDelServidor(e)}`)
      // Otro cambió la compra: se trae la versión vigente para que el próximo intento no repita el conflicto.
      if ((e as { status?: number })?.status === 409) {
        try { const r = await q.refetch(); if (r.data) setVersionVista(r.data.version) } catch { /* queda el error del servidor */ }
      }
    }
  }

  // Una sola llamada; con la versión que se estaba mirando. "Hecho" incluye el caso dudoso (red): se avisa y se recarga.
  const confirmarYRecibirAhora = async (fechaFacturaProveedor?: string) => {
    setError(null)
    setRecibiendo(true)
    try {
      const r = await confirmarYRecibir(compra.id, { version: versionVista, fechaFacturaProveedor })
      if (r.tipo === 'hecho') {
        cerrarHoja()
        setAviso({ texto: r.aviso, tono: r.tono })
        queryClient.invalidateQueries({ queryKey: comprasKeys.all })
        queryClient.invalidateQueries({ queryKey: inicioKeys.all })
        return
      }
      setError(r.mensaje)
      if (r.recargar) {
        try { const n = await q.refetch(); if (n.data) setVersionVista(n.data.version) } catch { /* queda el error del servidor */ }
      }
    } finally {
      setRecibiendo(false)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar
        title={compra.razonSocialProveedor}
        subtitle={`${compra.id.slice(0, 8).toUpperCase()} · ${ddmmaaaa(diaArgentina(Date.parse(compra.fecha)))}`}
        leading={{ kind: 'atras', onPress: volver }}
      />
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[3], paddingBottom: space[12] * 2 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={secundario}>{`${compra.nombreDeposito} · ${compra.detalles.length} ${compra.detalles.length === 1 ? 'producto' : 'productos'}`}</Text>
          {(() => { const chip = chipForEstado('compra', compra.estado); return chip ? <StatusChip estado={chip.estado} label={chip.label} /> : null })()}
        </View>
        {aviso ? <Notice tone={aviso.tono}>{aviso.texto}</Notice> : null}
        {error && hoja === null ? <Notice tone="peligro">{error}</Notice> : null}
        {compra.motivoCancelacion ? <Notice tone="info" title="Cancelada.">{compra.motivoCancelacion}</Notice> : null}
        {compra.motivoAnulacion ? <Notice tone="info" title="Recepción anulada.">{compra.motivoAnulacion}</Notice> : null}
        <View style={{ borderRadius: radii.tarjeta, backgroundColor: c.surface, overflow: 'hidden' }}>
          {compra.detalles.map((d, i) => (
            <View key={d.id} accessible style={{ paddingHorizontal: space[4], paddingVertical: space[3], gap: space[1], borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
              <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>{d.nombreProducto}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
                <Text style={[typeScale.secundario, { color: c.text, flexShrink: 1 }]}>{`${mostrarNumero(d.cantidad)} × ${mostrarNumero(d.costoUnitarioBaseAmount)}`}</Text>
                <Text style={[typeScale.cuerpoDestacado, cifras, { color: c.text }]}>{formatImporte(d.subtotalAmount)}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={{ gap: space[1], padding: space[4], borderRadius: radii.tarjeta, backgroundColor: c.surface }}>
          <TotalsRow label="Subtotal" importe={compra.subtotalBrutoAmount - compra.descuentoTotalAmount} />
          <TotalsRow label="Gastos operativos" importe={compra.gastosOperativos} />
          <TotalsRow label="Total" importe={compra.totalAmount} destacado />
        </View>
        {compra.condicionPago?.descripcion ? <Text style={secundario}>{`Condición de pago: ${compra.condicionPago.descripcion}`}</Text> : null}
        {compra.fechaVencimientoPago ? <Text style={secundario}>{`Vence el ${ddmmaaaa(compra.fechaVencimientoPago)}`}</Text> : null}
      </ScrollView>
      {abierta ? (
        <View style={{ gap: space[2], padding: space[4], backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border }}>
          {puedeEditar && estado === 'NotaPedido'
            ? <Button label="Confirmar y recibir" variant="secundario" disabled={ocupado} onPress={() => abrirHoja('confirmarYRecibir')} /> : null}
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            {canDo('MOD_COMPRAS', 'delete') ? <Button label="Cancelar compra" variant="secundario" disabled={ocupado} onPress={() => abrirHoja('cancelar')} /> : null}
            {puedeEditar ? (
              <View style={{ flex: 1 }}>
                {estado === 'NotaPedido'
                  ? <Button label="Confirmar compra" loading={confirmar.isPending} disabled={ocupado} onPress={() => { void correr(() => confirmar.mutateAsync(compra.id), 'No se confirmó la compra') }} />
                  : <Button label="Recibir" disabled={ocupado} onPress={() => abrirHoja('recibir')} />}
              </View>
            ) : null}
          </View>
        </View>
      ) : puedeAnularRecepcion ? (
        <View style={{ padding: space[4], backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border }}>
          <Button label="Anular recepción" variant="secundario" disabled={ocupado} onPress={() => abrirHoja('anularRecepcion')} />
        </View>
      ) : null}
      <BottomSheet visible={hoja === 'anularRecepcion'} onClose={cerrarHoja} accessibilityLabel="Anular la recepción">
        <Text style={[typeScale.titulo, { color: c.text }]}>Anular la recepción</Text>
        <Text style={secundario}>Descuenta del stock lo que ingresó y revierte la deuda con el proveedor. No se puede deshacer.</Text>
        <Field label="Motivo" value={motivo} onChangeText={setMotivo} placeholder="Por qué se anula" />
        {error ? <Notice tone="peligro">{error}</Notice> : null}
        <Button label="Anular recepción" variant="peligro" loading={anularRecepcion.isPending} disabled={!motivo.trim()}
          onPress={() => { void correr(() => anularRecepcion.mutateAsync({ id: compra.id, motivo: motivo.trim(), version: versionVista }), 'No se anuló la recepción') }} />
      </BottomSheet>
      <BottomSheet visible={hoja === 'recibir'} onClose={cerrarHoja} accessibilityLabel="Recibir la compra">
        <Text style={[typeScale.titulo, { color: c.text }]}>Recibir la mercadería</Text>
        <Text style={secundario}>Ingresa el stock real y genera la deuda con el proveedor.</Text>
        {pideFactura ? (
          <Field label="Fecha de la factura" placeholder="dd/mm/aaaa" value={fechaFactura} onChangeText={setFechaFactura} keyboardType="numbers-and-punctuation"
            help="La condición de pago se cuenta desde la factura." error={fechaLeida ? undefined : 'Escribí la fecha como dd/mm/aaaa.'} />
        ) : null}
        {error ? <Notice tone="peligro">{error}</Notice> : null}
        <Button label="Recibir" loading={recibir.isPending} disabled={pideFactura && !fechaLeida}
          onPress={() => { void correr(() => recibir.mutateAsync({ id: compra.id, fechaFacturaProveedor: pideFactura ? fechaLeida! : undefined }), 'No se recibió la compra') }} />
      </BottomSheet>
      <ConfirmarYRecibirSheet visible={hoja === 'confirmarYRecibir'} onClose={cerrarHoja} pideFactura={pideFactura}
        ocupado={recibiendo} error={hoja === 'confirmarYRecibir' ? error : null} onConfirmar={(f) => { void confirmarYRecibirAhora(f) }} />
      <BottomSheet visible={hoja === 'cancelar'} onClose={cerrarHoja} accessibilityLabel="Cancelar la compra">
        <Text style={[typeScale.titulo, { color: c.text }]}>Cancelar la compra</Text>
        <Text style={secundario}>No se recibió: si estaba confirmada, se libera el stock que se esperaba.</Text>
        <Field label="Motivo" value={motivo} onChangeText={setMotivo} placeholder="Por qué se cancela" />
        {error ? <Notice tone="peligro">{error}</Notice> : null}
        <Button label="Cancelar compra" variant="peligro" loading={cancelar.isPending} disabled={!motivo.trim()}
          onPress={() => { void correr(() => cancelar.mutateAsync({ id: compra.id, motivo: motivo.trim() }), 'No se canceló la compra') }} />
      </BottomSheet>
    </View>
  )
}
