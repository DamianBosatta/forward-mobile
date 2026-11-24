import { LISTA_LARGA_PROPS } from '@/core/ui/listaLargaProps'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useFiltroPersistente } from '@/core/hooks/useFiltroPersistente'
import { RefreshControl, SectionList, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { opcionDeRuta, useParametrosDeRuta } from '@/core/navigation/parametrosDeRuta'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { Fab, Notice, TopBar, formatImporte, useInsetInferior, useMenuLeading } from '@/core/ui/fw'
import { espacioBajoElFab } from '@/core/ui/fw/espacioDelFab'
import { EstadoDePantalla, textoSinConexion } from '@/core/ui/fw/EstadoDePantalla'
import { esFallaDeRed } from '@/core/api/errores'
import { usePermissions } from '@/core/auth/RequirePermission'
import { useCartera } from '@/features/clientes/hooks/useCartera'
import { FilaCliente } from '@/features/clientes/components/FilaCliente'
import { BuscadorCartera } from '@/features/clientes/components/BuscadorCartera'
import { FiltrosCartera, SIN_FILTROS, type FiltrosDeCartera } from '@/features/clientes/components/FiltrosCartera'
import { textoCantidad } from '@/features/clientes/lib/cliente'
import { seccionesPorLetra } from '@/features/clientes/lib/secciones'
import { DeudoresClientes } from '@/features/deudores/components/DeudoresClientes'
import { usePuedeVerDeudores } from '@/features/deudores/lib/permiso'
import { FichaCliente } from '@/features/clientes/components/FichaCliente'
import { EstadoDeConsulta, FILAS_CARGANDO } from '@/core/ui/estados'
import { ConAccesosRapidos } from '@/src/components/layout/AccesosRapidos'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { useRefrescarAlEnfocar } from '@/core/hooks/useRefrescarAlEnfocar'

/** Desde este ancho la lista y la ficha van lado a lado (plan §8). */
const ANCHO_DOS_PANELES = 900
/** Valor del parametro de ruta `filtro` que abre la pestana Clientes en Deudores (lo usa Inicio). */
export const FILTRO_DEUDORES = 'deudores'

/** Clientes (láminas Clientes y TabClientes): la cartera del vendedor, por dirección de entrega. */
function ClientesScreen() {
  const c = useColors()
  const insetInferior = useInsetInferior()
  const router = useRouter()
  const menu = useMenuLeading()
  const { width } = useResponsive()
  const { canCreate } = usePermissions()
  const [busqueda, setBusqueda] = useFiltroPersistente('socios.busqueda', '')
  const [abierto, setAbierto] = useState<string | null>(null)
  const [filtros, setFiltros] = useFiltroPersistente<FiltrosDeCartera>('socios.filtros', SIN_FILTROS)
  const { clientes, totalCount, saldoTotal, isLoading, isRefetching, error, dataUpdatedAt, refetch, cargarMas } = useCartera(busqueda, filtros, { ordenarPor: 'Direccion' })
  const secciones = useMemo(() => seccionesPorLetra(clientes), [clientes])
  const sinRed = esFallaDeRed(error)
  const hayDatos = clientes.length > 0
  // "Deudores": los clientes que deben (`GET /deudas/clientes`, MOD_PAGOS:Read). El servidor acota al vendedor.
  const puedeVerDeudores = usePuedeVerDeudores()
  const [soloDeudores, setSoloDeudores] = useFiltroPersistente('socios.soloDeudores', false)
  // `?filtro=deudores` (p. ej. desde Inicio) abre directo en Deudores; sin el permiso se ignora.
  const { filtro } = useParametrosDeRuta({ filtro: opcionDeRuta([FILTRO_DEUDORES]) })
  useEffect(() => {
    if (filtro === FILTRO_DEUDORES && puedeVerDeudores) setSoloDeudores(true)
  }, [filtro, puedeVerDeudores, setSoloDeudores])
  const verDeudores = (soloDeudores || (filtro === FILTRO_DEUDORES)) && puedeVerDeudores
  const filtrando = filtros.conDeudaVencida || !!filtros.localidad
  const dosPaneles = width >= ANCHO_DOS_PANELES

  const abrir = useCallback((id: string) => {
    if (dosPaneles) setAbierto(id)
    else router.push({ pathname: '/(tabs)/socios/[id]', params: { id } })
  }, [dosPaneles, router])
  const renderCliente = useCallback(({ item, index, section }: { item: (typeof clientes)[number]; index: number; section: { data: readonly unknown[] } }) => (
    // Las filas de cada letra van en una tarjeta, como la lista de "Elegir cliente" de la venta (frame 1).
    <FilaCliente
      variante="cartera"
      primera={index === 0}
      ultima={index === section.data.length - 1}
      cliente={item}
      seleccionado={dosPaneles && item.id === abierto}
      onAbrir={abrir}
    />
  ), [dosPaneles, abierto, abrir])

  // Con permiso del export, la cuenta de un deudor lleva "Estado de cuenta" para compartir por WhatsApp.
  const listaDeudores = (
    <DeudoresClientes
      onAbrir={id => {
        if (dosPaneles) setAbierto(id)
        else router.push({ pathname: '/(tabs)/cuentas/[id]', params: { id } })
      }}
    />
  )

  const lista = verDeudores ? listaDeudores : (
    <View style={{ flex: 1 }}>
      {error && !(sinRed && !hayDatos) ? (
        <View style={{ padding: space[4] }}>
          {sinRed ? (
            <Notice tone="advertencia">{textoSinConexion(dataUpdatedAt || undefined)}</Notice>
          ) : (
            <Notice tone="peligro">{mensajeDelServidor(error, 'No se pudo cargar la cartera.')}</Notice>
          )}
        </View>
      ) : null}
      {totalCount !== undefined ? (
        // Resumen en una tarjeta con la cifra mediana (propuesta, frame 1).
        <View testID="pie-clientes" style={{ marginHorizontal: space[4], marginBottom: space[2], paddingVertical: space[4], paddingHorizontal: space[5], borderRadius: radii.tarjetaGrande, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space[3] }}>
          <Text accessibilityLiveRegion="polite" style={{ ...typeScale.secundario, color: c.textSecondary, flexShrink: 1 }}>
            {textoCantidad(clientes.length, totalCount)}
          </Text>
          {saldoTotal !== undefined ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Saldo total</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={[typeScale.tituloGrande, importe, { color: c.accentText }]}>{formatImporte(saldoTotal)}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <SectionList {...LISTA_LARGA_PROPS}
        // Sticky headers: with no sections (loading) React Native lets the Android content view clip and turns
        // clipping off once the cartera arrives; that toggle loses detached children and the next Fabric insert
        // crashes the app (Sentry FORWARD-MOBILE-Z). This list never clips.
        removeClippedSubviews={false}
        sections={secciones}
        keyExtractor={item => item.id}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingBottom: espacioBajoElFab(insetInferior) }}
        renderSectionHeader={({ section }) => (
          <View testID={`encabezado-letra-${section.title}`} accessibilityRole="header" style={{ paddingHorizontal: space[4], paddingTop: space[3], paddingBottom: space[2], backgroundColor: c.bg }}>
            <Text style={{ ...typeScale.etiqueta, color: c.textSecondary }}>{section.title}</Text>
          </View>
        )}
        renderItem={renderCliente}

        onEndReached={cargarMas}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { void refetch() }} tintColor={c.brandInk} />}
        ListEmptyComponent={
          // Con error del servidor la lista queda sin nada y el aviso va arriba; sin red, la pantalla entera.
          <EstadoDeConsulta
            cargando={isLoading}
            esqueleto={FILAS_CARGANDO}
            error={error && sinRed ? error : undefined}
            tituloError="No pudimos cargar los clientes"
            onReintentar={() => void refetch()}
            vacio={!error}
            tituloVacio={
              busqueda.trim()
                ? 'Ningún cliente coincide con la búsqueda.'
                : filtrando
                  ? 'Ningún cliente coincide con los filtros.'
                  : 'Todavía no hay clientes en tu cartera.'
            }
          />
        }
      />
      {canCreate('MOD_CLIENTES') ? (
        <Fab label="Nuevo cliente" accessibilityLabel="Nuevo cliente" onPress={() => router.push('/(tabs)/socios/nuevo')} />
      ) : null}
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar
        title="Clientes"
        subtitle={verDeudores ? 'Deudores' : 'Mi cartera'}
        leading={menu}
      />
      {verDeudores ? null : <BuscadorCartera sobre="pantalla" grande valor={busqueda} onCambio={setBusqueda} />}
      <FiltrosCartera
        sobre="pantalla"
        valor={filtros}
        onCambio={setFiltros}
        totalCartera={verDeudores || filtrando || busqueda.trim() ? undefined : totalCount}
        deudores={puedeVerDeudores ? { activo: verDeudores, onCambio: setSoloDeudores } : undefined}
      />

      {dosPaneles ? (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={{ width: 420, borderRightWidth: 1, borderRightColor: c.border }}>{lista}</View>
          <View style={{ flex: 1 }}>
            {abierto ? (
              <FichaCliente key={abierto} id={abierto} />
            ) : (
              <EstadoDePantalla tipo="vacio" titulo="Elegí un cliente para ver su ficha." />
            )}
          </View>
        </View>
      ) : (
        lista
      )}

    </View>
  )
}

export default function ClientesScreenConBarra() {
  useRefrescarAlEnfocar()
  return (
    <ConAccesosRapidos activa="clientes">
      <ClientesScreen />
    </ConAccesosRapidos>
  )
}
