import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronRight, ShoppingCart, Trash2 } from 'lucide-react-native'
import { Button, Notice, PieFijo, TopBar, formatImporte } from '@/core/ui/fw'
import { importe as cifras, radii, space, typeScale, useColors } from '@/libs/theme'
import { useDepositos } from '@/libs/api-client'
import { useSocio } from '@/libs/api-client/socios'
import { useAsignarFotoFacturaCompra, useGuardarComprobanteCompra } from '@/libs/api-client/compras'
import { usePuedeElegirDeposito } from '@/features/venta-nueva/hooks/useDepositoDeVenta'
import { usePermissions } from '@/core/auth/RequirePermission'
import { leerNumero, mostrarNumero } from '@/core/utils/numero'
import { ddmmaaaa, diaArgentina, hoyTexto } from '@/core/utils/fecha'
import { mensajeDelServidor } from '../lib/mensaje-error'
import { sinCosto, totalCompra, unidadesDe, type LineaCompra } from '../lib/lineaCompra'
import { dejarAviso, type Aviso } from '../lib/confirmar-y-recibir'
import { fechaIso, franjaTexto } from '../lib/fecha'
import { calcularVencimiento } from '../lib/recepcion'
import { formNuevo } from '../lib/comprobante'
import { useCompraBorrador, type EstadoGuardado } from '../hooks/useCompraBorrador'
import { ElegirProveedor } from './ElegirProveedor'
import { PasosCompra } from './PasosCompra'
import { CatalogoCompra } from './CatalogoCompra'
import { CantidadCostoPantalla } from './CantidadCostoPantalla'
import { CarritoCompra } from './CarritoCompra'
import { DepositoCompra, RecepcionCompra } from './RecepcionCompra'
import { ComprobanteProveedorPantalla, resumenDeCargado, type ComprobanteCargado } from './ComprobanteProveedorPantalla'
import type { ProductoComprable } from './ProductoCompraCard'

const SYNC: Record<EstadoGuardado, string | undefined> = {
  nuevo: undefined, guardando: 'Guardando…', guardado: 'Guardado', error: 'Sin guardar', conflicto: 'Sin guardar',
}

/** Ruta de "Compra guardada": el aviso viaja como clave; su texto queda en memoria (`dejarAviso`). */
export const rutaCompraGuardada = (id: string, clave?: string) => `/(tabs)/compras/guardada?id=${id}${clave ? `&aviso=${clave}` : ''}`

interface Props {
  /** Borrador a retomar (desde la pestaña Borradores). */
  borradorId?: string
  /** Compra ya guardada (nota de pedido o confirmada) a editar: no autoguarda, un solo "Guardar cambios". */
  editarId?: string
  /** Proveedor ya elegido (viene de su ficha): se crea el borrador con él sin pasar por la lista. */
  proveedorId?: string
}

/**
 * Compra nueva con los pasos y la visual de la venta nueva (maqueta "Compras como venta"): Proveedor / Productos / Carrito /
 * Recepción, como borrador con autoguardado. Al confirmar abre "Compra guardada". Con `editarId` edita una compra ya
 * guardada con el mismo catálogo y carrito, sin autoguardado ni paso 4: un solo "Guardar cambios".
 */
export function CompraNueva({ borradorId, editarId, proveedorId }: Props) {
  const c = useColors()
  const router = useRouter()
  const edicion = !!editarId
  const b = useCompraBorrador(editarId ?? borradorId, { edicion })
  // 2 = productos, 3 = carrito, 4 = recepción. El paso 1 (proveedor) es mientras no haya proveedor.
  const [paso, setPaso] = useState<2 | 3 | 4>(2)
  const [gastosTexto, setGastosTexto] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [editando, setEditando] = useState<LineaCompra | null>(null)
  const [recibirAhora, setRecibirAhora] = useState(false)
  const [fechaFactura, setFechaFactura] = useState(hoyTexto)
  const [comprobante, setComprobante] = useState<ComprobanteCargado | null>(null)
  const [comprobanteAbierto, setComprobanteAbierto] = useState(false)
  const [errorPaso4, setErrorPaso4] = useState<string | null>(null)
  const guardando = useRef(false)
  const preseleccionado = useRef(false)
  const puedeRecibir = usePermissions().canDo('MOD_COMPRAS', 'update')
  const socio = useSocio(b.proveedor?.id ?? '')
  const guardarComprobante = useGuardarComprobanteCompra()
  const asignarFoto = useAsignarFotoFacturaCompra()
  useEffect(() => {
    if (!proveedorId || borradorId || editarId || preseleccionado.current) return
    preseleccionado.current = true
    void b.elegirProveedor(proveedorId)
  }, [proveedorId, borradorId, editarId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setGastosTexto(b.gastos ? mostrarNumero(b.gastos) : '') }, [b.compraId, b.cargando]) // eslint-disable-line react-hooks/exhaustive-deps
  const { data: depositosDelServidor } = useDepositos()
  const depositos = (depositosDelServidor ?? []).flatMap((d) => (d.id ? [{ id: d.id, nombre: d.nombre ?? '' }] : []))
  const puedeElegirDeposito = usePuedeElegirDeposito()

  const volver = () => {
    if (!(edicion && b.hayCambios)) return router.back()
    Alert.alert('Salir sin guardar', 'Hay cambios sin guardar. Si salís, se pierden.', [
      { text: 'Seguir editando', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => router.back() },
    ])
  }

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
        <TopBar title={edicion ? 'Editar compra' : 'Nueva compra'} leading={{ kind: 'atras', onPress: volver }} />
        {b.error && (borradorId || editarId) ? <View style={{ padding: space[4] }}><Notice tone="peligro">{b.error}</Notice></View>
          : <ElegirProveedor onElegir={(id) => { void b.elegirProveedor(id) }} faltantes={b.faltantes} error={b.error} />}
      </View>
    )
  }

  const proveedor = b.proveedor
  const faltanCostos = b.lineas.filter(sinCosto).length
  const total = totalCompra(b.lineas, b.descuentoPorcentaje, b.gastos)
  const subtotal = total - b.gastos
  const gastosLeidos = gastosTexto.trim() === '' ? 0 : leerNumero(gastosTexto)
  const unidadesTotal = b.lineas.reduce((acc, l) => acc + unidadesDe(l), 0)
  const resumenProductos = `${b.lineas.length} ${b.lineas.length === 1 ? 'producto' : 'productos'} · ${mostrarNumero(unidadesTotal)} u`
  const pideFactura = proveedor.pideFactura
  const fechaLeida = fechaIso(fechaFactura)
  const hoy = diaArgentina(Date.now())
  const vencimiento = calcularVencimiento(socio.data?.condicionPago, hoy, pideFactura ? fechaLeida : null)
  const recibir = puedeRecibir && recibirAhora

  const reemplazarLinea = (nueva: LineaCompra) => b.setLineas((prev) => prev.map((l) => (l.productoId === nueva.productoId ? nueva : l)))
  const quitarLinea = (id: string) => b.setLineas((prev) => prev.filter((l) => l.productoId !== id))
  const agregar = (prod: ProductoComprable) => b.setCantidadProducto(prod, 1)

  /** Guarda el comprobante y la foto cargados en el paso 4 sobre la compra ya recibida; si falla, el aviso lo dice. */
  const conComprobante = async (id: string, aviso: Aviso): Promise<Aviso> => {
    if (!comprobante) return aviso
    try {
      await guardarComprobante.mutateAsync({ id, comprobante: comprobante.comprobante })
    } catch (e) {
      return { ...aviso, tono: 'advertencia', texto: `${aviso.texto} No se guardó el comprobante: ${mensajeDelServidor(e)} Cargalo desde acá.` }
    }
    if (!comprobante.fotoUrl) return aviso
    try {
      await asignarFoto.mutateAsync({ id, fotoUrl: comprobante.fotoUrl })
      return aviso
    } catch (e) {
      return { ...aviso, tono: 'advertencia', texto: `${aviso.texto} El comprobante quedó guardado, pero no la foto de la factura: ${mensajeDelServidor(e)} Cargala desde la compra.` }
    }
  }
  const terminar = async (accion: () => Promise<void>, titulo: string) => {
    setOcupado(true)
    setErrorPaso4(null)
    try {
      await accion()
      router.replace(rutaCompraGuardada(b.compraId!) as never)
    } catch (e) {
      setErrorPaso4(`${titulo}: ${mensajeDelServidor(e)}`)
    } finally {
      setOcupado(false)
    }
  }
  const confirmarYRecibir = async () => {
    setOcupado(true)
    setErrorPaso4(null)
    try {
      const r = await b.confirmarYRecibir(pideFactura ? fechaLeida ?? undefined : undefined)
      if (r.tipo === 'hecho') {
        const id = b.compraId!
        // Sin respuesta no se sabe si se recibió: se abre la compra para revisarla (como hasta ahora).
        if (r.aviso.clave === 'incierto') {
          dejarAviso(id, r.aviso)
          router.replace(`/(tabs)/compras/${id}?aviso=${r.aviso.clave}` as never)
          return
        }
        dejarAviso(id, await conComprobante(id, r.aviso))
        router.replace(rutaCompraGuardada(id, r.aviso.clave) as never)
        return
      }
      setErrorPaso4(r.mensaje)
      if (r.recargar) await b.recargar()
    } catch (e) {
      // Falló el guardado previo: no se llegó a pedir confirmar y recibir.
      setErrorPaso4(mensajeDelServidor(e, 'No se guardó la compra.'))
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

  const avisoGuardado = b.estado === 'conflicto' ? (
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
  ) : null

  const botonGuardarCambios = (
    <Button label="Guardar cambios" loading={ocupado} disabled={ocupado || !puedeRecibir || !b.hayCambios || b.estado === 'conflicto' || b.lineas.length === 0 || faltanCostos > 0}
      onPress={() => { void guardarCambios() }} />
  )
  const descartarAccion = b.compraId && !edicion ? [{ icon: Trash2, accessibilityLabel: 'Descartar la compra', onPress: descartar }] : []
  const sync = edicion ? undefined : SYNC[b.estado]

  // Edición: el depósito se cambia en el carrito, porque no hay paso 4.
  const depositoEnEdicion = edicion ? (
    <DepositoCompra depositos={depositos} depositoId={b.depositoId} onDeposito={b.setDepositoId} puedeElegir={puedeElegirDeposito} />
  ) : null

  let cuerpo: React.ReactNode
  if (paso === 2) {
    cuerpo = (
      <>
        <TopBar title={edicion ? 'Editar compra' : proveedor.nombre} subtitle={proveedor.condicion ? `Plazo de pago ${proveedor.condicion}` : undefined}
          leading={{ kind: 'atras', onPress: volver }} syncLabel={sync} actions={descartarAccion} />
        {edicion ? null : <PasosCompra paso={2} />}
        {avisoGuardado ? <View style={{ paddingHorizontal: space[4], paddingTop: space[3] }}>{avisoGuardado}</View> : null}
        <CatalogoCompra proveedor={proveedor} lineas={b.lineas} onAgregar={agregar} onCambiar={reemplazarLinea} onQuitar={quitarLinea} onAbrir={setEditando} />
        <PieFijo>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[3] }}>
            <View style={{ flexShrink: 1 }}>
              <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{resumenProductos}</Text>
              <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{faltanCostos > 0 ? 'Subtotal (falta un costo)' : 'Subtotal'}</Text>
            </View>
            <Text style={{ ...typeScale.titulo, ...cifras, color: c.text }}>{faltanCostos > 0 ? '—' : formatImporte(subtotal)}</Text>
          </View>
          <Button label="Ver compra" icon={ShoppingCart} variant={edicion ? 'secundario' : 'primario'} disabled={b.lineas.length === 0} onPress={() => setPaso(3)} />
          {edicion ? botonGuardarCambios : null}
        </PieFijo>
      </>
    )
  } else if (paso === 3) {
    cuerpo = (
      <>
        <TopBar title={edicion ? 'Editar compra' : 'Carrito'} subtitle={proveedor.nombre} leading={{ kind: 'atras', onPress: () => setPaso(2) }}
          syncLabel={sync} actions={descartarAccion} />
        {edicion ? null : <PasosCompra paso={3} />}
        <ScrollView contentContainerStyle={{ padding: space[4], gap: space[3] }} keyboardShouldPersistTaps="handled">
          {avisoGuardado}
          <CarritoCompra lineas={b.lineas} onEditarProductos={() => setPaso(2)} onAbrirLinea={setEditando}
            gastosTexto={gastosTexto} gastosInvalidos={gastosLeidos === null} subtotal={subtotal} gastos={b.gastos}
            onGastos={(t) => { setGastosTexto(t); const n = t.trim() === '' ? 0 : leerNumero(t); if (n !== null) b.setGastos(n) }}
            extra={depositoEnEdicion} />
        </ScrollView>
        <PieFijo>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>Total</Text>
            <Text accessibilityLabel={faltanCostos > 0 ? 'Total sin calcular' : undefined} style={{ ...typeScale.titulo, ...cifras, color: c.text }}>{faltanCostos > 0 ? '—' : formatImporte(total)}</Text>
          </View>
          {edicion ? botonGuardarCambios : (
            <Button label="Continuar" iconoFinal={ChevronRight} disabled={b.lineas.length === 0 || gastosLeidos === null} onPress={() => { setErrorPaso4(null); setPaso(4) }} />
          )}
        </PieFijo>
      </>
    )
  } else {
    cuerpo = (
      <>
        <TopBar title="Recepción" subtitle={proveedor.nombre} leading={{ kind: 'atras', onPress: () => setPaso(3) }} syncLabel={sync} actions={descartarAccion} />
        <PasosCompra paso={4} />
        {avisoGuardado ? <View style={{ paddingHorizontal: space[4], paddingTop: space[3] }}>{avisoGuardado}</View> : null}
        <RecepcionCompra
          proveedor={{ nombre: proveedor.nombre, cuit: socio.data?.cuit, condicion: proveedor.condicion, franja: franjaTexto(socio.data?.franjaEntrega) }}
          depositos={depositos} depositoId={b.depositoId} onDeposito={b.setDepositoId} puedeElegirDeposito={puedeElegirDeposito}
          puedeRecibir={puedeRecibir} recibirAhora={recibirAhora} onRecibirAhora={(v) => { setRecibirAhora(v); if (v) setFechaFactura((f) => f || hoyTexto()) }}
          pideFactura={pideFactura} fecha={fechaFactura} onFecha={setFechaFactura} fechaValida={!!fechaLeida}
          vencimiento={vencimiento ? `Vence el ${ddmmaaaa(vencimiento)}` : null}
          comprobante={comprobante ? resumenDeCargado(comprobante) : null}
          onComprobante={() => setComprobanteAbierto(true)}
          faltanCostos={faltanCostos} onVolverAlCarrito={() => setPaso(3)} error={errorPaso4}
          subtotal={subtotal} gastos={b.gastos} total={total} ocupado={ocupado}
          onConfirmar={() => { if (recibir) void confirmarYRecibir(); else void terminar(b.confirmar, 'No se confirmó la compra') }}
          onGuardarNota={() => { void terminar(b.guardarNota, 'No se guardó la nota de pedido') }}
        />
        <ComprobanteProveedorPantalla visible={comprobanteAbierto}
          form={comprobante?.form ?? formNuevo(socio.data ?? { razonSocial: proveedor.nombre }, hoyTexto())} fotoUrl={comprobante?.fotoUrl ?? null}
          onVolver={() => setComprobanteAbierto(false)} onGuardar={(cargado) => { setComprobante(cargado); setComprobanteAbierto(false) }} />
      </>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {cuerpo}
      <CantidadCostoPantalla
        linea={editando}
        onClose={() => setEditando(null)}
        onListo={(nueva) => { reemplazarLinea(nueva); setEditando(null) }}
        onQuitar={(id) => { quitarLinea(id); setEditando(null) }}
      />
    </View>
  )
}
