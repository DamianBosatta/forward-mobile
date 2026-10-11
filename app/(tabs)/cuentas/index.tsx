import React, { useState } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { Notice, TopBar, TwoPane, useMenuLeading } from '@/core/ui/fw'
import { useCartera } from '@/features/clientes/hooks/useCartera'
import { ClienteCard } from '@/features/clientes/components/ClienteCard'
import { BuscadorCartera } from '@/features/clientes/components/BuscadorCartera'
import { CuentaCorrienteCliente } from '@/features/cuentas/components/CuentaCorrienteCliente'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'

/**
 * Cuentas corrientes (láminas CuentaCorriente y TabCuentaCorriente): la cartera por dirección de
 * entrega; tocar un cliente abre su cuenta (en tablet horizontal, en el panel de la derecha).
 */
export default function CuentasCorrientesScreen() {
  const c = useColors()
  const router = useRouter()
  const menu = useMenuLeading()
  const { isTabletLandscape } = useResponsive()
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState<string | null>(null)
  const { clientes, totalCount, isLoading, isRefetching, error, refetch, cargarMas } = useCartera(busqueda)

  const abrir = (id: string) => {
    if (isTabletLandscape) setAbierto(id)
    else router.push({ pathname: '/(tabs)/cuentas/[id]', params: { id } })
  }

  const lista = (
    <View style={{ flex: 1 }}>
      {totalCount !== undefined ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ ...typeScale.secundario, color: c.text, paddingHorizontal: space[4], paddingTop: space[3] }}
        >
          {`Mostrando ${clientes.length} de ${totalCount}`}
        </Text>
      ) : null}
      {error ? (
        <View style={{ padding: space[4] }}>
          <Notice tone="peligro">{mensajeDelServidor(error, 'No se pudo cargar la cartera.')}</Notice>
        </View>
      ) : null}
      <FlatList
        data={clientes}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ClienteCard cliente={item} seleccionado={isTabletLandscape && item.id === abierto} onPress={() => abrir(item.id)} />
        )}
        contentContainerStyle={{ padding: space[4], gap: space[3] }}
        onEndReached={cargarMas}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.brandInk} />}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color={c.brandInk} style={{ marginTop: space[8] }} />
          ) : error ? null : (
            <Text style={{ ...typeScale.cuerpo, color: c.textSecondary, textAlign: 'center', marginTop: space[8] }}>
              {busqueda.trim() ? 'Ningún cliente coincide con la búsqueda.' : 'Todavía no hay clientes en tu cartera.'}
            </Text>
          )
        }
      />
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Cuentas corrientes" subtitle="Tu cartera, por dirección de entrega" leading={menu} />
      <BuscadorCartera valor={busqueda} onCambio={setBusqueda} />
      <TwoPane
        list={lista}
        detail={isTabletLandscape && abierto ? <CuentaCorrienteCliente key={abierto} socioId={abierto} /> : null}
        emptyDetail={
          <Text style={{ ...typeScale.cuerpo, color: c.textSecondary, textAlign: 'center', marginTop: space[12] }}>
            Elegí un cliente para ver su cuenta.
          </Text>
        }
      />
    </View>
  )
}
