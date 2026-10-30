import React, { useEffect, useState } from 'react'
import { AccessibilityInfo, ActivityIndicator, Image, ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { comprasKeys, useAnularRecepcionCompra, useCompra, useCancelarCompra, useConfirmarCompra, useGuardarComprobanteCompra, useAsignarFotoFacturaCompra } from '@/libs/api-client/compras'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { hasCapability } from '@/features/auth/lib/capabilities'
import type { CompraDto } from '@/libs/api-client'
import { useSocio } from '@/libs/api-client/socios'
import { usePermissions } from '@/core/auth/RequirePermission'
import { BottomSheet, Button, Field, Notice, StatusChip, TopBar, TotalsRow, chipForEstado, formatImporte } from '@/core/ui/fw'
import { PasosDeEstado } from '@/core/ui/fw/PasosDeEstado'
import { importe as cifras, radii, space, typeScale, useColors } from '@/libs/theme'
import { diaArgentina } from '@/src/utils/date'
import { mostrarNumero } from '@/src/utils/numero'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { ddmmaaaa, fechaIso, franjaTexto, hoyTexto } from '@/features/compras/lib/fecha'
import { avisoCompraFaltante, confirmarYRecibir, tomarAviso, type Aviso } from '@/features/compras/lib/confirmar-y-recibir'
import { ConfirmarYRecibirSheet } from '@/features/compras/components/ConfirmarYRecibirSheet'
import { ComprobanteCampos } from '@/features/compras/components/ComprobanteCampos'
import { armarComprobante, formDesdeComprobante, formNuevo, resumenComprobante, seCorrigeEnLaWeb, type ComprobanteCompraInput, type FormComprobante } from '@/features/compras/lib/comprobante'
import { inicioKeys } from '@/core/query/queryClient'
import { numeroDeCompra } from '@/features/compras/lib/numero'
import { esEstadoCompra } from '@/core/constants/estados'
import { FotoDelCobro } from '@/features/cuentas/components/FotoDelCobro'
import { subirComprobanteCobro } from '@/features/cuentas/api/fotos'
import { RecibirCompra } from '@/features/compras/components/RecibirCompra'
import { CONSECUENCIA, accionesDeDetalle, pasosDeCompra } from '@/features/compras/lib/recepcion'

/** Ruta `compras/[id]`: el id viene de la URL. */
export default function CompraDetailScreen() {
  // `aviso`: clave del resultado de confirmar y recibir desde la compra nueva. El texto se toma de
  // memoria (lo dejó esa pantalla); un enlace con la clave sola no muestra nada.
  const { id, aviso } = useLocalSearchParams<{ id: string; aviso?: string }>()
  const [inicial] = useState(() => (id ? tomarAviso(id, aviso) : null))
  return <CompraDetalle id={id ?? ''} aviso={inicial ?? undefined} />
}

/** Una fila rótulo / valor de las tarjetas del detalle. */
function FilaDato({ k, v }: { k: string; v: string }) {
  const c = useColors()
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[3], paddingVertical: space[1] }}>
      <Text style={[typeScale.secundario, { color: c.textSecondary }]}>{k}</Text>
      <Text style={[typeScale.secundario, { color: c.text, flexShrink: 1, textAlign: 'right' }]}>{v}</Text>
    </View>
  )
}

/** "20 Bulto × 12 = 240 u": lo pedido en la unidad de compra y lo que son en unidades. */
function textoDeLinea(d: CompraDto['detalles'][number]): string {
  const ingresada = d.cantidadIngresada > 0 ? d.cantidadIngresada : d.cantidad
  const porUnidad = ingresada > 0 ? d.cantidad / ingresada : 1
  if (String(d.unidadCompra) === 'Unidad' || porUnidad === 1) return `${mostrarNumero(d.cantidad)} u`
  const nombre = String(d.unidadCompra) === 'BultoMadre' ? 'bultos madre' : 'bultos'
  return `${mostrarNumero(ingresada)} ${nombre} × ${mostrarNumero(porUnidad)} = ${mostrarNumero(d.cantidad)} u`
}

type Hoja = 'cancelar' | 'anularRecepcion' | 'confirmarYRecibir' | 'comprobante' | null

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
  const cancelar = useCancelarCompra()
  const anularRecepcion = useAnularRecepcionCompra()
  const permisos = useAuthStore((s) => s.user?.permissions)
  const [hoja, setHoja] = useState<Hoja>(null)
  const [error, setError] = useState<string | null>(null)
  const [fechaFactura, setFechaFactura] = useState(hoyTexto)
  // La recepción (lienzo M11) es una pantalla propia dentro del detalle.
  const [recibiendoMercaderia, setRecibiendoMercaderia] = useState(false)
  const [motivo, setMotivo] = useState('')
  // La versión que el usuario estaba mirando al abrir la hoja: si cambió después, el servidor da 409.
  const [versionVista, setVersionVista] = useState(0)
  const [aviso, setAviso] = useState<Aviso | null>(avisoInicial ?? null)
  const [recibiendo, setRecibiendo] = useState(false)
  // El comprobante del proveedor que se está cargando (al recibir o después); null: no se carga.
  const [comprobante, setComprobante] = useState<FormComprobante | null>(null)
  const guardarComprobante = useGuardarComprobanteCompra()
  const asignarFoto = useAsignarFotoFacturaCompra()
  const [errorFoto, setErrorFoto] = useState<string | null>(null)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  // El CUIT del proveedor: va en la tarjeta del proveedor y precarga el comprobante.
  const socio = useSocio(q.data?.proveedorId ?? '')
  useEffect(() => {
    if (comprobante && !comprobante.cuit && socio.data?.cuit) setComprobante({ ...comprobante, cuit: socio.data.cuit })
  }, [comprobante, socio.data])
  const queryClient = useQueryClient()
  useEffect(() => { if (aviso) AccessibilityInfo.announceForAccessibility(aviso.texto) }, [aviso])
  const volver = onVolver ?? (() => router.back())
  const secundario = [typeScale.secundario, { color: c.textSecondary }]

  const compra: CompraDto | undefined = q.data
  if (!compra) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar title="Compra" leading={{ kind: 'atras', onPress: volver }} />
        <View style={{ padding: space[4], gap: space[3] }}>
          {aviso ? <Notice tone={aviso.tono}>{aviso.texto}</Notice> : null}
          {q.isError ? <Notice tone="peligro">{mensajeDelServidor(q.error, 'No se pudo cargar la compra.')}</Notice> : <ActivityIndicator color={c.brand} />}
        </View>
      </View>
    )
  }

  // Recibir mercadería (M11): pantalla propia; al volver o al terminar se vuelve al detalle.
  if (recibiendoMercaderia) {
    return (
      <RecibirCompra
        compra={compra}
        onVolver={() => setRecibiendoMercaderia(false)}
        onHecho={(faltante) => { setRecibiendoMercaderia(false); setAviso(faltante ? avisoCompraFaltante(faltante) : null); queryClient.invalidateQueries({ queryKey: inicioKeys.all }) }}
        onConflicto={() => { void q.refetch() }}
      />
    )
  }

  const estado = String(compra.estado)
  const pideFactura = compra.condicionPago?.tipo === 'DiasDesdeFactura'
  const ocupado = recibiendo || guardarComprobante.isPending || asignarFoto.isPending || subiendoFoto || confirmar.isPending || cancelar.isPending || anularRecepcion.isPending
  // Mismos permisos que la web y el servidor: MOD_COMPRAS modificar / borrar y CAP_ANULAR_RECEPCION_COMPRAS.
  const puedeEditar = canDo('MOD_COMPRAS', 'update')
  const acciones = accionesDeDetalle({
    estado, eliminada: !!compra.eliminada, cantidadLineas: compra.detalles.length,
    puedeModificar: puedeEditar, puedeBorrar: canDo('MOD_COMPRAS', 'delete'),
    tieneCapAnular: hasCapability(permisos, 'CAP_ANULAR_RECEPCION_COMPRAS'),
  })
  const pasos = pasosDeCompra(estado)
  const franja = franjaTexto(compra.franjaEntregaProveedor)
  const hayBarra = acciones.confirmar || acciones.recibir || acciones.editar || acciones.cancelar

  // Cada hoja arranca limpia: ni el motivo ni el error de otra quedan a la vista.
  const abrirHoja = (h: Hoja) => { setError(null); setAviso(null); setMotivo(''); if (h === 'anularRecepcion' || h === 'confirmarYRecibir') setVersionVista(compra.version); if (h === 'confirmarYRecibir') setFechaFactura(hoyTexto()); setComprobante(h === 'comprobante' ? formComprobante() : null); setHoja(h) }
  const formComprobante = () => (compra.comprobante
    ? formDesdeComprobante(compra.comprobante)
    : formNuevo(socio.data ?? { razonSocial: compra.razonSocialProveedor }, hoyTexto()))
  // Arma el comprobante cargado (o deja a la vista qué falta) y recién ahí llama al servidor.
  const conComprobante = (accion: (c?: ComprobanteCompraInput) => Promise<unknown>, titulo: string) => {
    if (!comprobante) return void correr(() => accion(), titulo)
    const armado = armarComprobante(comprobante)
    if ('error' in armado) return void setError(armado.error)
    return void correr(() => accion(armado.comprobante), titulo)
  }
  // Foto de la factura del proveedor (R22b): la ve quien ve la compra; cambiarla, quien puede modificar (y la compra no está cancelada).
  const puedeCambiarFoto = puedeEditar && !compra.eliminada
  const guardarFoto = async (fotoUrl: string | null) => {
    setErrorFoto(null)
    try { await asignarFoto.mutateAsync({ id: compra.id, fotoUrl }) } catch (e) { setErrorFoto(`No se guardó la foto: ${mensajeDelServidor(e)}`) }
  }
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
        setAviso(r.aviso)
        queryClient.invalidateQueries({ queryKey: comprasKeys.all })
        queryClient.invalidateQueries({ queryKey: inicioKeys.all })
        return
      }
      setError(r.mensaje)
      if (r.recargar) {
        try {
          const n = await q.refetch()
          if (n.data) setVersionVista(n.data.version)
          // Ya no es nota de pedido: la hoja no sirve más; el motivo queda en la pantalla.
          if (n.data && !esEstadoCompra(String(n.data.estado), 'NotaPedido')) setHoja(null)
        } catch { /* queda el error del servidor */ }
      }
    } finally {
      setRecibiendo(false)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar
        title={`Compra #${numeroDeCompra(compra)}`}
        subtitle={ddmmaaaa(diaArgentina(Date.parse(compra.fecha)))}
        leading={{ kind: 'atras', onPress: volver }}
      />
      {pasos ? <PasosDeEstado pasos={pasos} accessibilityLabel="Estado de la compra" /> : null}
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[3], paddingBottom: space[12] * 2 }}>
        <View style={{ gap: space[1], padding: space[4], borderRadius: radii.tarjeta, backgroundColor: c.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[2] }}>
            <Text accessibilityRole="header" style={[typeScale.cuerpoDestacado, { color: c.text, flexShrink: 1 }]}>{compra.razonSocialProveedor}</Text>
            {(() => { const chip = chipForEstado('compra', compra.estado); return chip ? <StatusChip estado={chip.estado} label={chip.label} /> : null })()}
          </View>
          {socio.data?.cuit ? <Text style={[secundario, cifras]}>{`CUIT ${socio.data.cuit}`}</Text> : null}
        </View>
        {aviso ? <Notice tone={aviso.tono}>{aviso.texto}</Notice> : null}
        {esEstadoCompra(estado, 'Confirmado') && !compra.eliminada ? <Notice tone="info">Ya cuenta como stock por ingresar. Cuando llegue, marcala recibida.</Notice> : null}
        {error && hoja === null ? <Notice tone="peligro">{error}</Notice> : null}
        {compra.motivoCancelacion ? <Notice tone="info" title="Cancelada.">{compra.motivoCancelacion}</Notice> : null}
        {compra.motivoAnulacion ? <Notice tone="info" title="Recepción anulada.">{compra.motivoAnulacion}</Notice> : null}
        <View style={{ gap: space[1], padding: space[4], borderRadius: radii.tarjeta, backgroundColor: c.surface }}>
          <Text accessibilityRole="header" style={[typeScale.cuerpoDestacado, { color: c.text }]}>Recepción</Text>
          <FilaDato k="Depósito" v={compra.nombreDeposito} />
          {franja ? <FilaDato k="Entrega esperada" v={franja} /> : null}
          {compra.condicionPago?.descripcion ? <FilaDato k="Plazo de pago" v={compra.condicionPago.descripcion} /> : null}
          <FilaDato k="Con factura" v={compra.conFactura ? 'Sí' : 'No'} />
        </View>
        <View style={{ borderRadius: radii.tarjeta, backgroundColor: c.surface, overflow: 'hidden' }}>
          <Text accessibilityRole="header" style={[typeScale.cuerpoDestacado, { color: c.text, paddingHorizontal: space[4], paddingTop: space[3] }]}>
            {`Productos · ${compra.detalles.length}`}
          </Text>
          {compra.detalles.map((d, i) => (
            <View key={d.id} accessible style={{ paddingHorizontal: space[4], paddingVertical: space[3], gap: space[1], borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
              <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>{d.nombreProducto}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
                <View style={{ flexShrink: 1 }}>
                  <Text style={[typeScale.secundario, { color: c.text }]}>{textoDeLinea(d)}</Text>
                  <Text style={[typeScale.secundario, cifras, { color: c.textSecondary }]}>{`${formatImporte(d.costoUnitarioBaseAmount)} por unidad`}</Text>
                </View>
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
        {compra.descuentoPorcentaje ? <Text style={secundario}>{`Descuento general: ${mostrarNumero(compra.descuentoPorcentaje)} %`}</Text> : null}
        {compra.fechaVencimientoPago ? <Text style={secundario}>{`Vence el ${ddmmaaaa(compra.fechaVencimientoPago)}`}</Text> : null}
        {compra.comprobante ? (
          <Text style={secundario}>{resumenComprobante(compra.comprobante)}</Text>
        ) : null}
        {esEstadoCompra(estado, 'Entregado') && puedeEditar ? (
          compra.comprobante && seCorrigeEnLaWeb(compra.comprobante)
            ? <Text style={secundario}>Tiene varias alícuotas: se corrige en la web.</Text>
            : <Button label={compra.comprobante ? 'Corregir el comprobante' : 'Cargar el comprobante'} variant="secundario" disabled={ocupado} onPress={() => abrirHoja('comprobante')} />
        ) : null}
        {compra.compraOrigenId ? (
          <Button label={`Salió de la compra ${numeroDeCompra({ id: compra.compraOrigenId, numero: compra.compraOrigenNumero })}`} variant="secundario"
            onPress={() => router.push(`/(tabs)/compras/${compra.compraOrigenId}` as never)} />
        ) : null}
        {compra.compraFaltanteId ? (
          <Button label={`Lo que faltó pasó a la compra ${numeroDeCompra({ id: compra.compraFaltanteId, numero: compra.compraFaltanteNumero })}`} variant="secundario"
            onPress={() => router.push(`/(tabs)/compras/${compra.compraFaltanteId}` as never)} />
        ) : null}
        {compra.fotoFacturaProveedorUrl || puedeCambiarFoto ? (
          <View style={{ gap: space[2], padding: space[4], borderRadius: radii.tarjeta, backgroundColor: c.surface }}>
            <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>Factura del proveedor</Text>
            {compra.fotoFacturaProveedorUrl ? (
              <Image source={{ uri: compra.fotoFacturaProveedorUrl }} accessibilityLabel="Foto de la factura del proveedor"
                style={{ width: '100%', height: 220, borderRadius: radii.campo, backgroundColor: c.border }} resizeMode="contain" />
            ) : null}
            {puedeCambiarFoto ? (
              <>
                <FotoDelCobro que="de la factura" url={compra.fotoFacturaProveedorUrl ?? null} subir={subirComprobanteCobro}
                  onUrl={(u) => { void guardarFoto(u) }} onSubiendo={setSubiendoFoto} />
                {compra.fotoFacturaProveedorUrl ? (
                  <Button label="Quitar la foto de la factura" variant="secundario" disabled={ocupado} onPress={() => { void guardarFoto(null) }} />
                ) : null}
              </>
            ) : null}
            {errorFoto ? <Notice tone="peligro">{errorFoto}</Notice> : null}
          </View>
        ) : null}
      </ScrollView>
      {hayBarra ? (
        <View style={{ gap: space[2], padding: space[4], backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border }}>
          {acciones.recibir ? <Button label="Recibir mercadería" disabled={ocupado} onPress={() => { setError(null); setAviso(null); setRecibiendoMercaderia(true) }} /> : null}
          {acciones.confirmar ? (
            <Button label="Confirmar compra" loading={confirmar.isPending} disabled={ocupado} onPress={() => { void correr(() => confirmar.mutateAsync(compra.id), 'No se confirmó la compra') }} />
          ) : null}
          {acciones.confirmar ? <Button label="Confirmar y recibir" variant="secundario" disabled={ocupado} onPress={() => abrirHoja('confirmarYRecibir')} /> : null}
          {acciones.editar || acciones.cancelar ? (
            <View style={{ flexDirection: 'row', gap: space[2] }}>
              {acciones.editar ? <View style={{ flex: 1 }}><Button label="Editar la compra" variant="secundario" disabled={ocupado} onPress={() => router.push(`/(tabs)/compras/nueva?edit=${compra.id}` as never)} /></View> : null}
              {acciones.cancelar ? <View style={{ flex: 1 }}><Button label="Cancelar compra" variant="secundario" disabled={ocupado} onPress={() => abrirHoja('cancelar')} /></View> : null}
            </View>
          ) : null}
        </View>
      ) : acciones.anularRecepcion ? (
        <View style={{ padding: space[4], backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border }}>
          <Button label="Anular recepción" variant="secundario" disabled={ocupado} onPress={() => abrirHoja('anularRecepcion')} />
        </View>
      ) : null}
      <BottomSheet visible={hoja === 'anularRecepcion'} onClose={cerrarHoja} accessibilityLabel="Anular la recepción">
        <Text style={[typeScale.titulo, { color: c.text }]}>Anular la recepción</Text>
        <Text style={secundario}>{CONSECUENCIA.anularRecepcion}</Text>
        <Field label="Motivo" value={motivo} onChangeText={setMotivo} placeholder="Por qué se anula" />
        {error ? <Notice tone="peligro">{error}</Notice> : null}
        <Button label="Anular recepción" variant="peligro" loading={anularRecepcion.isPending} disabled={!motivo.trim()}
          onPress={() => { void correr(() => anularRecepcion.mutateAsync({ id: compra.id, motivo: motivo.trim(), version: versionVista }), 'No se anuló la recepción') }} />
      </BottomSheet>
      <BottomSheet visible={hoja === 'comprobante'} onClose={cerrarHoja} accessibilityLabel="Comprobante del proveedor">
        <Text style={[typeScale.titulo, { color: c.text }]}>Comprobante del proveedor</Text>
        <Text style={secundario}>Como figura en el papel. Las percepciones y varias alícuotas se cargan en la web.</Text>
        {comprobante ? (
          <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
            <ComprobanteCampos form={comprobante} onCambio={setComprobante} />
          </ScrollView>
        ) : null}
        {error ? <Notice tone="peligro">{error}</Notice> : null}
        <Button label="Guardar comprobante" loading={guardarComprobante.isPending}
          onPress={() => conComprobante((c) => guardarComprobante.mutateAsync({ id: compra.id, comprobante: c! }), 'No se guardó el comprobante')} />
      </BottomSheet>
      <ConfirmarYRecibirSheet visible={hoja === 'confirmarYRecibir'} onClose={cerrarHoja} pideFactura={pideFactura}
        ocupado={recibiendo} fecha={fechaFactura} onFecha={setFechaFactura} error={hoja === 'confirmarYRecibir' ? error : null} onConfirmar={(f) => { void confirmarYRecibirAhora(f) }} />
      <BottomSheet visible={hoja === 'cancelar'} onClose={cerrarHoja} accessibilityLabel="Cancelar la compra">
        <Text style={[typeScale.titulo, { color: c.text }]}>Cancelar la compra</Text>
        <Text style={secundario}>{esEstadoCompra(estado, 'Confirmado') ? CONSECUENCIA.cancelarConfirmada : CONSECUENCIA.cancelarNotaPedido}</Text>
        <Field label="Motivo" value={motivo} onChangeText={setMotivo} placeholder="Por qué se cancela" />
        {error ? <Notice tone="peligro">{error}</Notice> : null}
        <Button label="Cancelar compra" variant="peligro" loading={cancelar.isPending} disabled={!motivo.trim()}
          onPress={() => { void correr(() => cancelar.mutateAsync({ id: compra.id, motivo: motivo.trim() }), 'No se canceló la compra') }} />
      </BottomSheet>
    </View>
  )
}
