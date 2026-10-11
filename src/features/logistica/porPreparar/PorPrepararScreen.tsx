import React, { useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { FONT, radii, shadowMd, space, typeScale, useColors, useIsDark } from '@/libs/theme'
import { Notice, StatusChip, TopBar, TwoPane, chipForEstado, useMenuLeading } from '@/core/ui/fw'
import { useResponsive } from '@/libs/useResponsive'
import { useVentasParaPreparacion, type VentaPreparacion } from '@/libs/api-client/logistica'
import { useFeriados } from '@/libs/api-client/configuracion'
import { nombreDelDia, proximosDiasDeEntrega } from './dias'
import { PedidoPorPrepararDetalle } from './PedidoPorPrepararDetalle'

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
  const dias = useMemo(() => proximosDiasDeEntrega(Date.now()), [])
  const feriados = useFeriados(dias[0].fecha)
  const feriadoDe = (fecha: string) => feriados.data?.find((f) => f.fecha?.slice(0, 10) === fecha)
  const [elegida, setElegida] = useState<string | null>(null)
  const dia = dias.find((d) => d.fecha === elegida) ?? dias.find((d) => !feriadoDe(d.fecha)) ?? dias[0]
  const [pedido, setPedido] = useState<VentaPreparacion | null>(null)
  const q = useVentasParaPreparacion({ fechaDesde: dia.fecha, fechaHasta: dia.fecha })

  const items = q.data ?? []
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
      <Text accessibilityRole="header" style={{ ...typeScale.secundario, ...semibold, color: c.text }}>
        {`${nombreDelDia(dia)} · ${plural(delDia.length, 'pedido', 'pedidos')} · ${plural(lineas, 'línea', 'líneas')}`}
      </Text>
      {q.isLoading ? (
        <ActivityIndicator color={c.brand} accessibilityLabel="Cargando los pedidos" />
      ) : q.isError ? (
        <Notice tone="peligro">No se pudieron cargar los pedidos.</Notice>
      ) : delDia.length === 0 ? (
        <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>No hay pedidos para entregar ese día.</Text>
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
    </View>
  )
}
