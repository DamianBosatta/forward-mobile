import React, { useMemo, useState } from 'react'
import { ActivityIndicator, RefreshControl, SectionList, Text, View } from 'react-native'
import { useNavigation, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DrawerActions } from '@react-navigation/native'
import { importe, space, typeScale, useColors } from '@/libs/theme'
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
import { ConAccesosRapidos } from '@/src/components/layout/AccesosRapidos'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'

/** Desde este ancho la lista y la ficha van lado a lado (plan §8). */
const ANCHO_DOS_PANELES = 900
/** Alto del `Fab` (src/core/ui/fw/Fab.tsx): la lista deja ese lugar libre abajo. */
const ALTO_FAB = 56

const textoDestacado = { ...typeScale.secundario, fontFamily: typeScale.cuerpoDestacado.fontFamily, fontWeight: '600' as const }

/** Clientes (láminas Clientes y TabClientes): la cartera del vendedor, por dirección de entrega. */
function ClientesScreen() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const navigation = useNavigation()
  const { width } = useResponsive()
  const { canCreate } = usePermissions()
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState<string | null>(null)
  const [filtros, setFiltros] = useState<FiltrosDeCartera>(SIN_FILTROS)
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
        <View testID="pie-clientes" style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space[3], paddingHorizontal: space[4], paddingBottom: space[2] }}>
          <Text accessibilityLiveRegion="polite" style={{ ...typeScale.secundario, color: c.textSecondary, flexShrink: 1 }}>
            {textoCantidad(clientes.length, totalCount)}
          </Text>
          {saldoTotal !== undefined ? (
            <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
              {'Saldo total '}
              <Text style={[typeScale.cuerpoDestacado, importe, { color: c.text }]}>{formatImporte(saldoTotal)}</Text>
            </Text>
          ) : null}
        </View>
      ) : null}
      <SectionList
        sections={secciones}
        keyExtractor={item => item.id}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingBottom: ALTO_FAB + space[6] + insets.bottom + space[4] }}
        renderSectionHeader={({ section }) => (
          <View testID={`encabezado-letra-${section.title}`} accessibilityRole="header" style={{ paddingHorizontal: space[4], paddingTop: space[3], paddingBottom: space[1], backgroundColor: c.bg }}>
            <Text style={{ ...textoDestacado, color: c.textSecondary }}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <ClienteCard cliente={item} seleccionado={dosPaneles && item.id === abierto} onPress={() => abrir(item.id)} />
        )}
        
        onEndReached={cargarMas}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.brandInk} />}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color={c.brandInk} style={{ marginTop: space[8] }} />
          ) : error ? (
            sinRed ? (
              <EstadoDePantalla tipo="sinConexion" titulo="No pudimos cargar los clientes" accion={{ label: 'Reintentar', onPress: () => void refetch() }} />
            ) : null
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
      <BuscadorCartera sobre="pantalla" valor={busqueda} onCambio={setBusqueda} />
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
