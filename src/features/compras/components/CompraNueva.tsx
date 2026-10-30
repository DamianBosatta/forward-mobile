import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Trash2 } from 'lucide-react-native'
import { Button, Field, Notice, PasosNumerados, TopBar, TotalsRow, formatImporte } from '@/core/ui/fw'
import { importe as cifras, radii, space, typeScale, useColors } from '@/libs/theme'
import { useDepositos, useInfiniteProductos } from '@/libs/api-client'
import { leerNumero, mostrarNumero } from '@/src/utils/numero'
import { mensajeDelServidor } from '../lib/mensaje-error'
import { sinCosto, subtotalDe, textoDeLinea, totalCompra, unidadesDe, type LineaCompra } from '../lib/lineaCompra'
import { useCompraBorrador, type EstadoGuardado } from '../hooks/useCompraBorrador'
import { ElegirProveedor, PASOS_COMPRA } from './ElegirProveedor'
import { CatalogModal } from './CatalogModal'
import { CompraLineaSheet } from './CompraLineaSheet'
import { ConfirmarYRecibirSheet } from './ConfirmarYRecibirSheet'
import { usePermissions } from '@/core/auth/RequirePermission'
import { dejarAviso } from '../lib/confirmar-y-recibir'
import { hoyTexto } from '../lib/fecha'

const SYNC: Record<EstadoGuardado, string | undefined> = {
  nuevo: undefined, guardando: 'Guardando…', guardado: 'Guardado', error: 'Sin guardar', conflicto: 'Sin guardar',
}
const UNIDAD = { Unidad: 'Unidades', Bulto: 'Bultos', BultoMadre: 'Bultos madre' }

function detalleLinea(l: LineaCompra): string {
  const costo = sinCosto(l) ? '—' : mostrarNumero(l.costoUnitario!)
  const empaque = l.unidad === 'Unidad' ? UNIDAD.Unidad : `${l.cantidad} ${UNIDAD[l.unidad].toLowerCase()} de ${l.unidadesPorUnidad}`
  return `${unidadesDe(l)} × ${costo} · ${sinCosto(l) ? 'Falta el costo' : empaque}`
}

interface Props {
  /** Borrador a retomar (desde la pestaña Borradores). */
  borradorId?: string
  /** Compra ya guardada (nota de pedido o confirmada) a editar: no autoguarda, un solo "Guardar cambios". */
  editarId?: string
  /** Proveedor ya elegido (viene de su ficha): se crea el borrador con él sin pasar por la lista. */
  proveedorId?: string
}

/**
 * Compra nueva con el formato nuevo (láminas Compra y TabCompra), como borrador con autoguardado.
 * Con `editarId` edita una compra ya guardada con el mismo formulario, sin autoguardado.
 */
export function CompraNueva({ borradorId, editarId, proveedorId }: Props) {
  const c = useColors()
  const router = useRouter()
  const edicion = !!editarId
  const b = useCompraBorrador(editarId ?? borradorId, { edicion })
  // 2 = productos, 3 = revisar. El paso 1 (proveedor) es mientras no haya proveedor.
  const [paso, setPaso] = useState<2 | 3>(2)
  const [catalogo, setCatalogo] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [enviada, setEnviada] = useState('')
  const [gastosTexto, setGastosTexto] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [editando, setEditando] = useState<LineaCompra | null>(null)
  const [recibir, setRecibir] = useState<{ error: string | null } | null>(null)
  const [fechaFactura, setFechaFactura] = useState(hoyTexto)
  const guardando = useRef(false)
  const preseleccionado = useRef(false)
  const puedeRecibir = usePermissions().canDo('MOD_COMPRAS', 'update')
  useEffect(() => {
    if (!proveedorId || borradorId || editarId || preseleccionado.current) return
    preseleccionado.current = true
    void b.elegirProveedor(proveedorId)
  }, [proveedorId, borradorId, editarId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setTimeout(() => setEnviada(busqueda.trim()), 300)
    return () => clearTimeout(t)
  }, [busqueda])
  useEffect(() => { setGastosTexto(b.gastos ? mostrarNumero(b.gastos) : '') }, [b.compraId, b.cargando]) // eslint-disable-line react-hooks/exhaustive-deps
  // Lo comprable: comunes y fragancias (variantes), sin la línea, que el servidor no deja comprar.
  const productos = useInfiniteProductos({ pageSize: 30, search: enviada, soloComprables: true })
  const { data: depositos } = useDepositos()

  const volver = () => {
    if (!(edicion && b.hayCambios)) return router.back()
    Alert.alert('Salir sin guardar', 'Hay cambios sin guardar. Si salís, se pierden.', [
      { text: 'Seguir editando', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => router.back() },
    ])
  }
  const secundario = [typeScale.secundario, { color: c.textSecondary }]

  if (b.cargando) return <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center' }}><ActivityIndicator color={c.brand} /></View>
  if (edicion && b.noEditable) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar title="Editar compra" leading={{ kind: 'atras', onPress: volver }} />
        <View style={{ padding: space[4], gap: space[3] }}>
          <Notice tone="peligro" title="No se puede editar.">{b.error ?? 'La compra ya no está en un estado que admita cambios.'}</Notice>
          <Button label="Volver al detalle" variant="secundario" onPress={() => router.replace(`/(tabs)/compras/${editarId}` as never)} />
        </View>
      </View>
    )
  }
  if (!b.proveedor) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar title={edicion ? 'Editar compra' : 'Nueva compra'} subtitle={edicion ? undefined : 'Paso 1 de 3'} leading={{ kind: 'atras', onPress: volver }} />
        {b.error && (borradorId || editarId) ? <View style={{ padding: space[4] }}><Notice tone="peligro">{b.error}</Notice></View>
          : <ElegirProveedor onElegir={(id) => { void b.elegirProveedor(id) }} faltantes={b.faltantes} error={b.error} />}
      </View>
    )
  }

  const faltanCostos = b.lineas.filter(sinCosto).length
  const total = totalCompra(b.lineas, b.descuentoPorcentaje, b.gastos)
  const gastosLeidos = gastosTexto.trim() === '' ? 0 : leerNumero(gastosTexto)

  const terminar = async (accion: () => Promise<void>, titulo: string) => {
    setOcupado(true)
    try {
      await accion()
      router.replace(`/(tabs)/compras/${b.compraId}` as never)
    } catch (e) {
      Alert.alert(titulo, mensajeDelServidor(e))
    } finally {
      setOcupado(false)
    }
  }
  const confirmarYRecibir = async (fecha?: string) => {
    setOcupado(true)
    try {
      const r = await b.confirmarYRecibir(fecha)
      if (r.tipo === 'hecho') {
        setRecibir(null)
        dejarAviso(b.compraId!, r.aviso)
        router.replace(`/(tabs)/compras/${b.compraId}?aviso=${r.aviso.clave}` as never)
        return
      }
      setRecibir({ error: r.mensaje })
      if (r.recargar) await b.recargar()
    } catch (e) {
      // Falló el guardado previo: no se llegó a pedir confirmar y recibir.
      setRecibir({ error: mensajeDelServidor(e, 'No se guardó la compra.') })
    } finally {
      setOcupado(false)
    }
  }
  const guardarCambios = async () => {
    if (guardando.current) return
    guardando.current = true
    setOcupado(true)
    try {
      await b.guardarCambios()
      router.back()
    } catch {
      // El aviso (con el mensaje del servidor y, si hubo conflicto, "Recargar") lo muestra el formulario.
    } finally {
      guardando.current = false
      setOcupado(false)
    }
  }
  const descartar = () => Alert.alert('Descartar la compra', 'Se borra este borrador. No se puede deshacer.', [
    { text: 'Volver', style: 'cancel' },
    { text: 'Descartar', style: 'destructive', onPress: () => { b.descartar().then(volver, (e) => Alert.alert('No se descartó', mensajeDelServidor(e))) } },
  ])

  const unidadesTotal = b.lineas.reduce((acc, l) => acc + unidadesDe(l), 0)
  const subtotal = total - b.gastos
  const resumenProductos = `${b.lineas.length} ${b.lineas.length === 1 ? 'producto' : 'productos'} · ${mostrarNumero(unidadesTotal)} ${unidadesTotal === 1 ? 'unidad' : 'unidades'}`

  const lineas = (
    <View style={{ gap: space[3] }}>
      {b.lineas.length > 0 ? (
        <View style={{ borderRadius: radii.tarjeta, backgroundColor: c.surface, overflow: 'hidden' }}>
          {b.lineas.map((l, i) => {
            const falta = sinCosto(l)
            const tono = falta ? c.chip.porAutorizar : null
            return (
              <Pressable
                key={l.productoId}
                accessibilityRole="button"
                accessibilityLabel={`${l.nombre}, ${detalleLinea(l)}`}
                onPress={() => setEditando(l)}
                style={{ minHeight: 44, paddingHorizontal: space[4], paddingVertical: space[3], gap: space[1], backgroundColor: tono?.bg ?? c.surface, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}
              >
                <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>{l.nombre}</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
                  <Text style={[typeScale.secundario, { color: c.text, flexShrink: 1 }]}>{detalleLinea(l)}</Text>
                  <Text style={[typeScale.cuerpoDestacado, cifras, { color: c.text }]}>{formatImporte(subtotalDe(l))}</Text>
                </View>
              </Pressable>
            )
          })}
        </View>
      ) : <Text style={secundario}>Todavía no hay productos.</Text>}
      <Button label="+ Agregar productos" variant="secundario" onPress={() => setCatalogo(true)} />
      {faltanCostos > 0 ? (
        <Notice tone="advertencia">{`${faltanCostos === 1 ? 'Una línea no tiene' : `${faltanCostos} líneas no tienen`} costo. El sistema nunca lo inventa: cargalo antes de confirmar.`}</Notice>
      ) : null}
    </View>
  )

  const revisar = (
    <View style={{ gap: space[3] }}>
      {faltanCostos > 0 ? (
        <Notice tone="peligro" title="Falta el costo.">{`${faltanCostos === 1 ? 'Una línea no tiene' : `${faltanCostos} líneas no tienen`} costo. El sistema nunca lo inventa: cargalo en los productos antes de confirmar.`}</Notice>
      ) : null}
      <View style={{ borderRadius: radii.tarjeta, backgroundColor: c.surface, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space[4], paddingTop: space[3] }}>
          <Text accessibilityRole="header" style={[typeScale.cuerpoDestacado, { color: c.text }]}>Productos</Text>
          <Pressable accessibilityRole="link" accessibilityLabel="Editar los productos" onPress={() => setPaso(2)} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={[typeScale.cuerpoDestacado, { color: c.brandInk }]}>Editar</Text>
          </Pressable>
        </View>
        {b.lineas.map((l, i) => (
          <View key={l.productoId} accessible style={{ paddingHorizontal: space[4], paddingVertical: space[3], gap: space[1], borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
            <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>{l.nombre}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
              <View style={{ flexShrink: 1 }}>
                <Text style={[typeScale.secundario, { color: c.text }]}>{textoDeLinea(l)}</Text>
                <Text style={[typeScale.secundario, cifras, { color: sinCosto(l) ? c.danger : c.textSecondary }]}>{sinCosto(l) ? 'Sin costo' : `${formatImporte(l.costoUnitario)} por unidad`}</Text>
              </View>
              <Text style={[typeScale.cuerpoDestacado, cifras, { color: c.text }]}>{formatImporte(subtotalDe(l))}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={{ gap: space[3], padding: space[4], borderRadius: radii.tarjeta, backgroundColor: c.surface }}>
        <Text accessibilityRole="header" style={[typeScale.cuerpoDestacado, { color: c.text }]}>Recepción</Text>
        {/* El plazo de pago es del proveedor: acá va de solo lectura. */}
        {b.proveedor.condicion ? <Text style={[typeScale.secundario, { color: c.text }]}>{`Plazo de pago: ${b.proveedor.condicion}`}</Text> : null}
        <View accessibilityRole="radiogroup" accessibilityLabel="Depósito" style={{ gap: space[2] }}>
          <Text style={[typeScale.secundario, { color: c.text }]}>Depósito</Text>
          {(depositos ?? []).map((d) => {
            const sel = d.id === b.depositoId
            return (
              <Pressable key={d.id ?? d.nombre} accessibilityRole="radio" accessibilityState={{ selected: sel, checked: sel }} onPress={() => { if (d.id) b.setDepositoId(d.id) }}
                style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: space[4], borderRadius: radii.campo, borderWidth: 1, borderColor: sel ? c.brand : c.border, backgroundColor: sel ? c.brandSoft : c.surface }}>
                <Text style={[typeScale.cuerpo, { color: sel ? c.brandInk : c.text }]}>{d.nombre}</Text>
              </Pressable>
            )
          })}
        </View>
        <Field label="Gastos operativos ($)" keyboardType="decimal-pad" alignRight value={gastosTexto}
          error={gastosLeidos === null ? 'Escribí un importe válido, por ejemplo 1.500,50.' : undefined}
          onChangeText={(t) => { setGastosTexto(t); const n = t.trim() === '' ? 0 : leerNumero(t); if (n !== null) b.setGastos(n) }} />
      </View>
      <View style={{ gap: space[1], padding: space[4], borderRadius: radii.tarjeta, backgroundColor: c.surface }}>
        <TotalsRow label="Subtotal" importe={subtotal} />
        <TotalsRow label="Gastos operativos" importe={b.gastos} />
      </View>
    </View>
  )

  const bloqueado = ocupado || b.lineas.length === 0 || faltanCostos > 0
  const botonGuardarCambios = (
    <Button label="Guardar cambios" loading={ocupado} disabled={ocupado || !puedeRecibir || !b.hayCambios || b.estado === 'conflicto' || b.lineas.length === 0 || faltanCostos > 0}
      onPress={() => { void guardarCambios() }} />
  )

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar
        title={edicion ? 'Editar compra' : paso === 2 ? 'Productos' : 'Revisar compra'}
        subtitle={paso === 2 ? [b.proveedor.nombre, b.proveedor.condicion].filter(Boolean).join(' · ') : edicion ? b.proveedor.nombre : `Paso 3 de 3 · ${b.proveedor.nombre}`}
        leading={{ kind: 'atras', onPress: paso === 3 ? () => setPaso(2) : volver }}
        syncLabel={edicion ? undefined : SYNC[b.estado]}
        actions={b.compraId && !edicion ? [{ icon: Trash2, accessibilityLabel: 'Descartar la compra', onPress: descartar }] : []}
      />
      {edicion ? null : <PasosNumerados nombres={PASOS_COMPRA} paso={paso} />}
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[3] }}>
        {b.estado === 'conflicto' ? (
          <View style={{ gap: space[2] }}>
            <Notice tone="peligro" title="Alguien más cambió esta compra.">{edicion && b.error ? `${b.error}
Recargala para ver la versión actual antes de seguir.` : 'Recargala para ver la versión actual antes de seguir.'}</Notice>
            <Button label="Recargar" variant="secundario" onPress={() => { void b.recargar() }} />
          </View>
        ) : b.error ? (
          <View style={{ gap: space[2] }}>
            <Notice tone="peligro">{b.error}</Notice>
            {b.estado === 'error' && !edicion ? <Button label="Reintentar" variant="secundario" onPress={() => { void b.reintentar() }} /> : null}
          </View>
        ) : null}
        {paso === 2 ? lineas : revisar}
      </ScrollView>
      {paso === 2 ? (
        <View style={{ gap: space[2], padding: space[4], backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[3] }}>
            <Text style={[typeScale.secundario, { color: c.textSecondary, flexShrink: 1 }]}>{resumenProductos}</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[typeScale.etiqueta, { color: c.textSecondary }]}>{faltanCostos > 0 ? 'Subtotal (falta un costo)' : 'Subtotal'}</Text>
              <Text style={[typeScale.cuerpoDestacado, cifras, { color: c.text }]}>{faltanCostos > 0 ? '—' : formatImporte(subtotal)}</Text>
            </View>
          </View>
          <Button label="Ver compra" variant={edicion ? 'secundario' : 'primario'} disabled={b.lineas.length === 0} onPress={() => setPaso(3)} />
          {edicion ? botonGuardarCambios : null}
        </View>
      ) : edicion ? (
        <View style={{ padding: space[4], backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border }}>{botonGuardarCambios}</View>
      ) : (
        <View style={{ gap: space[2], padding: space[4], backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>Total</Text>
            <Text accessibilityLabel={faltanCostos > 0 ? 'Total sin calcular' : undefined} style={[typeScale.titulo, cifras, { color: c.text }]}>{faltanCostos > 0 ? '—' : formatImporte(total)}</Text>
          </View>
          <Button label="Confirmar compra" loading={ocupado} disabled={bloqueado}
            onPress={() => { void terminar(b.confirmar, 'No se confirmó la compra') }} />
          {puedeRecibir ? (
            <Button label="Confirmar y recibir" variant="secundario" disabled={bloqueado}
              onPress={() => { setFechaFactura(hoyTexto()); setRecibir({ error: null }) }} />
          ) : null}
          <Button label="Guardar nota de pedido" variant="secundario" disabled={bloqueado}
            onPress={() => { void terminar(b.guardarNota, 'No se guardó la nota de pedido') }} />
        </View>
      )}
      <ConfirmarYRecibirSheet visible={recibir !== null} onClose={() => setRecibir(null)} pideFactura={b.proveedor.pideFactura}
        ocupado={ocupado} fecha={fechaFactura} onFecha={setFechaFactura} error={recibir?.error ?? null} onConfirmar={(f) => { void confirmarYRecibir(f) }} />
      <CompraLineaSheet
        linea={editando}
        onClose={() => setEditando(null)}
        onConfirm={(nueva) => { b.setLineas((prev) => prev.map((l) => (l.productoId === nueva.productoId ? nueva : l))); setEditando(null) }}
        onQuitar={(id) => { b.setLineas((prev) => prev.filter((l) => l.productoId !== id)); setEditando(null) }}
      />
      <CatalogModal
        visible={catalogo}
        onClose={() => setCatalogo(false)}
        productSearch={busqueda}
        setProductSearch={setBusqueda}
        loadingProds={productos.isLoading}
        productosFiltrados={productos.data?.pages.flatMap((p) => p.items ?? []) ?? []}
        hayMasProductos={!!productos.hasNextPage}
        cargarMasProductos={() => { if (productos.hasNextPage && !productos.isFetchingNextPage) void productos.fetchNextPage() }}
        detalles={b.lineas.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad }))}
        setProductoCantidad={b.setCantidadProducto}
      />
    </View>
  )
}
