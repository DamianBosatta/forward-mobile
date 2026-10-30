import React, { useEffect, useMemo, useState } from 'react'
import { useIsFocused } from '@react-navigation/native'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { Filter } from 'lucide-react-native'
import { FONT, radii, shadowMd, space, typeScale, useColors, useIsDark } from '@/libs/theme'
import { Notice, StatusChip, TopBar, TwoPane, chipForEstado, useMenuLeading } from '@/core/ui/fw'
import { useResponsive } from '@/libs/useResponsive'
import { useHojaRuta, useVentasParaPreparacion, type VentaPreparacion } from '@/libs/api-client/logistica'
import { useVenta } from '@/libs/api-client'
import { esEstadoVenta } from '@/core/constants/estados'
import { useDiasEntrega, useFeriados } from '@/libs/api-client/configuracion'
import { useVendedores } from '@/libs/api-client/ventas'
import { useAuthStore } from '@/libs/store/auth.store'
import { diaArgentina } from '@/src/utils/date'
import { useAhoraArgentina } from '@/src/utils/useAhoraArgentina'
import { nombreDelDia, proximosDiasDeEntrega } from './dias'
import { PedidoPorPrepararDetalle } from './PedidoPorPrepararDetalle'
import { FiltrosPorPreparar, SIN_FILTROS, textoFiltros, type FiltrosPreparacion } from './FiltrosPorPreparar'

/** El servidor manda las NoEntregada siempre, sin importar el día elegido (X11: por nombre). */
const esNoEntregada = (v: VentaPreparacion) => esEstadoVenta(v.estado, 'NoEntregada')
/** Chip "Todas" de la tira de fechas: sin límite de fecha (como el atajo "Todo" de la web). */
const TODAS = 'todas'
type Pestana = 'pendientes' | 'noEntregados'

const semibold = { fontFamily: FONT.semibold, fontWeight: '600' as const }
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/**
 * Datos de una entrega fallida tal como los devuelve el servidor: el motivo y el chofer salen de la
 * parada en la hoja de ruta del pedido; las observaciones, de la venta.
 */
function DatosDeEntregaFallida({ pedido }: { pedido: VentaPreparacion }) {
  const c = useColors()
  const hoja = useHojaRuta(pedido.hojaRutaId ?? '')
  const venta = useVenta(pedido.id)
  const parada = hoja.data?.detalles?.find((p) => p.ventaId === pedido.id)
  const motivo = parada?.motivoRechazo?.trim()
  const observaciones = venta.data?.venta?.observaciones?.trim()
  const chofer = hoja.data?.choferNombre
  if (!motivo && !observaciones && !chofer) return null
  return (
    <View style={{ gap: space[1] }}>
      {motivo ? <Text style={{ ...typeScale.secundario, ...semibold, color: c.text }}>{`Motivo: ${motivo}`}</Text> : null}
      {observaciones ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{`Observaciones: ${observaciones}`}</Text> : null}
      {chofer ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{`${chofer} (chofer)`}</Text> : null}
    </View>
  )
}

/** Láminas ModLogistica, ResNoEntregados y TabLogistica: solo lectura, sin acciones (D6). */
export function PorPrepararScreen() {
  const c = useColors()
  const sombra = shadowMd[useIsDark() ? 'dark' : 'light']
  const menu = useMenuLeading()
  const { isTabletLandscape } = useResponsive()
  const ahora = useAhoraArgentina()
  const hoy = diaArgentina(ahora)
  const diasEntrega = useDiasEntrega().data
  const dias = useMemo(() => proximosDiasDeEntrega(ahora, diasEntrega), [hoy, diasEntrega]) // eslint-disable-line react-hooks/exhaustive-deps
  const feriados = useFeriados(dias[0].fecha)
  const feriadoDe = (fecha: string) => feriados.data?.find((f) => f.fecha?.slice(0, 10) === fecha)
  const [elegida, setElegida] = useState<string | null>(null)
  const [pestana, setPestana] = useState<Pestana>('pendientes')
  const todas = elegida === TODAS
  const dia = dias.find((d) => d.fecha === elegida) ?? dias.find((d) => !feriadoDe(d.fecha)) ?? dias[0]
  const [pedido, setPedido] = useState<VentaPreparacion | null>(null)
  // Al cambiar el día argentino no queda el pedido ni el día elegido de ayer.
  useEffect(() => { setElegida(null); setPedido(null) }, [hoy])
  const [filtros, setFiltros] = useState<FiltrosPreparacion>(SIN_FILTROS)
  const [filtrando, setFiltrando] = useState(false)
  // La lista de vendedores pide Ventas:Read; sin ese permiso no se ofrece filtrar por vendedor.
  const veVendedores = useAuthStore((s) => s.canDo('MOD_VENTAS', 'read'))
  const vendedores = useVendedores(veVendedores && filtrando)
  // La pantalla queda montada en el Drawer: fuera de foco no consulta cada 30 segundos.
  // Logística y vendedor los filtra el servidor; el estado, el teléfono (el endpoint no lo recibe).
  const q = useVentasParaPreparacion(
    { fechaDesde: todas ? undefined : dia.fecha, fechaHasta: todas ? undefined : dia.fecha, metodoEntrega: filtros.metodo ?? undefined, vendedorId: filtros.vendedor?.id },
    { activa: useIsFocused(), mantenerAlFiltrar: true },
  )

  const items = (q.data ?? []).filter((v) => filtros.estado === null || v.estado === filtros.estado)
  const resumenFiltros = textoFiltros(filtros)
  // En tablet el detalle queda al lado: si el filtro saca ese pedido de la lista, se cierra.
  useEffect(() => {
    if (pedido && q.data && !q.isPlaceholderData && !items.some((v) => v.id === pedido.id)) setPedido(null)
  }, [pedido, q.data, q.isPlaceholderData, filtros.estado]) // eslint-disable-line react-hooks/exhaustive-deps
  const delDia = items.filter((v) => !esNoEntregada(v))
  const noEntregados = items.filter(esNoEntregada)
  const lineas = delDia.reduce((s, v) => s + v.itemsCount, 0)
  const feriadoEnLaTira = dias.find((d) => feriadoDe(d.fecha))

  const tarjeta = (v: VentaPreparacion) => {
    const falla = esNoEntregada(v)
    const chip = chipForEstado('venta', v.estado)
    const elegido = pedido?.id === v.id
    return (
      <Pressable
        key={v.id}
        onPress={() => setPedido(v)}
        accessibilityRole="button"
        accessibilityLabel={`Pedido ${v.codigoPedido ?? ''}: ${v.direccion}`}
        accessibilityState={{ selected: elegido }}
        style={{
          backgroundColor: elegido ? c.brandSoft : c.surface, borderRadius: radii.tarjeta, padding: space[4],
          gap: space[1], borderWidth: elegido ? 2 : 0, borderColor: c.brand, ...sombra,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[2] }}>
          <Text style={{ ...typeScale.secundario, color: c.textSecondary, flex: 1 }} numberOfLines={1}>
            {[v.codigoPedido, v.vendedorNombre].filter(Boolean).join(' · ')}
          </Text>
          {chip ? <StatusChip estado={chip.estado} label={chip.label} /> : null}
        </View>
        {/* El cliente se identifica por la dirección; el nombre va aparte. */}
        <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{v.direccion}</Text>
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{v.clienteNombre}</Text>
        {/* Ya está en una hoja que no salió: el servidor no la deja sumar a otra. */}
        {falla ? <DatosDeEntregaFallida pedido={v} /> : null}
        {v.hojaRutaCodigo ? (
          <Text style={{ ...typeScale.secundario, ...semibold, color: c.text }}>{`En hoja ${v.hojaRutaCodigo}`}</Text>
        ) : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2], marginTop: space[1] }}>
          <Text style={{ ...typeScale.secundario, color: c.text, flex: 1 }}>{v.metodoEntregaNombre}</Text>
          <Text style={{ ...typeScale.secundario, ...semibold, color: c.text }}>
            {[
              plural(v.itemsCount, 'producto', 'productos'),
              // La suma la da el servidor (9B, prioridad 3); uno anterior no la manda.
              typeof v.unidadesCount === 'number' ? `${v.unidadesCount} u.` : null,
              v.piezasCount > 0 ? plural(v.piezasCount, 'pieza', 'piezas') : null,
            ].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </Pressable>
    )
  }

  const chipFecha = (clave: string, titulo: string, sub: string | null, activo: boolean, label: string, onPress: () => void, feriado = false) => (
    <Pressable
      key={clave}
      disabled={feriado}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: activo, disabled: feriado }}
      style={{
        flex: 1, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: radii.campo,
        borderWidth: activo ? 2 : 1, borderColor: activo ? c.brand : c.border,
        backgroundColor: activo ? c.brandSoft : feriado ? c.surface2 : c.surface,
      }}
    >
      <Text style={{ ...typeScale.cuerpoDestacado, color: activo ? c.brandInk : feriado ? c.textSecondary : c.text, textDecorationLine: feriado ? 'line-through' : 'none' }}>{titulo}</Text>
      {sub ? <Text style={{ ...typeScale.etiqueta, color: activo ? c.brandInk : c.textSecondary }}>{sub}</Text> : null}
    </Pressable>
  )

  const enPendientes = pestana === 'pendientes'
  const aMostrar = enPendientes ? delDia : noEntregados
  const lista = (
    <ScrollView contentContainerStyle={{ padding: space[4], gap: space[3] }}>
      {enPendientes ? (
        <View accessibilityRole="radiogroup" accessibilityLabel="Fecha de entrega" style={{ flexDirection: 'row', gap: space[1] }}>
          {dias.map((d) => {
            const feriado = !!feriadoDe(d.fecha)
            return chipFecha(
              d.fecha, String(d.numero), d.semana, !todas && d.fecha === dia.fecha,
              `${d.semana} ${d.numero}${d.esHoy ? ' · Hoy' : ''}${feriado ? ' · Feriado' : ''}`,
              () => { setElegida(d.fecha); setPedido(null) }, feriado,
            )
          })}
          {chipFecha(TODAS, 'Todas', null, todas, 'Todas las fechas', () => { setElegida(TODAS); setPedido(null) })}
        </View>
      ) : null}
      {enPendientes && feriadoEnLaTira ? (
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
          {`El ${nombreDelDia(feriadoEnLaTira)} es feriado: no hay entregas.`}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] }}>
        <Text accessibilityRole="header" style={{ ...typeScale.secundario, ...semibold, color: c.text, flex: 1 }}>
          {enPendientes
            ? `${todas ? 'Todas las fechas' : nombreDelDia(dia)} · ${plural(delDia.length, 'pedido', 'pedidos')} · ${plural(lineas, 'producto', 'productos')}`
            : `${plural(noEntregados.length, 'pedido no entregado', 'pedidos no entregados')}, para reprogramar`}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filtrar: logística, vendedor, estado"
          onPress={() => setFiltrando(true)}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Filter size={22} color={c.brandInk} strokeWidth={2} />
        </Pressable>
      </View>
      {resumenFiltros ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] }}>
          <Text style={{ ...typeScale.secundario, color: c.text, flex: 1 }}>{resumenFiltros}</Text>
          <Pressable accessibilityRole="button" onPress={() => setFiltros(SIN_FILTROS)} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ ...typeScale.secundario, ...semibold, color: c.brandInk }}>Quitar filtros</Text>
          </Pressable>
        </View>
      ) : null}
      {q.isLoading ? (
        <ActivityIndicator color={c.brand} accessibilityLabel="Cargando los pedidos" />
      ) : q.isError ? (
        <Notice tone="peligro">No se pudieron cargar los pedidos.</Notice>
      ) : aMostrar.length === 0 ? (
        <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>
          {!enPendientes ? 'Sin entregas fallidas.' : resumenFiltros ? 'No hay pedidos con estos filtros.' : todas ? 'No hay pedidos para entregar.' : 'No hay pedidos para entregar ese día.'}
        </Text>
      ) : (
        aMostrar.map(tarjeta)
      )}
      <Notice tone="info">
        {enPendientes
          ? 'Desde el teléfono solo se ven. Preparar y armar rutas se hace en la web.'
          : 'Desde el teléfono solo se ven. Reprogramar o anular se hace en la web.'}
      </Notice>
    </ScrollView>
  )

  const leading = !isTabletLandscape && pedido ? { kind: 'atras' as const, onPress: () => setPedido(null) } : menu
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar
        title="Pedidos de logística"
        leading={leading}
        tabs={[
          { label: `Pendientes (${delDia.length})`, selected: enPendientes, onPress: () => { setPestana('pendientes'); setPedido(null) } },
          { label: `No entregados (${noEntregados.length})`, selected: !enPendientes, onPress: () => { setPestana('noEntregados'); setPedido(null) } },
        ]}
      />
      <TwoPane
        list={lista}
        detail={pedido ? <PedidoPorPrepararDetalle key={pedido.id} pedido={pedido} /> : null}
        emptyDetail={
          <View style={{ padding: space[6] }}>
            <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>Elegí un pedido para verlo.</Text>
          </View>
        }
      />
      <FiltrosPorPreparar
        visible={filtrando}
        filtros={filtros}
        onCambio={setFiltros}
        vendedores={veVendedores ? { lista: vendedores.data ?? [], cargando: vendedores.isLoading, error: vendedores.isError } : null}
        onClose={() => setFiltrando(false)}
      />
    </View>
  )
}
