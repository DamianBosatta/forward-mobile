import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Trash2 } from 'lucide-react-native'
import { Button, Field, Notice, TopBar, TotalsRow, formatImporte } from '@/core/ui/fw'
import { importe as cifras, radii, space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { useDepositos, useInfiniteProductos } from '@/libs/api-client'
import { leerNumero, mostrarNumero } from '@/src/utils/numero'
import { mensajeDelServidor } from '../lib/mensaje-error'
import { sinCosto, subtotalDe, totalCompra, unidadesDe, type LineaCompra } from '../lib/lineaCompra'
import { useCompraBorrador, type EstadoGuardado } from '../hooks/useCompraBorrador'
import { ElegirProveedor } from './ElegirProveedor'
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
}

/** Compra nueva con el formato nuevo (láminas Compra y TabCompra), como borrador con autoguardado. */
export function CompraNueva({ borradorId }: Props) {
  const c = useColors()
  const router = useRouter()
  const { isTablet } = useResponsive()
  const b = useCompraBorrador(borradorId)
  const [pestana, setPestana] = useState<'lineas' | 'cabecera'>('lineas')
  const [catalogo, setCatalogo] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [enviada, setEnviada] = useState('')
  const [gastosTexto, setGastosTexto] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [editando, setEditando] = useState<LineaCompra | null>(null)
  const [recibir, setRecibir] = useState<{ error: string | null } | null>(null)
  const [fechaFactura, setFechaFactura] = useState(hoyTexto)
  const puedeRecibir = usePermissions().canDo('MOD_COMPRAS', 'update')
  useEffect(() => {
    const t = setTimeout(() => setEnviada(busqueda.trim()), 300)
    return () => clearTimeout(t)
  }, [busqueda])
  useEffect(() => { setGastosTexto(b.gastos ? mostrarNumero(b.gastos) : '') }, [b.compraId, b.cargando]) // eslint-disable-line react-hooks/exhaustive-deps
  const productos = useInfiniteProductos({ pageSize: 30, search: enviada })
  const { data: depositos } = useDepositos()

  const volver = () => router.back()
  const secundario = [typeScale.secundario, { color: c.textSecondary }]

  if (b.cargando) return <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center' }}><ActivityIndicator color={c.brand} /></View>
  if (!b.proveedor) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar title="Nueva compra" leading={{ kind: 'atras', onPress: volver }} />
        {b.error && borradorId ? <View style={{ padding: space[4] }}><Notice tone="peligro">{b.error}</Notice></View>
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
  const descartar = () => Alert.alert('Descartar la compra', 'Se borra este borrador. No se puede deshacer.', [
    { text: 'Volver', style: 'cancel' },
    { text: 'Descartar', style: 'destructive', onPress: () => { b.descartar().then(volver, (e) => Alert.alert('No se descartó', mensajeDelServidor(e))) } },
  ])

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

  const cabecera = (
    <View style={{ gap: space[3] }}>
      <View style={{ gap: space[1] }}>
        <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>{b.proveedor.nombre}</Text>
        {b.proveedor.condicion ? <Text style={secundario}>{b.proveedor.condicion}</Text> : null}
      </View>
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
      <TotalsRow label="Subtotal" importe={total - b.gastos} />
      <TotalsRow label="Gastos operativos" importe={b.gastos} />
      <TotalsRow label="Total" importe={total} destacado />
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar
        title="Nueva compra"
        subtitle={[b.proveedor.nombre, b.proveedor.condicion].filter(Boolean).join(' · ')}
        leading={{ kind: 'atras', onPress: volver }}
        syncLabel={SYNC[b.estado]}
        actions={b.compraId ? [{ icon: Trash2, accessibilityLabel: 'Descartar la compra', onPress: descartar }] : []}
        tabs={isTablet ? undefined : [
          { label: `Líneas (${b.lineas.length})`, selected: pestana === 'lineas', onPress: () => setPestana('lineas') },
          { label: 'Cabecera', selected: pestana === 'cabecera', onPress: () => setPestana('cabecera') },
        ]}
      />
      <View style={{ padding: space[4], backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <TotalsRow label="Total" importe={total} destacado={false} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[3] }}>
        {b.estado === 'conflicto' ? (
          <View style={{ gap: space[2] }}>
            <Notice tone="peligro" title="Alguien más cambió esta compra.">Recargala para ver la versión actual antes de seguir.</Notice>
            <Button label="Recargar" variant="secundario" onPress={() => { void b.recargar() }} />
          </View>
        ) : b.error ? (
          <View style={{ gap: space[2] }}>
            <Notice tone="peligro">{b.error}</Notice>
            {b.estado === 'error' ? <Button label="Reintentar" variant="secundario" onPress={() => { void b.reintentar() }} /> : null}
          </View>
        ) : null}
        {isTablet ? (
          <View style={{ flexDirection: 'row', gap: space[6], alignItems: 'flex-start' }}>
            <View style={{ flex: 3, gap: space[2] }}><Text accessibilityRole="header" style={[typeScale.cuerpoDestacado, { color: c.text }]}>{`Líneas (${b.lineas.length})`}</Text>{lineas}</View>
            <View style={{ flex: 2, gap: space[2] }}><Text accessibilityRole="header" style={[typeScale.cuerpoDestacado, { color: c.text }]}>Cabecera</Text>{cabecera}</View>
          </View>
        ) : pestana === 'lineas' ? lineas : cabecera}
      </ScrollView>
      <View style={{ gap: space[2], padding: space[4], backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border }}>
        <View style={{ flexDirection: 'row', gap: space[2] }}>
          <Button label="Guardar nota" variant="secundario" disabled={ocupado || b.lineas.length === 0 || faltanCostos > 0}
            onPress={() => { void terminar(b.guardarNota, 'No se guardó la nota de pedido') }} />
          <View style={{ flex: 1 }}>
            <Button label="Confirmar compra" loading={ocupado} disabled={b.lineas.length === 0 || faltanCostos > 0}
              onPress={() => { void terminar(b.confirmar, 'No se confirmó la compra') }} />
          </View>
        </View>
        {puedeRecibir ? (
          <Button label="Confirmar y recibir" variant="secundario" disabled={ocupado || b.lineas.length === 0 || faltanCostos > 0}
            onPress={() => { setFechaFactura(hoyTexto()); setRecibir({ error: null }) }} />
        ) : null}
      </View>
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
        colors={c}
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
