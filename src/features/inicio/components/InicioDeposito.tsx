import React, { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Search } from 'lucide-react-native'
import { space, useColors } from '@/libs/theme'
import { useAuthStore } from '@/libs/store/auth.store'
import { TopBar, useInsetInferior, useMenuLeading } from '@/core/ui/fw'
import { EstadoDePantalla } from '@/core/ui/fw/EstadoDePantalla'
import { useAhoraArgentina } from '@/core/utils/useAhoraArgentina'
import { partesArgentina } from '@/core/utils/fecha'
import { DepositoSesion } from '@/features/deposito-sesion'
import { usePendientesInicio } from '../hooks/usePendientesInicio'
import { useDashboardResumen } from '../api/queries'
import { BloqueCargando, ErrorConReintentar, FilaDeInicio, HeroCargando, HeroDeInicio, ListaEnTarjeta, SeccionDeInicio } from './PiezasDeInicio'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/**
 * Inicio de depósito (dirección A, "Depósito / preparación"): lo que el depósito resuelve con sus permisos de hoy,
 * sin capacidades nuevas. Stock bajo el mínimo (MOD_STOCK, `lowStockAlerts` de GET /Dashboard/summary) y compras
 * por recibir (MOD_COMPRAS, GET /Inicio/resumen). Cada bloque cubre cargando, error, vacío y sin permiso (no se muestra).
 */
export function InicioDeposito() {
  const c = useColors()
  const router = useRouter()
  const menu = useMenuLeading()
  const insetInferior = useInsetInferior()
  const { user, canDo } = useAuthStore()
  const ahora = useAhoraArgentina()
  const hoy = partesArgentina(ahora)
  const veStock = canDo('MOD_STOCK', 'read')
  const veCompras = canDo('MOD_COMPRAS', 'read')
  const dashboard = useDashboardResumen(veStock)
  const pendientes = usePendientesInicio()
  const nombre = user?.nombre || user?.username || ''

  const [refrescando, setRefrescando] = useState(false)
  const refrescar = useCallback(async () => {
    setRefrescando(true)
    await Promise.all([veStock ? dashboard.refetch() : null, pendientes.refetch()])
    setRefrescando(false)
  }, [dashboard, pendientes, veStock])

  const ir = (ruta: string) => () => router.push(ruta as never)
  const alertas = dashboard.data?.lowStockAlerts ?? null
  const porRecibir = pendientes.compras?.porRecibir.cantidad ?? null

  const hero = !veStock ? null : dashboard.isLoading ? (
    <HeroCargando accessibilityLabel="Cargando el stock" />
  ) : dashboard.isError ? (
    <ErrorConReintentar texto="No se pudo cargar el stock." accessibilityLabel="Reintentar stock" onReintentar={() => dashboard.refetch()} />
  ) : (
    <HeroDeInicio
      testID="deposito-hero"
      etiqueta="Bajo el mínimo"
      cifra={alertas == null ? '—' : alertas === 0 ? 'Todo en orden' : plural(alertas, 'producto', 'productos')}
      meta={alertas ? 'Revisá el stock antes de preparar' : null}
    />
  )

  const stock = !veStock ? null : (
    <SeccionDeInicio titulo="Stock">
      <ListaEnTarjeta testID="deposito-stock">
        <FilaDeInicio
          titulo={alertas == null ? 'Alertas de stock' : plural(alertas, 'producto bajo el mínimo', 'productos bajo el mínimo')}
          apoyo="Alertas de stock"
          punto={alertas ? 'peligro' : 'neutro'}
          onPress={ir('/(tabs)/inventario/stock')}
        />
      </ListaEnTarjeta>
    </SeccionDeInicio>
  )

  const recibir = !veCompras ? null : pendientes.error ? (
    <SeccionDeInicio titulo="Por recibir">
      <ErrorConReintentar texto={pendientes.error.motivo ?? 'No se pudieron cargar las compras por recibir.'} accessibilityLabel="Reintentar compras" onReintentar={() => pendientes.refetch()} />
    </SeccionDeInicio>
  ) : porRecibir == null ? (
    <BloqueCargando accessibilityLabel="Cargando las compras por recibir" />
  ) : (
    <SeccionDeInicio titulo="Por recibir">
      <ListaEnTarjeta testID="deposito-recibir">
        <FilaDeInicio
          titulo={porRecibir === 0 ? 'Nada por recibir' : plural(porRecibir, 'compra confirmada', 'compras confirmadas')}
          apoyo="Sin recepción"
          punto={porRecibir ? 'info' : 'neutro'}
          onPress={ir('/(tabs)/compras?estado=Confirmado')}
        />
      </ListaEnTarjeta>
    </SeccionDeInicio>
  )

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar
        logo
        title={`Hola, ${nombre}`.trim()}
        subtitle={`${DIAS[hoy.diaSemana]} ${hoy.dia} de ${MESES[hoy.mes]}`}
        leading={menu}
        actions={[{ icon: Search, accessibilityLabel: 'Buscar', onPress: () => router.push('/buscar') }]}
      />
      <ScrollView
        testID="deposito-scroll"
        contentContainerStyle={{ padding: space[4], gap: space[5], paddingBottom: space[12] + insetInferior }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={c.brand} />}
      >
        <DepositoSesion />
        {!veStock && !veCompras ? (
          <EstadoDePantalla tipo="sinPermiso" titulo="Tu usuario no tiene tableros para mostrar" />
        ) : (
          <>
            {hero}
            {stock}
            {recibir}
          </>
        )}
      </ScrollView>
    </View>
  )
}
