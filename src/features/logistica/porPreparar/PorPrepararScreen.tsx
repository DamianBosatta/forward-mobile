import React, { useEffect, useMemo, useState } from 'react'
import { useIsFocused } from '@react-navigation/native'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { Filter } from 'lucide-react-native'
import { FONT, radii, shadowMd, space, typeScale, useColors, useIsDark } from '@/libs/theme'
import { Notice, StatusChip, TopBar, TwoPane, chipForEstado, useMenuLeading } from '@/core/ui/fw'
import { useResponsive } from '@/libs/useResponsive'
import { useVentasParaPreparacion, type VentaPreparacion } from '@/libs/api-client/logistica'
import { useDiasEntrega, useFeriados } from '@/libs/api-client/configuracion'
import { useVendedores } from '@/libs/api-client/ventas'
import { useAuthStore } from '@/libs/store/auth.store'
import { diaArgentina } from '@/src/utils/date'
import { useAhoraArgentina } from '@/src/utils/useAhoraArgentina'
import { nombreDelDia, proximosDiasDeEntrega } from './dias'
import { PedidoPorPrepararDetalle } from './PedidoPorPrepararDetalle'
import { FiltrosPorPreparar, SIN_FILTROS, textoFiltros, type FiltrosPreparacion } from './FiltrosPorPreparar'

/** EstadoVenta.NoEntregada: el servidor la manda siempre, sin importar el día elegido. */
const NO_ENTREGADA = 7

const semibold = { fontFamily: FONT.semibold, fontWeight: '600' as const }
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/** Láminas PedidosPorPreparar y TabPedidosPorPreparar: solo lectura, por fecha de entrega. */
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
    { fechaDesde: dia.fecha, fechaHasta: dia.fecha, metodoEntrega: filtros.metodo ?? undefined, vendedorId: filtros.vendedor?.id },
    { activa: useIsFocused() },
  )

  const items = (q.data ?? []).filter((v) => filtros.estado === null || v.estado === filtros.estado)
  const resumenFiltros = textoFiltros(filtros)
  const delDia = items.filter((v) => v.estado !== NO_ENTREGADA)
  const noEntregados = items.filter((v) => v.estado === NO_ENTREGADA)
  const lineas = delDia.reduce((s, v) => s + v.itemsCount, 0)
  const feriadoEnLaTira = dias.find((d) => feriadoDe(d.fecha))

  const tarjeta = (v: VentaPreparacion) => {
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
        {v.hojaRutaCodigo ? (
          <Text style={{ ...typeScale.secundario, ...semibold, color: c.text }}>{`En hoja ${v.hojaRutaCodigo}`}</Text>
        ) : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2], marginTop: space[1] }}>
          <Text style={{ ...typeScale.secundario, color: c.text, flex: 1 }}>{v.metodoEntregaNombre}</Text>
          <Text style={{ ...typeScale.secundario, ...semibold, color: c.text }}>
            {[plural(v.itemsCount, 'línea', 'líneas'), v.piezasCount > 0 ? plural(v.piezasCount, 'bulto', 'bultos') : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </Pressable>
    )
  }

  const lista = (
    <ScrollView contentContainerStyle={{ padding: space[4], gap: space[3] }}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Fecha de entrega" style={{ flexDirection: 'row', gap: space[1] }}>
        {dias.map((d) => {
          const feriado = !!feriadoDe(d.fecha)
          const activo = d.fecha === dia.fecha
          return (
            <Pressable
              key={d.fecha}
              disabled={feriado}
              onPress={() => { setElegida(d.fecha); setPedido(null) }}
              accessibilityRole="radio"
              accessibilityLabel={`${d.semana} ${d.numero}${d.esHoy ? ' · Hoy' : ''}${feriado ? ' · Feriado' : ''}`}
              accessibilityState={{ checked: activo, disabled: feriado }}
              style={{
                flex: 1, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: radii.campo,
                borderWidth: activo ? 2 : 1, borderColor: activo ? c.brand : c.border,
                backgroundColor: activo ? c.brandSoft : feriado ? c.surface2 : c.surface,
              }}
            >
              <Text style={{ ...typeScale.cuerpoDestacado, color: activo ? c.brandInk : feriado ? c.textSecondary : c.text, textDecorationLine: feriado ? 'line-through' : 'none' }}>{d.numero}</Text>
              <Text style={{ ...typeScale.etiqueta, color: activo ? c.brandInk : c.textSecondary }}>{d.semana}</Text>
            </Pressable>
          )
        })}
      </View>
      {feriadoEnLaTira ? (
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
          {`El ${nombreDelDia(feriadoEnLaTira)} es feriado: no hay entregas.`}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] }}>
        <Text accessibilityRole="header" style={{ ...typeScale.secundario, ...semibold, color: c.text, flex: 1 }}>
          {`${nombreDelDia(dia)} · ${plural(delDia.length, 'pedido', 'pedidos')} · ${plural(lineas, 'línea', 'líneas')}`}
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
      ) : delDia.length === 0 ? (
        <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>{resumenFiltros ? 'No hay pedidos con estos filtros ese día.' : 'No hay pedidos para entregar ese día.'}</Text>
      ) : (
        delDia.map(tarjeta)
      )}
      {noEntregados.length > 0 ? (
        <>
          <Text accessibilityRole="header" style={{ ...typeScale.secundario, ...semibold, color: c.text, marginTop: space[2] }}>
            {`No entregados, para reprogramar · ${noEntregados.length}`}
          </Text>
          {noEntregados.map(tarjeta)}
        </>
      ) : null}
    </ScrollView>
  )

  const leading = !isTabletLandscape && pedido ? { kind: 'atras' as const, onPress: () => setPedido(null) } : menu
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Por preparar" subtitle="Solo lectura · por fecha de entrega" leading={leading} />
      <TwoPane
        list={lista}
        detail={pedido ? <PedidoPorPrepararDetalle key={pedido.id} pedido={pedido} /> : null}
        emptyDetail={
          <View style={{ padding: space[6] }}>
            <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>Elegí un pedido para ver qué hay que preparar.</Text>
          </View>
        }
      />
      <FiltrosPorPreparar
        visible={filtrando}
        filtros={filtros}
        onCambio={setFiltros}
        vendedores={veVendedores ? vendedores.data ?? [] : null}
        onClose={() => setFiltrando(false)}
      />
    </View>
  )
}
