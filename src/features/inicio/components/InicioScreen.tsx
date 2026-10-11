import React, { useCallback, useEffect, useState } from 'react'
import { AppState, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useNavigation, useRouter } from 'expo-router'
import { DrawerActions } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ShoppingBag, Tag } from 'lucide-react-native'
import { FONT, radii, space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { useAuthStore } from '@/libs/store/auth.store'
import { useVentas } from '@/libs/api-client/ventas'
import type { Venta } from '@/libs/api-client/types'
import { DocumentCard, TopBar, chipForEstado, iniciales } from '@/core/ui/fw'
import { diaArgentina, msHastaProximaMedianocheArgentina, partesArgentina } from '@/src/utils/date'
import { usePendientesInicio } from '../hooks/usePendientesInicio'
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
  const aCompras = () => router.push('/(tabs)/compras')
  const nombre = [user?.nombre, user?.apellido].filter(Boolean).join(' ') || user?.username || ''

  const tarjetas: React.ReactNode[] = []
  const ancho = tablet ? 'flex' : ANCHO_TARJETA_TELEFONO
  if (pendientes.ventas) {
    const v = pendientes.ventas
    const filas: FilaPendiente[] = [
      { label: 'Presupuestos', valor: v.presupuestos, onPress: aVentas },
      { label: 'Pedidos confirmados', valor: v.pedidos, onPress: aVentas },
    ]
    if ('porAutorizar' in v) filas.push({ label: 'Por autorizar', valor: v.porAutorizar ?? null, alerta: true, onPress: aVentas })
    tarjetas.push(<TarjetaPendientes key="ventas" titulo="Ventas" icono={Tag} filas={filas} ancho={ancho} />)
  }
  if (pendientes.compras) {
    const k = pendientes.compras
    const filas: FilaPendiente[] = [
      { label: 'Notas de pedido', valor: k.notasPedido, onPress: aCompras },
      { label: 'Por recibir', valor: k.porRecibir, onPress: aCompras },
    ]
    tarjetas.push(<TarjetaPendientes key="compras" titulo="Compras" icono={ShoppingBag} filas={filas} ancho={ancho} />)
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar
        title="Inicio"
        leading={{ kind: 'menu', onPress: () => navigation.dispatch(DrawerActions.openDrawer()) }}
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
              <Pressable
                accessibilityRole="link"
                onPress={aVentas}
                style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}
              >
                <Text style={[typeScale.secundario, { color: c.brandInk, fontFamily: FONT.semibold, fontWeight: '600' }]}>Ver todo</Text>
              </Pressable>
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
