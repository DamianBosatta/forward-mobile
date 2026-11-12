import React, { useCallback, useEffect, useState } from 'react'
import { AppState, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useNavigation, useRouter } from 'expo-router'
import { DrawerActions } from "expo-router/react-navigation"
import { Search } from 'lucide-react-native'
import { importe, space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { puedeVerVentas } from '@/src/components/layout/menuModules'
import { useAuthStore } from '@/libs/store/auth.store'
import { useVentas } from '@/libs/api-client/ventas'
import type { Venta } from '@/libs/api-client/types'
import { StatusChip, TopBar, chipForEstado, formatImporte, useInsetInferior } from '@/core/ui/fw'
import { diaArgentina, msHastaProximaMedianocheArgentina, partesArgentina } from '@/core/utils/fecha'
import { useHojasDeRuta } from '@/libs/api-client/logistica'
import { DepositoSesion } from '@/features/deposito-sesion'
import { usePendientesInicio } from '../hooks/usePendientesInicio'
import { useCifrasGenerales, useDashboardResumen } from '../api/queries'
import { PulsoDelNegocio } from './PulsoDelNegocio'
import { AtajosDeInicio } from './AtajosDeInicio'
import { ParaResolver, type FilaParaResolver } from './ParaResolver'
import { BloqueCargando, ErrorConReintentar, ListaEnTarjeta, SeccionDeInicio, TarjetaDeTexto } from './PiezasDeInicio'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const dos = (n: number) => String(n).padStart(2, '0')

/** Inicio de gestión (propuesta de Inicio, frames 6 a 9): el pulso del negocio, los pendientes en "Para resolver" y lo de hoy. */
export function InicioScreen() {
  const c = useColors()
  const router = useRouter()
  const navigation = useNavigation()
  const insetInferior = useInsetInferior()
  const { width } = useResponsive()
  const tablet = width >= 600
  const { user, canDo } = useAuthStore()
  const pendientes = usePendientesInicio()

  // "Hoy" es el día argentino (lo que interpreta el servidor), no el del teléfono; se recalcula al volver a la app, al refrescar y al cruzar la medianoche argentina.
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') setAhora(Date.now())
    })
    return () => sub.remove()
  }, [])
  // Con la pantalla abierta al cruzar la medianoche: un timer hasta la próxima 00:00 argentina; al cambiar `ahora` se reprograma.
  useEffect(() => {
    const t = setTimeout(() => setAhora(Date.now()), msHastaProximaMedianocheArgentina(ahora))
    return () => clearTimeout(t)
  }, [ahora])
  const hoy = partesArgentina(ahora)
  const dia = diaArgentina(ahora)
  const recientes = useVentas(
    { pageNumber: 1, pageSize: 6, fechaDesde: dia, fechaHasta: dia },
    { enabled: canDo('MOD_VENTAS', 'read') },
  )
  const ventasHoy: Venta[] = recientes.data?.items ?? []
  // Mismo GET /Dashboard/summary que las cifras (misma clave, una sola llamada); también lo pide quien solo ve Stock, por las alertas.
  const alertasStock = useDashboardResumen(canDo('MOD_STOCK', 'read')).data?.lowStockAlerts ?? null
  const cifras = useCifrasGenerales(canDo('MOD_PAGOS', 'read'), canDo('MOD_VENTAS', 'read'))
  // Rutas activas: hojas de ruta En curso (EstadoHojaRuta.EnCurso = 2), solo con acceso a Viajes.
  const rutas = useHojasDeRuta({ estado: 2 }, { enabled: canDo('MOD_VIAJES', 'read') })
  // Tablet: "Reciente" en dos columnas (plan §8), alternando para conservar el orden de lectura.
  const columnas = tablet ? [ventasHoy.filter((_, i) => i % 2 === 0), ventasHoy.filter((_, i) => i % 2 === 1)] : [ventasHoy]

  const [refrescando, setRefrescando] = useState(false)
  const refrescar = useCallback(async () => {
    setRefrescando(true)
    const nuevo = Date.now()
    setAhora(nuevo)
    // Si el día cambió, la consulta de la clave nueva se pide sola: no se espera la de la clave vieja.
    const mismoDia = diaArgentina(nuevo) === dia
    await Promise.all([pendientes.refetch(), mismoDia ? recientes.refetch() : Promise.resolve()])
    setRefrescando(false)
  }, [pendientes, recientes, dia])

  const aVentas = () => router.push('/(tabs)/ventas')
  // Cada fila abre su lista filtrada por lo mismo que cuenta el resumen (InicioResumenDto), sin fecha.
  const ir = (ruta: string) => () => router.push(ruta as never)
  const aAutorizaciones = () => router.push('/(tabs)/autorizaciones')
  const nombre = [user?.nombre, user?.apellido].filter(Boolean).join(' ') || user?.username || ''

  const porAutorizar = pendientes.ventas?.porAutorizar
  type Nombre = [string, string]
  // Textos de la galería v2 (frame 7): la cantidad va en el título y el punto de color reemplaza a la pastilla.
  const paraResolver: FilaParaResolver[] = [
    ...(porAutorizar
      ? [porAutorizar.propias
          ? { nombre: ['pedido esperando autorización', 'pedidos esperando autorización'] as Nombre, detalle: 'Tus ventas esperando el OK', cantidad: porAutorizar.cantidad, punto: 'atencion' as const, onPress: ir('/(tabs)/ventas?tipo=pedidos&estado=PendienteAutorizacion') }
          : { nombre: ['pedido por autorizar', 'pedidos por autorizar'] as Nombre, detalle: 'Bandeja de autorizaciones', cantidad: porAutorizar.cantidad, punto: 'atencion' as const, onPress: aAutorizaciones }]
      : []),
    ...(canDo('MOD_STOCK', 'read')
      ? [{ nombre: ['producto bajo el mínimo', 'productos bajo el mínimo'] as Nombre, detalle: 'Alertas de stock', cantidad: alertasStock, punto: 'peligro' as const, onPress: ir('/(tabs)/inventario/stock') }]
      : []),
    ...(pendientes.compras
      ? [{ nombre: ['compra por recibir', 'compras por recibir'] as Nombre, detalle: 'Confirmadas, sin recepción', cantidad: pendientes.compras.porRecibir.cantidad, punto: 'info' as const, onPress: ir('/(tabs)/compras?estado=Confirmado') }]
      : []),
  ]

  const atajos = (
    <AtajosDeInicio
      puede={{ vender: canDo('MOD_VENTAS', 'create'), cobrar: canDo('MOD_CC', 'read'), catalogo: canDo('MOD_CATALOGO', 'read'), stock: canDo('MOD_STOCK', 'read') }}
      onIr={(ruta) => router.push(ruta as never)}
    />
  )

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar
        logo
        title={`Hola, ${nombre.split(' ')[0] || ''}`.trim()}
        subtitle={`${DIAS[hoy.diaSemana]} ${hoy.dia} de ${MESES[hoy.mes]}`}
        leading={{ kind: 'menu', onPress: () => navigation.dispatch(DrawerActions.openDrawer()) }}
        actions={[{ icon: Search, accessibilityLabel: 'Buscar', onPress: () => router.push('/buscar') }]}
      />
      <ScrollView
        testID="inicio-scroll"
        contentContainerStyle={{ paddingTop: space[4], gap: space[4], paddingBottom: insetInferior + space[4] }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={c.brand} />}
      >
        {/* Depósito de la sesión (S8): solo con CAP_VER_TODOS_LOS_DEPOSITOS; sin ella no ocupa lugar. */}
        <DepositoSesion style={{ paddingHorizontal: space[4] }} />
        {canDo('MOD_VENTAS', 'read') ? (
          <PulsoDelNegocio
            ventasDelDia={cifras.ventasDelDia}
            cantidadVentas={recientes.data?.totalCount ?? null}
            pedidosPendientes={pendientes.ventas?.pedidos.cantidad ?? null}
            rutasActivas={rutas.data?.length ?? null}
            meDeben={cifras.meDeben}
            debo={cifras.debo}
            deudaVencida={cifras.deudaVencida}
            onRutas={canDo('MOD_VIAJES', 'read') ? () => router.push('/(tabs)/logistica/hojas' as never) : undefined}
          >
            {atajos}
          </PulsoDelNegocio>
        ) : (
          // Sin leer Ventas no hay hero (igual que hoy): solo los atajos que su permiso deja.
          <View style={{ paddingHorizontal: space[4] }}>{atajos}</View>
        )}

        <ParaResolver filas={paraResolver} />

        {pendientes.error ? (
          <View style={{ paddingHorizontal: space[4] }}>
            <ErrorConReintentar
              texto="No se pudieron cargar los pendientes"
              detalle={pendientes.error.motivo}
              accessibilityLabel="Reintentar pendientes"
              onReintentar={() => pendientes.refetch()}
            />
          </View>
        ) : null}

        {canDo('MOD_VENTAS', 'read') && (
          <View style={{ paddingHorizontal: space[4] }}>
            {/* "Ver todo": mismo criterio que la pantalla de Ventas; el chofer lee ventas pero ahí lo bloquean. */}
            <SeccionDeInicio titulo="Reciente · Hoy" enlace={puedeVerVentas(canDo) ? { label: 'Ver todo', onPress: aVentas } : null}>
              {recientes.isError && !recientes.data ? (
                <ErrorConReintentar texto="No se pudieron cargar las ventas de hoy" accessibilityLabel="Reintentar" onReintentar={() => recientes.refetch()} />
              ) : ventasHoy.length === 0 ? (
                recientes.isLoading ? <BloqueCargando accessibilityLabel="Cargando las ventas de hoy" /> : <TarjetaDeTexto texto="Todavía no hay ventas hoy." />
              ) : (
                <View testID="inicio-recientes" style={{ flexDirection: 'row', gap: space[3], alignItems: 'flex-start' }}>
                  {columnas.map((col, i) => (
                    <View key={i} style={{ flex: 1 }}>
                      <ListaEnTarjeta>
                        {col.map((v) => (
                          <FilaDeVenta key={v.id} venta={v} onPress={() => router.push(`/(tabs)/ventas/${v.id}`)} />
                        ))}
                      </ListaEnTarjeta>
                    </View>
                  ))}
                </View>
              )}
            </SeccionDeInicio>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

/** Una venta de hoy como fila de una tarjeta (frame 7): dirección de título, nombre, número y hora; importe y chip a la derecha. */
function FilaDeVenta({ venta: v, onPress }: { venta: Venta; onPress: () => void }) {
  const c = useColors()
  const f = partesArgentina(new Date(v.fecha).getTime())
  const tipo = v.tipoOperacion === 1 ? 'Presupuesto' : 'Pedido'
  const numeroYHora = `${[tipo, v.codigoPedido].filter(Boolean).join(' ')} · ${dos(f.hora)}:${dos(f.minuto)}`
  const direccion = v.direccionCliente || v.displayNameCliente
  const nombre = v.direccionCliente ? v.displayNameCliente : null
  const monto = formatImporte(v.totalAmount)
  const chip = chipForEstado('venta', v.estado)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[numeroYHora, direccion, nombre, monto, chip?.label].filter(Boolean).join(', ')}
      onPress={onPress}
      android_ripple={{ color: c.surface2 }}
      style={{ minHeight: 64, flexDirection: 'row', alignItems: 'flex-start', gap: space[3], paddingVertical: space[3], paddingHorizontal: space[4] }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[typeScale.cuerpoDestacado, { color: c.text }]} numberOfLines={2}>{direccion}</Text>
        {nombre ? <Text style={[typeScale.secundario, { color: c.textSecondary }]} numberOfLines={1}>{nombre}</Text> : null}
        <Text style={[typeScale.secundario, { color: c.textSecondary }]} numberOfLines={1}>{numeroYHora}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: space[1] }}>
        <Text style={[typeScale.cuerpoDestacado, importe, { color: c.text }]} numberOfLines={1}>{monto}</Text>
        {chip ? <StatusChip estado={chip.estado} label={chip.label} /> : null}
      </View>
    </Pressable>
  )
}
