import React, { useEffect, useMemo, useState } from 'react'
import { useIsFocused } from 'expo-router/react-navigation'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { Filter } from 'lucide-react-native'
import { space, typeScale, useColors } from '@/libs/theme'
import { Notice, TopBar, useMenuLeading, pesoSemibold } from '@/core/ui/fw'
import { FiltroChip } from '@/core/ui/fw/FiltroChip'
import { EstadoDePantalla, textoSinConexion } from '@/core/ui/fw/EstadoDePantalla'
import { esFallaDeRed } from '@/core/api/errores'
import { useResponsive } from '@/libs/useResponsive'
import { useConteosPreparacion, useVentasParaPreparacion } from '@/libs/api-client/logistica'
import { useDepositos } from '@/libs/api-client/depositos'
import { useVendedores } from '@/libs/api-client/ventas'
import { useAuthStore } from '@/libs/store/auth.store'
import { hasCapability } from '@/features/auth/lib/capabilities'
import { useDepositoSesionEfectivo } from '@/features/deposito-sesion/hooks/useDepositoDeSesion'
import { useDiasEntrega, useFeriados } from '@/libs/api-client/configuracion'
import { diaArgentina } from '@/core/utils/fecha'
import { useAhoraArgentina } from '@/core/utils/useAhoraArgentina'
import { PedidoPorPrepararDetalle } from '@/features/logistica/porPreparar/PedidoPorPrepararDetalle'
import { ATAJOS_ENTREGA, COLUMNAS, atajoDeRango, conteosDeColumnas, rangoDeAtajo, repartirEnColumnas, textoTotalDelDia, totalDelDia, type ColumnaId, type VentaTablero } from './tablero'
import { nombreDelDia, proximosDiasDeEntrega } from './dias'
import { TiraDeDias } from './TiraDeDias'
import { ColumnaTablero } from './ColumnaTablero'
import { PestanasEstado } from './PestanasEstado'
import { DepositoDelTablero, ElegirDepositoSheet, ErrorTablero, SinAccesoPreparacion, TableroEsqueleto, TableroVacio } from './EstadosTablero'
import { FiltrosTableroSheet, filtrosDeApertura, type FiltrosTablero } from './FiltrosTablero'

const AVISO = 'Desde el teléfono solo se ven. Preparar, empacar y reprogramar se hace en la web.'
const AVISO_NO_ENTREGADO = 'Desde el teléfono solo se ven. Reprogramar o anular se hace en la web.'

/**
 * Preparación de pedidos (S15): el tablero de picking de la web, solo para ver. Cuatro columnas por estado; en el
 * teléfono, una por vez con pestañas 2 x 2; en una tablet de 900 px o más, las cuatro lado a lado. Ninguna acción
 * cambia datos: solo GET a `ventas-para-preparacion` y `preparacion/conteos`, como la web.
 */
export function PreparacionScreen() {
  const puedeVer = useAuthStore((s) => s.canDo('MOD_VIAJES', 'read'))
  if (!puedeVer) {
    return (
      <Marco>
        <SinAccesoPreparacion />
      </Marco>
    )
  }
  return <Tablero />
}

function Marco({ children, leading }: { children: React.ReactNode; leading?: { kind: 'menu' | 'atras'; onPress: () => void } }) {
  const c = useColors()
  const menu = useMenuLeading()
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Preparación de pedidos" subtitle="Solo consulta · se actualiza solo" leading={leading ?? menu} />
      {children}
    </View>
  )
}

function Tablero() {
  const c = useColors()
  const { isTabletLandscape } = useResponsive()
  const ahora = useAhoraArgentina()
  const hoy = diaArgentina(ahora)
  const [filtros, setFiltros] = useState<FiltrosTablero>(() => filtrosDeApertura(hoy))
  // Al cambiar el día argentino el tablero vuelve a abrir en el día nuevo.
  useEffect(() => { setFiltros(filtrosDeApertura(hoy)) }, [hoy])
  // Tira de próximos días de entrega: los habilita el servidor y los feriados se marcan aparte.
  const diasEntrega = useDiasEntrega().data
  const dias = useMemo(() => proximosDiasDeEntrega(ahora, diasEntrega), [hoy, diasEntrega]) // eslint-disable-line react-hooks/exhaustive-deps
  const feriados = useFeriados(dias[0].fecha)
  const esFeriado = (fecha: string) => !!feriados.data?.some((f) => f.fecha?.slice(0, 10) === fecha)
  const [pestana, setPestana] = useState<ColumnaId>('aPreparar')
  const [pedido, setPedido] = useState<VentaTablero | null>(null)
  const [filtrando, setFiltrando] = useState(false)

  // Depósito (DepositoDelTablero): sin CAP_VER_TODOS_LOS_DEPOSITOS el servidor ya recorta al del usuario y el
  // parámetro no viaja. Por capacidad, nunca por rol (X3).
  const permisos = useAuthStore((s) => s.user?.permissions)
  const depositoPropio = useAuthStore((s) => s.user?.depositoId)
  const veTodos = hasCapability(permisos, 'CAP_VER_TODOS_LOS_DEPOSITOS')
  const depositos = useDepositos()
  const nombrePropio = depositos.data?.find((d) => d.id === depositoPropio)?.nombre ?? undefined
  // Quien ve todos arranca en el depósito de la sesión (S8, como la web: el de Inicio; null = todos) y acá puede
  // mirar otro sin cambiar la sesión. Solo ese depósito viaja como DepositoId.
  const depositoDeSesion = useDepositoSesionEfectivo()
  const [elegidoEnTablero, setDepositoElegido] = useState<string | null | undefined>(undefined)
  const depositoElegido = elegidoEnTablero === undefined ? depositoDeSesion : elegidoEnTablero
  const [eligiendoDeposito, setEligiendoDeposito] = useState(false)
  const depositoParaServidor = veTodos ? (depositoElegido ?? undefined) : undefined
  const nombreElegido = depositoElegido ? depositos.data?.find((d) => d.id === depositoElegido)?.nombre ?? undefined : undefined
  const nombreDeposito = veTodos ? (depositoElegido ? (nombreElegido ?? 'Depósito elegido') : 'Todos los depósitos') : (nombrePropio ?? 'Tu depósito')
  const nombreParaTextos = veTodos ? nombreElegido : nombrePropio

  // La lista de vendedores pide Ventas:Read; sin ese permiso no se ofrece filtrar por vendedor.
  const veVendedores = useAuthStore((s) => s.canDo('MOD_VENTAS', 'read'))
  const vendedores = useVendedores(veVendedores && filtrando)

  // La pantalla queda montada en el menú: fuera de foco no consulta cada 30 segundos.
  const activa = useIsFocused()
  const params = {
    fechaDesde: filtros.rango.desde || undefined,
    fechaHasta: filtros.rango.hasta || undefined,
    metodoEntrega: filtros.metodo ?? undefined,
    vendedorId: filtros.vendedor?.id,
    depositoId: depositoParaServidor,
  }
  const q = useVentasParaPreparacion(params, { activa, mantenerAlFiltrar: true })
  const conteosQ = useConteosPreparacion(params, { activa })
  const conteos = conteosQ.isError ? null : conteosDeColumnas(conteosQ.data)
  const columnas = useMemo(() => repartirEnColumnas((q.data ?? []) as VentaTablero[]), [q.data])
  const atajo = filtros.exacto || filtros.dia ? null : atajoDeRango(filtros.rango, hoy)
  const deApertura = !filtros.exacto && !filtros.dia && atajo === 'hoy' && filtros.metodo === null && !filtros.vendedor
  const diaElegido = dias.find((d) => d.fecha === filtros.dia)
  const etiquetaRango = diaElegido ? nombreDelDia(diaElegido) : atajo === 'todo' ? 'Todas las fechas' : (ATAJOS_ENTREGA.find((a) => a.id === atajo)?.label ?? 'Rango exacto')
  const limpiar = () => setFiltros(filtrosDeApertura(hoy))

  if (pedido) {
    return (
      <Marco leading={{ kind: 'atras', onPress: () => setPedido(null) }}>
        <PedidoPorPrepararDetalle key={pedido.id} pedido={pedido} />
      </Marco>
    )
  }

  const sinRed = q.isError && esFallaDeRed(q.error)
  const hayDatos = !!q.data
  const sinPedidos = hayDatos && COLUMNAS.every((col) => columnas[col.id].length === 0)

  const cabeza = (
    <View style={{ gap: space[3] }}>
      <TiraDeDias dias={dias} elegido={filtros.dia} esFeriado={esFeriado} onElegir={(fecha) => setFiltros({ ...filtros, exacto: false, dia: fecha, rango: { desde: fecha, hasta: fecha } })} />
      <DepositoDelTablero nombre={nombreDeposito} asignado={!veTodos} onElegir={veTodos ? () => setEligiendoDeposito(true) : undefined} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: space[2], alignItems: 'center' }}>
          {ATAJOS_ENTREGA.map(({ id, label }) => (
            <FiltroChip key={id} label={label} activo={atajo === id} onPress={() => setFiltros({ ...filtros, exacto: false, dia: null, rango: rangoDeAtajo(id, hoy) })} />
          ))}
          <FiltroChip label="Rango exacto" activo={atajo === null && !filtros.dia} onPress={() => { setFiltros({ ...filtros, exacto: true, dia: null }); setFiltrando(true) }} />
        </ScrollView>
        <Pressable
          onPress={() => setFiltrando(true)}
          android_ripple={{ color: c.surface2, borderless: true }}
          accessibilityRole="button"
          accessibilityLabel="Filtros: rango exacto, método de entrega y vendedor"
          style={{
            width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1,
            borderColor: deApertura ? c.border : c.brand, backgroundColor: deApertura ? c.surface : c.brandSoft,
          }}
        >
          <Filter size={20} color={c.brandInk} />
        </Pressable>
      </View>
    </View>
  )

  const abrir = (v: VentaTablero) => setPedido(v)
  let cuerpo: React.ReactNode
  if (q.isLoading) cuerpo = <TableroEsqueleto />
  else if (q.isError && !hayDatos) {
    cuerpo = sinRed
      ? <EstadoDePantalla tipo="sinConexion" titulo="No pudimos cargar el tablero" accion={{ label: 'Reintentar', onPress: () => { void q.refetch(); void conteosQ.refetch() } }} />
      : <ErrorTablero onReintentar={() => { void q.refetch(); void conteosQ.refetch() }} />
  } else if (sinPedidos) {
    cuerpo = (
      <TableroVacio
        nombreDeposito={nombreParaTextos}
        onVerTodo={atajo === 'todo' ? undefined : () => setFiltros({ ...filtros, exacto: false, dia: null, rango: rangoDeAtajo('todo', hoy) })}
        onLimpiarFiltros={deApertura ? undefined : limpiar}
      />
    )
  } else if (isTabletLandscape) {
    // Tablet ancha: las cuatro columnas lado a lado, como la web desde 900 px.
    cuerpo = (
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
        {COLUMNAS.map((col) => (
          <View key={col.id} style={{ flex: 1, minWidth: 0 }}>
            <ColumnaTablero id={col.id} items={columnas[col.id]} hoy={hoy} onAbrir={abrir} />
          </View>
        ))}
      </View>
    )
  } else {
    cuerpo = (
      <View style={{ gap: space[3] }}>
        <PestanasEstado activa={pestana} conteos={conteos} onCambiar={setPestana} />
        <ColumnaTablero id={pestana} items={columnas[pestana]} hoy={hoy} onAbrir={abrir} />
      </View>
    )
  }

  return (
    <Marco>
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[3] }}>
        {cabeza}
        {/* Sin señal con datos guardados: se avisa y se sigue mostrando lo último. */}
        {q.isError && hayDatos && sinRed ? <Notice tone="advertencia">{textoSinConexion(q.dataUpdatedAt || undefined)}</Notice> : null}
        {hayDatos ? (
          <Text accessibilityRole="header" style={{ ...typeScale.secundario, ...pesoSemibold, color: c.text }}>
            {textoTotalDelDia(etiquetaRango, totalDelDia(columnas))}
          </Text>
        ) : null}
        {cuerpo}
        {hayDatos && !sinPedidos ? (
          <Notice tone="info">{!isTabletLandscape && pestana === 'noEntregado' ? AVISO_NO_ENTREGADO : AVISO}</Notice>
        ) : null}
      </ScrollView>
      <FiltrosTableroSheet
        visible={filtrando}
        hoy={hoy}
        filtros={filtros}
        atajo={atajo}
        onCambio={setFiltros}
        onLimpiar={limpiar}
        vendedores={veVendedores ? { lista: vendedores.data ?? [], cargando: vendedores.isLoading, error: vendedores.isError } : null}
        nombreDeposito={nombreParaTextos}
        onClose={() => setFiltrando(false)}
      />
      {veTodos ? (
        <ElegirDepositoSheet
          visible={eligiendoDeposito}
          depositos={(depositos.data ?? []).flatMap((d) => (d.id ? [{ id: d.id, nombre: d.nombre ?? 'Sin nombre' }] : []))}
          elegido={depositoElegido}
          cargando={depositos.isLoading}
          error={depositos.isError}
          onElegir={(id) => { setDepositoElegido(id); setEligiendoDeposito(false) }}
          onClose={() => setEligiendoDeposito(false)}
        />
      ) : null}
    </Marco>
  )
}
