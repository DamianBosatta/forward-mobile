import React, { memo, useCallback, useState } from 'react'
import { FlashList } from '@shopify/flash-list'
import { useFiltroPersistente } from '@/core/hooks/useFiltroPersistente'
import { RefreshControl, Text, View } from 'react-native'
import { useNavigation, useRouter } from 'expo-router'
import { DrawerActions } from "expo-router/react-navigation"
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { Fab, Notice, TopBar, useInsetInferior } from '@/core/ui/fw'
import { EstadoDePantalla, textoSinConexion } from '@/core/ui/fw/EstadoDePantalla'
import { esFallaDeRed } from '@/core/api/errores'
import { usePermissions } from '@/core/auth/RequirePermission'
import { BuscadorCartera } from '@/features/clientes/components/BuscadorCartera'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { useProveedores } from '@/features/proveedores/hooks/useProveedores'
import { textoCantidadProveedores } from '@/features/proveedores/lib/proveedor'
import { ProveedorCard } from '@/features/proveedores/components/ProveedorCard'
import { FichaProveedor } from '@/features/proveedores/components/FichaProveedor'
import { Esqueletos, FILAS_CARGANDO } from '@/features/clientes/components/Esqueletos'

/** Desde este ancho la lista y la ficha van lado a lado (plan §8). */
const ANCHO_DOS_PANELES = 900

type PropsFilaProveedor = Omit<React.ComponentProps<typeof ProveedorCard>, 'onPress'> & { onAbrir: (id: string) => void }

/** Fila memoizada: no se vuelve a pintar mientras el proveedor, su posición y los callbacks no cambien. */
const FilaProveedor = memo(function FilaProveedor({ onAbrir, ...tarjeta }: PropsFilaProveedor) {
  return <ProveedorCard {...tarjeta} onPress={() => onAbrir(tarjeta.proveedor.id)} />
})

/** Proveedores (láminas Proveedores y Tablet · Proveedores): lista buscable y ficha; alta y edición con los permisos de la web. */
export default function ProveedoresScreen() {
  const insetInferior = useInsetInferior()
  const c = useColors()
  const router = useRouter()
  const navigation = useNavigation()
  const { width } = useResponsive()
  const { canCreate } = usePermissions()
  const [busqueda, setBusqueda] = useFiltroPersistente('proveedores.busqueda', '')
  const [abierto, setAbierto] = useState<string | null>(null)
  const { proveedores, totalCount, isLoading, isRefetching, error, dataUpdatedAt, refetch, cargarMas } = useProveedores(busqueda)
  const sinRed = esFallaDeRed(error)
  const hayDatos = proveedores.length > 0
  const dosPaneles = width >= ANCHO_DOS_PANELES

  const abrir = useCallback((id: string) => {
    if (dosPaneles) setAbierto(id)
    else router.push({ pathname: '/(tabs)/proveedores/[id]', params: { id } })
  }, [dosPaneles, router])
  const puedeComprar = canCreate('MOD_COMPRAS')
  const nuevaCompra = useCallback(() => router.push('/(tabs)/compras/nueva' as never), [router])
  const renderProveedor = useCallback(({ item }: { item: (typeof proveedores)[number] }) => (
    // Filas sueltas (receta FWD).
    <FilaProveedor
      proveedor={item}
      seleccionado={dosPaneles && item.id === abierto}
      onAbrir={abrir}
      onNuevaCompra={puedeComprar ? nuevaCompra : undefined}
    />
  ), [dosPaneles, abierto, abrir, puedeComprar, nuevaCompra])

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
        // Resumen en una tarjeta, como el de la lista de Clientes (propuesta, frame 1).
        <View testID="pie-proveedores" style={{ marginHorizontal: space[4], marginBottom: space[2], paddingVertical: space[3], paddingHorizontal: space[4], borderRadius: radii.tarjeta, backgroundColor: c.surface }}>
          <Text accessibilityLiveRegion="polite" style={{ ...typeScale.secundario, color: c.textSecondary }}>
            {textoCantidadProveedores(proveedores.length, totalCount)}
          </Text>
        </View>
      ) : null}
      <FlashList
        data={proveedores}
        keyExtractor={item => item.id}
        renderItem={renderProveedor}
        contentContainerStyle={{ paddingBottom: 88 + insetInferior }}
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
              <EstadoDePantalla tipo="sinConexion" titulo="No pudimos cargar los proveedores" accion={{ label: 'Reintentar', onPress: () => void refetch() }} />
            ) : undefined
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
      <BuscadorCartera sobre="pantalla" grande valor={busqueda} onCambio={setBusqueda} etiqueta="Buscar proveedor" placeholder="Nombre o CUIT" />

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
