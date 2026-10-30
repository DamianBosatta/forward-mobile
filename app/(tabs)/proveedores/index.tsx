import React, { useState } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native'
import { useNavigation, useRouter } from 'expo-router'
import { DrawerActions } from '@react-navigation/native'
import { space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { Fab, Notice, TopBar } from '@/core/ui/fw'
import { EstadoDePantalla, textoSinConexion } from '@/core/ui/fw/EstadoDePantalla'
import { esFallaDeRed } from '@/core/api/errores'
import { usePermissions } from '@/core/auth/RequirePermission'
import { BuscadorCartera } from '@/features/clientes/components/BuscadorCartera'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { useProveedores } from '@/features/proveedores/hooks/useProveedores'
import { textoCantidadProveedores } from '@/features/proveedores/lib/proveedor'
import { ProveedorCard } from '@/features/proveedores/components/ProveedorCard'
import { FichaProveedor } from '@/features/proveedores/components/FichaProveedor'

/** Desde este ancho la lista y la ficha van lado a lado (plan §8). */
const ANCHO_DOS_PANELES = 900

/** Proveedores (láminas Proveedores y Tablet · Proveedores): lista buscable y ficha; alta y edición con los permisos de la web. */
export default function ProveedoresScreen() {
  const c = useColors()
  const router = useRouter()
  const navigation = useNavigation()
  const { width } = useResponsive()
  const { canCreate } = usePermissions()
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState<string | null>(null)
  const { proveedores, totalCount, isLoading, isRefetching, error, dataUpdatedAt, refetch, cargarMas } = useProveedores(busqueda)
  const sinRed = esFallaDeRed(error)
  const hayDatos = proveedores.length > 0
  const dosPaneles = width >= ANCHO_DOS_PANELES

  const abrir = (id: string) => {
    if (dosPaneles) setAbierto(id)
    else router.push({ pathname: '/(tabs)/proveedores/[id]', params: { id } })
  }

  const lista = (
    <View style={{ flex: 1 }}>
      {error && !(sinRed && !hayDatos) ? (
        <View style={{ padding: space[4] }}>
          {sinRed ? (
            <Notice tone="advertencia">{textoSinConexion(dataUpdatedAt || undefined)}</Notice>
          ) : (
            <Notice tone="peligro">{mensajeDelServidor(error, 'No se pudo cargar la lista de proveedores.')}</Notice>
          )}
        </View>
      ) : null}
      {totalCount !== undefined ? (
        <View style={{ paddingHorizontal: space[4], paddingBottom: space[2] }}>
          <Text accessibilityLiveRegion="polite" style={{ ...typeScale.secundario, color: c.textSecondary }}>
            {textoCantidadProveedores(proveedores.length, totalCount)}
          </Text>
        </View>
      ) : null}
      <FlatList
        data={proveedores}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ProveedorCard
            proveedor={item}
            seleccionado={dosPaneles && item.id === abierto}
            onPress={() => abrir(item.id)}
            onNuevaCompra={canCreate('MOD_COMPRAS') ? () => router.push('/(tabs)/compras/nueva' as never) : undefined}
          />
        )}
        contentContainerStyle={{ paddingBottom: 88 }}
        onEndReached={cargarMas}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.brandInk} />}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color={c.brandInk} style={{ marginTop: space[8] }} />
          ) : error ? (
            sinRed ? (
              <EstadoDePantalla tipo="sinConexion" titulo="No pudimos cargar los proveedores" accion={{ label: 'Reintentar', onPress: () => void refetch() }} />
            ) : null
          ) : (
            <EstadoDePantalla
              tipo="vacio"
              titulo={busqueda.trim() ? 'Ningún proveedor coincide con la búsqueda.' : 'Todavía no hay proveedores cargados.'}
            />
          )
        }
      />
      {canCreate('MOD_PROVEEDORES') ? (
        <Fab label="Nuevo proveedor" accessibilityLabel="Nuevo proveedor" onPress={() => router.push('/(tabs)/proveedores/nuevo')} />
      ) : null}
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar
        title="Proveedores"
        subtitle="A quién le compramos"
        leading={{ kind: 'menu', onPress: () => navigation.dispatch(DrawerActions.openDrawer()) }}
      />
      <BuscadorCartera sobre="pantalla" valor={busqueda} onCambio={setBusqueda} etiqueta="Buscar proveedor" placeholder="Nombre o CUIT" />

      {dosPaneles ? (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={{ width: 420, borderRightWidth: 1, borderRightColor: c.border }}>{lista}</View>
          <View style={{ flex: 1 }}>
            {abierto ? (
              <FichaProveedor key={abierto} id={abierto} />
            ) : (
              <Text style={{ ...typeScale.cuerpo, color: c.textSecondary, textAlign: 'center', marginTop: space[12] }}>
                Elegí un proveedor para ver su ficha.
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
