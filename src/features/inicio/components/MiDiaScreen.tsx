import React, { useCallback, useMemo, useState } from 'react'
import { RefreshControl, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Plus, Search } from 'lucide-react-native'
import { useVentas } from '@/libs/api-client/ventas'
import { FONT, radii, space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { useAuthStore } from '@/libs/store/auth.store'
import { useResumenVendedor } from '@/libs/api-client/reportes'
import { useClientesRecientes } from '@/libs/api-client/socios'
import { Button, TopBar, formatImporte, useMenuLeading, useInsetInferior } from '@/core/ui/fw'
import { nombreMes, mesDe } from '@/src/features/reportes/mes'
import { useAhoraArgentina } from '@/core/utils/useAhoraArgentina'
import { diaArgentina, partesArgentina } from '@/core/utils/fecha'
import { direccionDeEntrega, inicialesDeDireccion, nombreDelCliente } from '@/features/clientes/lib/cliente'
import { fusionarRecientes, leerRecientes } from '@/features/clientes/lib/recientes'
import { useVenderA } from '@/features/venta-nueva/hooks/useVenderA'
import { usePermissions } from '@/core/auth/RequirePermission'
import { DepositoSesion } from '@/features/deposito-sesion'
import { usePendientesInicio } from '../hooks/usePendientesInicio'
import { useDashboardResumen, useResumenInicio } from '../api/queries'
import { DeudoresDeInicio } from './DeudoresDeInicio'
import { MosaicoDeInicio } from './MosaicoDeInicio'
import {
  BloqueCargando,
  ErrorConReintentar,
  FilaDeInicio,
  HeroCargando,
  HeroDeInicio,
  ImporteDeFila,
  ListaEnTarjeta,
  SeccionDeInicio,
  TarjetaDeTexto,
  type TonoPunto,
} from './PiezasDeInicio'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

interface Pendiente {
  clave: string
  cantidad: number
  titulo: string
  apoyo: string
  punto: TonoPunto
  onPress?: () => void
}

/**
 * Mi día del vendedor (propuesta de Inicio, frames 1 a 5; hero de la galería v2, inicio--vendedor).
 * Los números salen del servidor: el resumen del mes del vendedor (el mismo de "Mis números") y
 * /Inicio/resumen para "Para resolver hoy". El hero suma esas mismas filas: no es un dato nuevo.
 */
export function MiDiaScreen() {
  const insetInferior = useInsetInferior()
  const c = useColors()
  const router = useRouter()
  const menu = useMenuLeading()
  const { isTablet } = useResponsive()
  const user = useAuthStore((s) => s.user)
  const ahora = useAhoraArgentina()
  const hoy = partesArgentina(ahora)
  const mes = mesDe(ahora)
  const pendientes = usePendientesInicio()
  // Cada endpoint pide su permiso (Ventas:Read el resumen, Clientes:Read los recientes): sin él no se llama (403).
  const { canDo } = usePermissions()
  const veVentas = canDo('MOD_VENTAS', 'read')
  const resumen = useResumenVendedor({ anio: mes.anio, mes: mes.mes }, null, veVentas)
  // La misma consulta que usa usePendientesInicio (misma clave, una sola llamada): solo para saber si sigue cargando.
  const cargandoPendientes = useResumenInicio(veVentas || canDo('MOD_COMPRAS', 'read')).isLoading
  const recientesServidor = useClientesRecientes(canDo('MOD_CLIENTES', 'read'))
  const recientes = useMemo(
    () => fusionarRecientes(recientesServidor.data, leerRecientes(user?.id)),
    // `ahora` cambia al volver a enfocar la pantalla: vuelve a leer los del teléfono.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recientesServidor.data, user?.id, ahora],
  )
  // Un reciente abre la venta con ese cliente; sin permiso para vender, su ficha.
  const venderA = useVenderA()
  // "Nueva venta" pide lo mismo que el "+" de la barra: poder crear ventas (decisión del dueño 22-10).
  const puedeVender = canDo('MOD_VENTAS', 'create')
  const nombre = user?.nombre || user?.username || ''

  const [refrescando, setRefrescando] = useState(false)
  const refrescar = useCallback(async () => {
    setRefrescando(true)
    await Promise.all([resumen.refetch(), pendientes.refetch(), recientesServidor.refetch()])
    setRefrescando(false)
  }, [resumen, pendientes, recientesServidor])

  const ir = (ruta: string) => () => router.push(ruta as never)
  // En teléfono "Nueva venta" es el botón central de la barra inferior; en tablet no hay barra y va en el hero.
  const nuevaVentaEnTablet = isTablet && puedeVender ? <Button label="Nueva venta" icon={Plus} onPress={ir('/(tabs)/ventas/nueva')} /> : null

  // ── Para resolver hoy: las filas de siempre, cada una con su punto de color ──
  const filas: Pendiente[] = []
  const v = pendientes.ventas
  if (v) {
    const p = v.presupuestos.cantidad
    if (p) {
      filas.push({ clave: 'presupuestos', cantidad: p, titulo: plural(p, 'presupuesto pendiente', 'presupuestos pendientes'), apoyo: 'Pasalos a pedido o reabrilos', punto: 'neutro', onPress: ir('/(tabs)/ventas?tipo=presupuestos&estado=Pendiente') })
    }
    const a = v.porAutorizar
    if (a?.cantidad) {
      filas.push(
        a.propias
          ? { clave: 'autorizar', cantidad: a.cantidad, titulo: plural(a.cantidad, 'pedido esperando autorización', 'pedidos esperando autorización'), apoyo: 'Esperando a gestión', punto: 'atencion', onPress: ir('/(tabs)/ventas?tipo=pedidos&estado=PendienteAutorizacion') }
          : { clave: 'autorizar', cantidad: a.cantidad, titulo: plural(a.cantidad, 'pedido por autorizar', 'pedidos por autorizar'), apoyo: 'Bandeja de autorizaciones', punto: 'atencion', onPress: ir('/(tabs)/autorizaciones') },
      )
    }
  }
  // Del resumen del vendedor (mismo período que las cifras). Servidor anterior: el campo no viene → sin fila, nunca 0.
  const cuenta = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0)
  const rechazados = cuenta(resumen.data?.pedidosRechazados)
  if (rechazados) {
    filas.push({ clave: 'rechazados', cantidad: rechazados, titulo: plural(rechazados, 'pedido rechazado', 'pedidos rechazados'), apoyo: 'Rechazados por gestión este mes', punto: 'peligro' })
  }
  const porVencer = cuenta(resumen.data?.presupuestosPorVencer)
  if (porVencer) {
    filas.push({ clave: 'por-vencer', cantidad: porVencer, titulo: plural(porVencer, 'presupuesto por vencer', 'presupuestos por vencer'), apoyo: 'Cerralos o reabrilos antes de que venzan', punto: 'atencion' })
  }

  // ── Hero: lo vendido hoy (GET /Dashboard/summary, lo propio) y cuántas ventas fueron ──
  const dia = diaArgentina(ahora)
  const ventasHoy = useDashboardResumen(veVentas)
  const cantidadHoy = useVentas({ pageNumber: 1, pageSize: 1, fechaDesde: dia, fechaHasta: dia }, { enabled: veVentas }).data?.totalCount ?? null
  const pendientesConocidos = !pendientes.error && !!v && v.presupuestos.cantidad != null
  const hero = !veVentas ? null : ventasHoy.isLoading ? (
    <HeroCargando accessibilityLabel="Cargando tu día" />
  ) : ventasHoy.isError ? (
    <ErrorConReintentar texto="No se pudieron cargar las ventas de hoy." accessibilityLabel="Reintentar ventas de hoy" onReintentar={() => ventasHoy.refetch()} />
  ) : (
    <HeroDeInicio
      testID="mi-dia-hero"
      etiqueta="Ventas de hoy"
      cifra={formatImporte(ventasHoy.data?.salesToday ?? null)}
      meta={cantidadHoy == null ? null : plural(cantidadHoy, 'venta', 'ventas')}
    >
      {nuevaVentaEnTablet}
    </HeroDeInicio>
  )
  const deudores = (
    <DeudoresDeInicio
      respaldo={!veVentas ? undefined : {
        cargando: resumen.isLoading,
        error: resumen.isError,
        datos: resumen.data ? { clientes: resumen.data.cobrosPendientes.clientes, total: resumen.data.cobrosPendientes.total } : null,
        reintentar: () => resumen.refetch(),
      }}
    />
  )
  // "Por cobrar" ya es la tarjeta Deudores (mismo total): no se repite como mosaico.
  const mosaicos = !veVentas ? null : (
    <View style={{ flexDirection: 'row', gap: space[3] }}>
      <MosaicoDeInicio etiqueta="Pedidos pendientes" valor={v ? String(v.pedidos.cantidad) : '—'} />
    </View>
  )

  const resolver = !veVentas ? null : pendientes.error ? (
    <SeccionDeInicio titulo="Para resolver hoy">
      <ErrorConReintentar texto={pendientes.error.motivo ?? 'No se pudieron cargar los pendientes'} accessibilityLabel="Reintentar pendientes" onReintentar={() => pendientes.refetch()} />
    </SeccionDeInicio>
  ) : filas.length > 0 ? (
    <SeccionDeInicio titulo="Para resolver hoy">
      <ListaEnTarjeta testID="mi-dia-resolver">
        {filas.map((f) => <FilaDeInicio key={f.clave} titulo={f.titulo} apoyo={f.apoyo} punto={f.punto} onPress={f.onPress} />)}
      </ListaEnTarjeta>
    </SeccionDeInicio>
  ) : !pendientesConocidos && cargandoPendientes ? (
    <BloqueCargando accessibilityLabel="Cargando los pendientes" />
  ) : null // Sin filas el hero ya dice "Todo al día.".

  const mesNombre = nombreMes(mes).toLowerCase()
  const numeros = !veVentas ? null : resumen.isLoading ? (
    <BloqueCargando accessibilityLabel="Cargando tus números del mes" />
  ) : resumen.isError || !resumen.data ? (
    <ErrorConReintentar texto="No se pudieron cargar tus números del mes." accessibilityLabel="Reintentar números" onReintentar={() => resumen.refetch()} />
  ) : (
    <SeccionDeInicio titulo={`Tus números de ${mesNombre}`}>
      <ListaEnTarjeta testID="mi-dia-cifras">
        <Cifra etiqueta={`Vendido en ${mesNombre}`} importe={resumen.data.ventas.facturado} />
        <Cifra etiqueta="Tu comisión" importe={resumen.data.comisiones.neto} resaltada />
      </ListaEnTarjeta>
    </SeccionDeInicio>
  )

  const venderDeNuevo = (
    <SeccionDeInicio titulo="Vender de nuevo" enlace={{ label: 'Todos los clientes', onPress: ir('/(tabs)/socios') }}>
      {recientes.length === 0 ? (
        <TarjetaDeTexto texto="Todavía no vendiste a ningún cliente desde acá." />
      ) : (
        <ListaEnTarjeta>
          {recientes.map((r) => {
            const direccion = direccionDeEntrega(r)
            return (
              <FilaDeInicio
                key={r.id}
                testID={`reciente-${r.id}`}
                titulo={direccion}
                apoyo={nombreDelCliente(r) || null}
                accessibilityLabel={direccion}
                izquierda={<Iniciales texto={inicialesDeDireccion(direccion)} />}
                onPress={() => (venderA ? router.push(venderA(r.id) as never) : router.push({ pathname: '/(tabs)/socios/[id]', params: { id: r.id } }))}
              />
            )
          })}
        </ListaEnTarjeta>
      )}
    </SeccionDeInicio>
  )

  // Sin leer Ventas no hay hero: en tablet "Nueva venta" (si puede crear) queda suelta.
  const nuevaVentaSuelta = !veVentas ? nuevaVentaEnTablet : null
  const fecha = `${DIAS[hoy.diaSemana]} ${hoy.dia} de ${MESES[hoy.mes]}`
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar
        logo
        title={`Hola, ${nombre}`.trim()}
        subtitle={fecha}
        leading={menu}
        actions={[{ icon: Search, accessibilityLabel: 'Buscar', onPress: () => router.push('/buscar') }]}
      />
      <ScrollView
        testID="mi-dia-scroll"
        contentContainerStyle={{ padding: space[4], gap: space[5], paddingBottom: space[12] + insetInferior }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={c.brand} />}
      >
        {/* Depósito de la sesión (S8): solo con CAP_VER_TODOS_LOS_DEPOSITOS; sin ella no ocupa lugar. */}
        <DepositoSesion />
        {isTablet ? (
          <View style={{ flexDirection: 'row', gap: space[6], alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: space[5] }}>{hero}{nuevaVentaSuelta}{deudores}{mosaicos}{numeros}</View>
            <View style={{ flex: 1, gap: space[5] }}>{resolver}{venderDeNuevo}</View>
          </View>
        ) : (
          <>
            {hero}
            {nuevaVentaSuelta}
            {deudores}
            {mosaicos}
            {resolver}
            {numeros}
            {venderDeNuevo}
          </>
        )}
      </ScrollView>
    </View>
  )
}

function Cifra({ etiqueta, importe, resaltada }: { etiqueta: string; importe: number; resaltada?: boolean }) {
  const texto = formatImporte(importe)
  return <FilaDeInicio titulo={etiqueta} accessibilityLabel={`${etiqueta}: ${texto}`} derecha={<ImporteDeFila texto={texto} resaltado={resaltada} />} />
}

/** Avatar con las iniciales de la dirección, como los Recientes del paso 1 de la venta. */
function Iniciales({ texto }: { texto: string }) {
  const c = useColors()
  return (
    <View style={{ width: 44, height: 44, borderRadius: radii.pastilla, backgroundColor: c.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={[typeScale.cuerpoDestacado, { fontFamily: FONT.semibold, color: c.brandInk }]}>{texto}</Text>
    </View>
  )
}
