import React, { useCallback, useEffect, useState } from 'react'
import { AppState, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useNavigation, useRouter } from 'expo-router'
import { DrawerActions } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Search, ShoppingBag, Tag } from 'lucide-react-native'
import { FONT, radii, space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { puedeVerVentas } from '@/src/components/layout/menuModules'
import { useAuthStore } from '@/libs/store/auth.store'
import { useVentas } from '@/libs/api-client/ventas'
import type { Venta } from '@/libs/api-client/types'
import { DocumentCard, TopBar, chipForEstado, iniciales } from '@/core/ui/fw'
import { diaArgentina, msHastaProximaMedianocheArgentina, partesArgentina } from '@/src/utils/date'
import { useHojasDeRuta } from '@/libs/api-client/logistica'
import { usePendientesInicio } from '../hooks/usePendientesInicio'
import { useCifrasGenerales } from '../api/queries'
import { PulsoDelNegocio } from './PulsoDelNegocio'
import { AtajosDeInicio } from './AtajosDeInicio'
import { TarjetaPendientes, type FilaPendiente } from './TarjetaPendientes'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const dos = (n: number) => String(n).padStart(2, '0')
const ANCHO_TARJETA_TELEFONO = 240

/** Inicio (láminas Main y TabInicio): pendientes por módulo y lo de hoy. */
export function InicioScreen() {
  const c = useColors()
  const router = useRouter()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
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

  const tarjetas: React.ReactNode[] = []
  const ancho = tablet ? 'flex' : ANCHO_TARJETA_TELEFONO
  if (pendientes.ventas) {
    const v = pendientes.ventas
    const filas: FilaPendiente[] = [
      { label: 'Presupuestos', ...v.presupuestos, onPress: ir('/(tabs)/ventas?tipo=presupuestos&estado=Pendiente') },
      { label: 'Pedidos confirmados', ...v.pedidos, onPress: ir('/(tabs)/ventas?tipo=pedidos&estado=Confirmada') },
    ]
    // Sin CAP_AUTORIZAR_VENTA no hay bandeja: son las suyas que esperan, y se ven en Ventas.
    if (v.porAutorizar) {
      filas.push(v.porAutorizar.propias
        ? { label: 'Esperando autorización', ...v.porAutorizar, alerta: true, onPress: ir('/(tabs)/ventas?tipo=pedidos&estado=PendienteAutorizacion') }
        : { label: 'Por autorizar', ...v.porAutorizar, alerta: true, onPress: aAutorizaciones })
    }
    tarjetas.push(<TarjetaPendientes key="ventas" titulo="Ventas" icono={Tag} filas={filas} ancho={ancho} />)
  }
  if (pendientes.compras) {
    const k = pendientes.compras
    const filas: FilaPendiente[] = [
      { label: 'Notas de pedido', ...k.notasPedido, onPress: ir('/(tabs)/compras?estado=NotaPedido') },
      { label: 'Por recibir', ...k.porRecibir, onPress: ir('/(tabs)/compras?estado=Confirmado') },
    ]
    tarjetas.push(<TarjetaPendientes key="compras" titulo="Compras" icono={ShoppingBag} filas={filas} ancho={ancho} />)
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar
        title="Inicio"
        leading={{ kind: 'menu', onPress: () => navigation.dispatch(DrawerActions.openDrawer()) }}
        actions={[{ icon: Search, accessibilityLabel: 'Buscar', onPress: () => router.push('/buscar') }]}
      />
      <ScrollView
        testID="inicio-scroll"
        contentContainerStyle={{ paddingTop: space[4], gap: space[4], paddingBottom: (tablet ? insets.bottom : 0) + space[4] }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={c.brand} />}
      >
        <View style={{ paddingHorizontal: space[4], flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <View style={{ width: 44, height: 44, borderRadius: radii.pastilla, backgroundColor: c.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={[typeScale.cuerpoDestacado, { color: c.brandInk }]}>{iniciales(nombre || '?')}</Text>
          </View>
          <View>
            <Text style={[typeScale.secundario, { color: c.textSecondary }]}>
              {`${DIAS[hoy.diaSemana]} ${hoy.dia} de ${MESES[hoy.mes]}`}
            </Text>
            <Text style={[typeScale.seccion, { color: c.text }]}>{`Hola, ${nombre.split(' ')[0] || ''}`.trim()}</Text>
          </View>
        </View>

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
          />
        ) : null}
        <AtajosDeInicio
          puede={{ vender: canDo('MOD_VENTAS', 'create'), cobrar: canDo('MOD_CC', 'read'), catalogo: canDo('MOD_CATALOGO', 'read'), stock: canDo('MOD_STOCK', 'read') }}
          onIr={(ruta) => router.push(ruta as never)}
        />

        {pendientes.error ? (
          <View style={{ paddingHorizontal: space[4], gap: space[2], alignItems: 'flex-start' }}>
            <Text style={[typeScale.secundario, { color: c.textSecondary }]}>No se pudieron cargar los pendientes</Text>
            {pendientes.error.motivo ? (
              <Text style={[typeScale.secundario, { color: c.text }]}>{pendientes.error.motivo}</Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reintentar pendientes"
              onPress={() => pendientes.refetch()}
              style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}
            >
              <Text style={[typeScale.secundario, { color: c.brandInk, fontFamily: FONT.semibold, fontWeight: '600' }]}>Reintentar</Text>
            </Pressable>
          </View>
        ) : null}

        {tarjetas.length > 0 &&
          (tablet ? (
            <View testID="inicio-pendientes" style={{ flexDirection: 'row', gap: space[3], paddingHorizontal: space[4] }}>
              {tarjetas}
            </View>
          ) : (
            <ScrollView
              testID="inicio-pendientes"
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: space[3], paddingHorizontal: space[4], paddingBottom: space[2] }}
            >
              {tarjetas}
            </ScrollView>
          ))}

        {canDo('MOD_VENTAS', 'read') && (
          <View style={{ paddingHorizontal: space[4], gap: space[3] }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text accessibilityRole="header" style={[typeScale.seccion, { color: c.text }]}>Reciente · Hoy</Text>
              {/* Mismo criterio que la pantalla de Ventas: el chofer lee ventas pero ahí lo bloquean. */}
              {puedeVerVentas(canDo) ? (
                <Pressable
                  accessibilityRole="link"
                  onPress={aVentas}
                  style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}
                >
                  <Text style={[typeScale.secundario, { color: c.brandInk, fontFamily: FONT.semibold, fontWeight: '600' }]}>Ver todo</Text>
                </Pressable>
              ) : null}
            </View>
            {recientes.isError && !recientes.data ? (
              <View style={{ gap: space[2], alignItems: 'flex-start' }}>
                <Text style={[typeScale.secundario, { color: c.textSecondary }]}>No se pudieron cargar las ventas de hoy</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => recientes.refetch()}
                  style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}
                >
                  <Text style={[typeScale.secundario, { color: c.brandInk, fontFamily: FONT.semibold, fontWeight: '600' }]}>Reintentar</Text>
                </Pressable>
              </View>
            ) : ventasHoy.length === 0 ? (
              <Text style={[typeScale.secundario, { color: c.textSecondary }]}>
                {recientes.isLoading ? 'Cargando…' : 'Todavía no hay ventas hoy.'}
              </Text>
            ) : (
              <View testID="inicio-recientes" style={{ flexDirection: 'row', gap: space[3] }}>
                {columnas.map((col, i) => (
                  <View key={i} style={{ flex: 1, gap: space[3] }}>
                    {col.map((v) => (
                      <TarjetaVenta key={v.id} venta={v} onPress={() => router.push(`/(tabs)/ventas/${v.id}`)} />
                    ))}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

/** Venta → DocumentCard: la dirección es el título y el nombre va en su propia línea. */
function TarjetaVenta({ venta: v, onPress }: { venta: Venta; onPress: () => void }) {
  const f = partesArgentina(new Date(v.fecha).getTime())
  const tipo = v.tipoOperacion === 1 ? 'Presupuesto' : 'Pedido'
  return (
    <DocumentCard
      numero={[tipo, v.codigoPedido].filter(Boolean).join(' ')}
      vendedor={v.vendedorNombre}
      direccion={v.direccionCliente || v.displayNameCliente}
      nombre={v.direccionCliente ? v.displayNameCliente : null}
      hora={`${dos(f.hora)}:${dos(f.minuto)}`}
      importe={v.totalAmount}
      chip={chipForEstado('venta', v.estado)}
      onPress={onPress}
    />
  )
}
