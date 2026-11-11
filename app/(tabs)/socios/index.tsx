import React, { useMemo, useState } from 'react'
import { useFiltroPersistente } from '@/core/hooks/useFiltroPersistente'
import { RefreshControl, SectionList, Text, View } from 'react-native'
import { useNavigation, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DrawerActions } from "expo-router/react-navigation"
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { Fab, Notice, TopBar, formatImporte } from '@/core/ui/fw'
import { EstadoDePantalla, textoSinConexion } from '@/core/ui/fw/EstadoDePantalla'
import { esFallaDeRed } from '@/core/api/errores'
import { usePermissions } from '@/core/auth/RequirePermission'
import { useCartera } from '@/features/clientes/hooks/useCartera'
import { ClienteCard } from '@/features/clientes/components/ClienteCard'
import { BuscadorCartera } from '@/features/clientes/components/BuscadorCartera'
import { FiltrosCartera, SIN_FILTROS, type FiltrosDeCartera } from '@/features/clientes/components/FiltrosCartera'
import { textoCantidad } from '@/features/clientes/lib/cliente'
import { seccionesPorLetra } from '@/features/clientes/lib/secciones'
import { FichaCliente } from '@/features/clientes/components/FichaCliente'
import { Esqueletos, FILAS_CARGANDO } from '@/features/clientes/components/Esqueletos'
import { ConAccesosRapidos } from '@/src/components/layout/AccesosRapidos'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'

/** Desde este ancho la lista y la ficha van lado a lado (plan §8). */
const ANCHO_DOS_PANELES = 900
/** Alto del `Fab` (src/core/ui/fw/Fab.tsx): la lista deja ese lugar libre abajo. */
const ALTO_FAB = 56

/** Clientes (láminas Clientes y TabClientes): la cartera del vendedor, por dirección de entrega. */
function ClientesScreen() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const navigation = useNavigation()
  const { width } = useResponsive()
  const { canCreate } = usePermissions()
  const [busqueda, setBusqueda] = useFiltroPersistente('socios.busqueda', '')
  const [abierto, setAbierto] = useState<string | null>(null)
  const [filtros, setFiltros] = useFiltroPersistente<FiltrosDeCartera>('socios.filtros', SIN_FILTROS)
  const { clientes, totalCount, saldoTotal, isLoading, isRefetching, error, dataUpdatedAt, refetch, cargarMas } = useCartera(busqueda, filtros, { ordenarPor: 'Direccion' })
  const secciones = useMemo(() => seccionesPorLetra(clientes), [clientes])
  const sinRed = esFallaDeRed(error)
  const hayDatos = clientes.length > 0
  const filtrando = filtros.conDeudaVencida || !!filtros.localidad
  const dosPaneles = width >= ANCHO_DOS_PANELES

  const abrir = (id: string) => {
    if (dosPaneles) setAbierto(id)
    else router.push({ pathname: '/(tabs)/socios/[id]', params: { id } })
  }

  const lista = (
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
        <View testID="pie-clientes" style={{ marginHorizontal: space[4], marginBottom: space[2], paddingVertical: space[3], paddingHorizontal: space[4], borderRadius: radii.tarjeta, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space[3] }}>
          <Text accessibilityLiveRegion="polite" style={{ ...typeScale.secundario, color: c.textSecondary, flexShrink: 1 }}>
            {textoCantidad(clientes.length, totalCount)}
          </Text>
          {saldoTotal !== undefined ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Saldo total</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={[typeScale.titulo, importe, { fontSize: 24, lineHeight: 32, fontWeight: '700', color: c.text }]}>{formatImporte(saldoTotal)}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <SectionList
        sections={secciones}
        keyExtractor={item => item.id}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingBottom: ALTO_FAB + space[6] + insets.bottom + space[4] }}
        renderSectionHeader={({ section }) => (
          <View testID={`encabezado-letra-${section.title}`} accessibilityRole="header" style={{ paddingHorizontal: space[4], paddingTop: space[3], paddingBottom: space[2], backgroundColor: c.bg }}>
            <Text style={{ ...typeScale.etiqueta, color: c.textSecondary }}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item, index, section }) => (
          // Las filas de cada letra van en una tarjeta, como la lista de "Elegir cliente" de la venta (frame 1).
          <ClienteCard
            variante="cartera"
            primera={index === 0}
            ultima={index === section.data.length - 1}
            cliente={item}
            seleccionado={dosPaneles && item.id === abierto}
            onPress={() => abrir(item.id)}
          />
        )}

        onEndReached={cargarMas}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { void refetch() }} tintColor={c.brandInk} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ paddingHorizontal: space[4] }}>
              <Esqueletos bloques={FILAS_CARGANDO} />
            </View>
          ) : error ? (
            sinRed ? (
              <EstadoDePantalla tipo="sinConexion" titulo="No pudimos cargar los clientes" accion={{ label: 'Reintentar', onPress: () => void refetch() }} />
            ) : undefined
          ) : (
            <EstadoDePantalla
              tipo="vacio"
              titulo={
                busqueda.trim()
                  ? 'Ningún cliente coincide con la búsqueda.'
                  : filtrando
                    ? 'Ningún cliente coincide con los filtros.'
                    : 'Todavía no hay clientes en tu cartera.'
              }
            />
          )
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
        subtitle="Mi cartera"
        leading={{ kind: 'menu', onPress: () => navigation.dispatch(DrawerActions.openDrawer()) }}
      />
      <BuscadorCartera sobre="pantalla" grande valor={busqueda} onCambio={setBusqueda} />
      <FiltrosCartera sobre="pantalla" valor={filtros} onCambio={setFiltros} totalCartera={filtrando || busqueda.trim() ? undefined : totalCount} />

      {dosPaneles ? (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={{ width: 420, borderRightWidth: 1, borderRightColor: c.border }}>{lista}</View>
          <View style={{ flex: 1 }}>
            {abierto ? (
              <FichaCliente key={abierto} id={abierto} />
            ) : (
              <Text style={{ ...typeScale.cuerpo, color: c.textSecondary, textAlign: 'center', marginTop: space[12] }}>
                Elegí un cliente para ver su ficha.
              </Text>
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
  return (
    <ConAccesosRapidos activa="clientes">
      <ClientesScreen />
    </ConAccesosRapidos>
  )
}
