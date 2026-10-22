import React, { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronRight, Search } from 'lucide-react-native'
import { FONT, radii, shadowMd, space, typeScale, useColors, useIsDark } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { useAuthStore } from '@/libs/store/auth.store'
import { useResumenVendedor } from '@/libs/api-client/reportes'
import { useClientesRecientes } from '@/libs/api-client/socios'
import { Button, Notice, TopBar, formatImporte, useMenuLeading } from '@/core/ui/fw'
import { nombreMes, mesDe } from '@/src/features/reportes/mes'
import { useAhoraArgentina } from '@/src/utils/useAhoraArgentina'
import { partesArgentina } from '@/src/utils/date'
import { direccionDeEntrega, inicialesDeDireccion } from '@/features/clientes/lib/cliente'
import { fusionarRecientes, leerRecientes } from '@/features/clientes/lib/recientes'
import { useVentaNueva } from '@/features/ventas/lib/ventaNueva'
import { useVenderA } from '@/features/venta-nueva/hooks/useVenderA'
import { usePendientesInicio } from '../hooks/usePendientesInicio'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const semibold = { fontFamily: FONT.semibold, fontWeight: '600' as const }
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/**
 * Mi día del vendedor (láminas CalleMiDia y TabCalleMiDia, D3). Los números salen del servidor: el
 * resumen del mes del vendedor (el mismo de "Mis números") y /Inicio/resumen para "Para resolver hoy".
 */
export function MiDiaScreen() {
  const c = useColors()
  const router = useRouter()
  const menu = useMenuLeading()
  const { isTablet } = useResponsive()
  const user = useAuthStore((s) => s.user)
  const ahora = useAhoraArgentina()
  const hoy = partesArgentina(ahora)
  const mes = mesDe(ahora)
  const resumen = useResumenVendedor(mes.anio, mes.mes, null)
  const pendientes = usePendientesInicio()
  const recientesServidor = useClientesRecientes(true)
  const recientes = useMemo(
    () => fusionarRecientes(recientesServidor.data, leerRecientes(user?.id)),
    // `ahora` cambia al volver a enfocar la pantalla: vuelve a leer los del teléfono.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recientesServidor.data, user?.id, ahora],
  )
  const rutaVenta = useVentaNueva() ? '/(tabs)/ventas/nueva-v2' : '/(tabs)/ventas/nueva'
  // Con la venta nueva, un reciente abre la venta con ese cliente; si no, su ficha (como hasta ahora).
  const venderA = useVenderA()
  const nombre = user?.nombre || user?.username || ''

  const [refrescando, setRefrescando] = useState(false)
  const refrescar = useCallback(async () => {
    setRefrescando(true)
    await Promise.all([resumen.refetch(), pendientes.refetch(), recientesServidor.refetch()])
    setRefrescando(false)
  }, [resumen, pendientes, recientesServidor])

  const ir = (ruta: string) => () => router.push(ruta as never)
  const aVender = ir(rutaVenta)

  const cabecera = (
    <View style={{ gap: space[1] }}>
      <Text style={[typeScale.secundario, { color: c.textSecondary }]}>{`${DIAS[hoy.diaSemana]} ${hoy.dia} de ${MESES[hoy.mes]}`}</Text>
      <Text accessibilityRole="header" style={[typeScale.seccion, { color: c.text }]}>{`Hola, ${nombre}`.trim()}</Text>
    </View>
  )

  const cifras = resumen.isLoading ? (
    <ActivityIndicator color={c.brand} accessibilityLabel="Cargando tus números" />
  ) : resumen.isError || !resumen.data ? (
    <View style={{ gap: space[2], alignItems: 'flex-start' }}>
      <Notice tone="peligro">No se pudieron cargar tus números del mes.</Notice>
      <Pressable accessibilityRole="button" accessibilityLabel="Reintentar números" onPress={() => resumen.refetch()} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}>
        <Text style={[typeScale.secundario, semibold, { color: c.brandInk }]}>Reintentar</Text>
      </Pressable>
    </View>
  ) : (
    <View testID="mi-dia-cifras" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
      <Cifra etiqueta={`Vendido en ${nombreMes(mes).toLowerCase()}`} importe={resumen.data.ventas.facturado} />
      <Cifra etiqueta="Tu comisión" importe={resumen.data.comisiones.neto} />
      <Cifra etiqueta="Por cobrar" importe={resumen.data.cobrosPendientes.total} />
    </View>
  )

  const venderDeNuevo = (
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text accessibilityRole="header" style={[typeScale.seccion, { color: c.text }]}>Vender de nuevo</Text>
        <Pressable accessibilityRole="link" accessibilityLabel="Todos los clientes" onPress={ir('/(tabs)/socios')} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}>
          <Text style={[typeScale.secundario, semibold, { color: c.brandInk }]}>Todos los clientes</Text>
        </Pressable>
      </View>
      {recientes.length === 0 ? (
        <Text style={[typeScale.secundario, { color: c.textSecondary }]}>Todavía no vendiste a ningún cliente desde acá.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2] }}>
          {recientes.map((r) => {
            const direccion = direccionDeEntrega(r)
            return (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                accessibilityLabel={direccion}
                onPress={() => (venderA ? router.push(venderA(r.id) as never) : router.push({ pathname: '/(tabs)/socios/[id]', params: { id: r.id } }))}
                style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space[2], paddingHorizontal: space[3], borderRadius: radii.pastilla, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}
              >
                <View style={{ width: 28, height: 28, borderRadius: radii.pastilla, backgroundColor: c.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={[typeScale.secundario, semibold, { color: c.brandInk }]}>{inicialesDeDireccion(direccion)}</Text>
                </View>
                <Text style={[typeScale.cuerpo, { color: c.text }]} numberOfLines={1}>{direccion}</Text>
              </Pressable>
            )
          })}
        </ScrollView>
      )}
    </View>
  )

  const filas: React.ReactNode[] = []
  const v = pendientes.ventas
  if (v) {
    const p = v.presupuestos.cantidad
    if (p) {
      filas.push(
        <Fila
          key="presupuestos"
          titulo={plural(p, 'presupuesto pendiente', 'presupuestos pendientes')}
          apoyo="Pasalos a pedido o reabrilos"
          onPress={ir('/(tabs)/ventas?tipo=presupuestos&estado=Pendiente')}
        />,
      )
    }
    const a = v.porAutorizar
    if (a?.cantidad) {
      filas.push(
        a.propias ? (
          <Fila
            key="autorizar"
            alerta
            titulo={plural(a.cantidad, 'pedido esperando autorización', 'pedidos esperando autorización')}
            apoyo="Esperando a gestión"
            onPress={ir('/(tabs)/ventas?tipo=pedidos&estado=PendienteAutorizacion')}
          />
        ) : (
          <Fila key="autorizar" alerta titulo={plural(a.cantidad, 'pedido por autorizar', 'pedidos por autorizar')} apoyo="Bandeja de autorizaciones" onPress={ir('/(tabs)/autorizaciones')} />
        ),
      )
    }
  }
  const resolver = (
    <View style={{ gap: space[2] }}>
      <Text accessibilityRole="header" style={[typeScale.seccion, { color: c.text }]}>Para resolver hoy</Text>
      {pendientes.error ? (
        <View style={{ gap: space[2], alignItems: 'flex-start' }}>
          <Text style={[typeScale.secundario, { color: c.textSecondary }]}>{pendientes.error.motivo ?? 'No se pudieron cargar los pendientes'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Reintentar pendientes" onPress={() => pendientes.refetch()} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}>
            <Text style={[typeScale.secundario, semibold, { color: c.brandInk }]}>Reintentar</Text>
          </Pressable>
        </View>
      ) : filas.length > 0 ? (
        <View testID="mi-dia-resolver" style={{ gap: space[2] }}>{filas}</View>
      ) : (
        <Text style={[typeScale.secundario, { color: c.textSecondary }]}>{v ? 'Nada pendiente por ahora.' : 'Cargando…'}</Text>
      )}
    </View>
  )

  const nuevaVenta = <Button label="Nueva venta" onPress={aVender} />

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar
        title="Mi día"
        leading={menu}
        actions={[{ icon: Search, accessibilityLabel: 'Buscar', onPress: () => router.push('/buscar') }]}
      />
      <ScrollView
        testID="mi-dia-scroll"
        contentContainerStyle={{ padding: space[4], gap: space[4], paddingBottom: space[12] }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={c.brand} />}
      >
        {isTablet ? (
          <View style={{ flexDirection: 'row', gap: space[6], alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: space[4] }}>
              {cabecera}
              {cifras}
              {venderDeNuevo}
              {nuevaVenta}
            </View>
            <View style={{ flex: 1, gap: space[4] }}>{resolver}</View>
          </View>
        ) : (
          <>
            {cabecera}
            {cifras}
            {venderDeNuevo}
            {resolver}
            {nuevaVenta}
          </>
        )}
      </ScrollView>
    </View>
  )
}

function Cifra({ etiqueta, importe }: { etiqueta: string; importe: number }) {
  const c = useColors()
  const sombra = shadowMd[useIsDark() ? 'dark' : 'light']
  return (
    <View
      accessible
      accessibilityLabel={`${etiqueta}: ${formatImporte(importe)}`}
      style={{ flexGrow: 1, flexBasis: '28%', minWidth: 96, backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[3], gap: space[1], ...sombra }}
    >
      <Text style={[typeScale.secundario, { color: c.textSecondary }]}>{etiqueta}</Text>
      <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>{formatImporte(importe)}</Text>
    </View>
  )
}

function Fila({ titulo, apoyo, alerta, onPress }: { titulo: string; apoyo: string; alerta?: boolean; onPress: () => void }) {
  const c = useColors()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${titulo}. ${apoyo}`}
      onPress={onPress}
      style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[3], borderRadius: radii.tarjeta, borderWidth: 1, borderColor: alerta ? c.warning : c.border, backgroundColor: c.surface }}
    >
      <View style={{ flex: 1 }}>
        <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>{titulo}</Text>
        <Text style={[typeScale.secundario, { color: c.textSecondary }]}>{apoyo}</Text>
      </View>
      <ChevronRight size={20} color={c.textSecondary} />
    </Pressable>
  )
}
