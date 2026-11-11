import React, { useCallback, useMemo, useState } from 'react'
import { RefreshControl, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Plus, Search } from 'lucide-react-native'
import { FONT, radii, space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { useAuthStore } from '@/libs/store/auth.store'
import { useResumenVendedor } from '@/libs/api-client/reportes'
import { useClientesRecientes } from '@/libs/api-client/socios'
import { Button, TopBar, formatImporte, useMenuLeading } from '@/core/ui/fw'
import { nombreMes, mesDe } from '@/src/features/reportes/mes'
import { useAhoraArgentina } from '@/core/utils/useAhoraArgentina'
import { partesArgentina } from '@/core/utils/fecha'
import { direccionDeEntrega, inicialesDeDireccion, nombreDelCliente } from '@/features/clientes/lib/cliente'
import { fusionarRecientes, leerRecientes } from '@/features/clientes/lib/recientes'
import { useVenderA } from '@/features/venta-nueva/hooks/useVenderA'
import { usePermissions } from '@/core/auth/RequirePermission'
import { DepositoSesion } from '@/features/deposito-sesion'
import { usePendientesInicio } from '../hooks/usePendientesInicio'
import { useResumenInicio } from '../api/queries'
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
  /** El hero lo nombra: es algo que el vendedor tiene que resolver ya (rechazos, vencimientos, la bandeja). */
  alerta: boolean
  onPress?: () => void
}

/**
 * Mi día del vendedor (propuesta de Inicio, frames 1 a 5; hero de la galería v2, inicio--vendedor).
 * Los números salen del servidor: el resumen del mes del vendedor (el mismo de "Mis números") y
 * /Inicio/resumen para "Para resolver hoy". El hero suma esas mismas filas: no es un dato nuevo.
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
  const nuevaVenta = puedeVender ? <Button label="Nueva venta" icon={Plus} onPress={ir('/(tabs)/ventas/nueva')} /> : null

  // ── Para resolver hoy: las filas de siempre, cada una con su punto de color ──
  const filas: Pendiente[] = []
  const v = pendientes.ventas
  if (v) {
    const p = v.presupuestos.cantidad
    if (p) {
      filas.push({ clave: 'presupuestos', cantidad: p, titulo: plural(p, 'presupuesto pendiente', 'presupuestos pendientes'), apoyo: 'Pasalos a pedido o reabrilos', punto: 'neutro', alerta: false, onPress: ir('/(tabs)/ventas?tipo=presupuestos&estado=Pendiente') })
    }
    const a = v.porAutorizar
    if (a?.cantidad) {
      filas.push(
        a.propias
          ? { clave: 'autorizar', cantidad: a.cantidad, titulo: plural(a.cantidad, 'pedido esperando autorización', 'pedidos esperando autorización'), apoyo: 'Esperando a gestión', punto: 'atencion', alerta: false, onPress: ir('/(tabs)/ventas?tipo=pedidos&estado=PendienteAutorizacion') }
          : { clave: 'autorizar', cantidad: a.cantidad, titulo: plural(a.cantidad, 'pedido por autorizar', 'pedidos por autorizar'), apoyo: 'Bandeja de autorizaciones', punto: 'atencion', alerta: true, onPress: ir('/(tabs)/autorizaciones') },
      )
    }
  }
  // Del resumen del vendedor (mismo período que las cifras). Servidor anterior: el campo no viene → sin fila, nunca 0.
  const cuenta = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0)
  const rechazados = cuenta(resumen.data?.pedidosRechazados)
  if (rechazados) {
    filas.push({ clave: 'rechazados', cantidad: rechazados, titulo: plural(rechazados, 'pedido rechazado', 'pedidos rechazados'), apoyo: 'Rechazados por gestión este mes', punto: 'peligro', alerta: true })
  }
  const porVencer = cuenta(resumen.data?.presupuestosPorVencer)
  if (porVencer) {
    filas.push({ clave: 'por-vencer', cantidad: porVencer, titulo: plural(porVencer, 'presupuesto por vencer', 'presupuestos por vencer'), apoyo: 'Cerralos o reabrilos antes de que venzan', punto: 'atencion', alerta: true })
  }

  // ── Hero: la suma de esas filas. Sin dato, "—"; "Todo al día." solo si se sabe que no hay nada ──
  const pendientesConocidos = !pendientes.error && !!v && v.presupuestos.cantidad != null
  const total = filas.reduce((s, f) => s + f.cantidad, 0)
  const todoConocido = pendientesConocidos && !!resumen.data
  const cifraHero = total > 0 ? plural(total, 'pendiente', 'pendientes') : todoConocido ? 'Todo al día.' : '—'
  const metaHero = filas.filter((f) => f.alerta).map((f) => f.titulo).join(' · ') || null
  const hero = !veVentas ? null : resumen.isLoading ? (
    <HeroCargando accessibilityLabel="Cargando tu día" />
  ) : (
    <HeroDeInicio testID="mi-dia-hero" etiqueta="Mi día" cifra={cifraHero} meta={metaHero}>{nuevaVenta}</HeroDeInicio>
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
        <Cifra etiqueta="Por cobrar" importe={resumen.data.cobrosPendientes.total} />
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

  // Sin leer Ventas no hay hero: "Nueva venta" (si puede crear) queda suelta, con el mismo permiso de siempre.
  const nuevaVentaSuelta = !veVentas ? nuevaVenta : null
  const fecha = `${DIAS[hoy.diaSemana]} ${hoy.dia} de ${MESES[hoy.mes]}`
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar
        title={`Hola, ${nombre}`.trim()}
        subtitle={fecha}
        leading={menu}
        actions={[{ icon: Search, accessibilityLabel: 'Buscar', onPress: () => router.push('/buscar') }]}
      />
      <ScrollView
        testID="mi-dia-scroll"
        contentContainerStyle={{ padding: space[4], gap: space[5], paddingBottom: space[12] }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={c.brand} />}
      >
        {/* Depósito de la sesión (S8): solo con CAP_VER_TODOS_LOS_DEPOSITOS; sin ella no ocupa lugar. */}
        <DepositoSesion />
        {isTablet ? (
          <View style={{ flexDirection: 'row', gap: space[6], alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: space[5] }}>{hero}{nuevaVentaSuelta}{numeros}</View>
            <View style={{ flex: 1, gap: space[5] }}>{resolver}{venderDeNuevo}</View>
          </View>
        ) : (
          <>
            {hero}
            {nuevaVentaSuelta}
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
