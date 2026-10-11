import React, { useState } from 'react'
import { ActivityIndicator, FlatList, Modal, Text, TextInput, View } from 'react-native'
import { useNavigation } from 'expo-router'
import { DrawerActions } from '@react-navigation/native'
import { LayoutGrid, List, Search } from 'lucide-react-native'
import { FONT, radii, space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { Notice, TopBar } from '@/core/ui/fw'
import { RequirePermission } from '@/core/ui'
import { useCatalogoConsulta } from '@/features/catalogo/hooks/useCatalogoConsulta'
import { ProductoCard } from '@/features/catalogo/components/ProductoCard'
import { FichaProducto } from '@/features/catalogo/components/FichaProducto'

/** Ancho desde el que la grilla y la ficha van lado a lado (plan §8, lámina TabCatalogoConsulta). */
const ANCHO_DOS_PANELES = 900

/** Catálogo y stock, solo consulta (láminas CatalogoConsulta, FichaProducto y TabCatalogoConsulta). */
export default function CatalogoConsultaScreen() {
  const navigation = useNavigation()
  const c = useColors()
  const { width } = useResponsive()
  const dosPaneles = width >= ANCHO_DOS_PANELES
  const [grillaElegida, setGrilla] = useState(false)
  const grilla = dosPaneles || grillaElegida
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const cat = useCatalogoConsulta()
  const columnas = grilla ? 2 : 1

  const lista = (
    <View style={{ flex: 1 }}>
      <View
        style={{
          minHeight: 52,
          justifyContent: 'center',
          paddingHorizontal: space[4],
          backgroundColor: c.surface,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        }}
      >
        <Text style={[typeScale.secundario, { color: c.text, fontFamily: FONT.semibold, fontWeight: '600' }]}>
          {cat.totalCount != null ? `MOSTRANDO ${cat.productos.length} DE ${cat.totalCount}` : ' '}
        </Text>
      </View>
      {cat.isLoading ? (
        <ActivityIndicator style={{ marginTop: space[8] }} color={c.brandInk} />
      ) : cat.isError ? (
        <View style={{ padding: space[4] }}>
          <Notice tone="peligro">No se pudo cargar el catálogo. Revisá la conexión y volvé a intentar.</Notice>
        </View>
      ) : (
        <FlatList
          key={`columnas-${columnas}`}
          data={cat.productos}
          numColumns={columnas}
          keyExtractor={(p) => p.id}
          columnWrapperStyle={columnas > 1 ? { gap: space[3] } : undefined}
          contentContainerStyle={{ padding: space[4], gap: space[3], paddingBottom: space[12] }}
          onEndReached={cat.cargarMas}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <Text style={[typeScale.cuerpo, { color: c.textSecondary, textAlign: 'center', marginTop: space[8] }]}>
              No hay productos que coincidan con la búsqueda.
            </Text>
          }
          ListFooterComponent={cat.isFetchingNextPage ? <ActivityIndicator color={c.brandInk} /> : null}
          renderItem={({ item }) => (
            <ProductoCard
              producto={item}
              disponible={cat.disponible.get(item.id)}
              grilla={grilla}
              seleccionado={dosPaneles && seleccion === item.id}
              onPress={() => setSeleccion(item.id)}
            />
          )}
        />
      )}
    </View>
  )

  return (
    <RequirePermission module="MOD_STOCK" action="read" mode="screen">
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar
          title="Catálogo y stock"
          subtitle="Solo consulta"
          leading={{ kind: 'menu', onPress: () => navigation.dispatch(DrawerActions.openDrawer()) }}
          actions={
            dosPaneles
              ? []
              : [
                  {
                    icon: grilla ? List : LayoutGrid,
                    accessibilityLabel: grilla ? 'Ver como lista' : 'Ver como grilla',
                    onPress: () => setGrilla((g) => !g),
                  },
                ]
          }
        />
        <View style={{ backgroundColor: c.topBar, paddingHorizontal: space[4], paddingBottom: space[3] }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[2],
              height: space[12],
              borderRadius: radii.campo,
              backgroundColor: c.surface,
              paddingHorizontal: space[3],
            }}
          >
            <Search size={20} color={c.textSecondary} />
            <TextInput
              value={cat.busqueda}
              onChangeText={cat.setBusqueda}
              placeholder="Buscar por código o nombre"
              placeholderTextColor={c.textSecondary}
              accessibilityLabel="Buscar por código o nombre"
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              style={[typeScale.cuerpo, { flex: 1, color: c.text, paddingVertical: 0 }]}
            />
          </View>
        </View>

        {dosPaneles ? (
          <View style={{ flex: 1, flexDirection: 'row' }}>
            <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: c.border }}>{lista}</View>
            <View testID="panel-ficha" style={{ flex: 1 }}>
              {seleccion ? (
                <FichaProducto productoId={seleccion} />
              ) : (
                <Text style={[typeScale.cuerpo, { color: c.textSecondary, textAlign: 'center', marginTop: space[8] }]}>
                  Elegí un producto para ver su ficha.
                </Text>
              )}
            </View>
          </View>
        ) : (
          lista
        )}

        <Modal
          visible={!dosPaneles && seleccion !== null}
          animationType="slide"
          onRequestClose={() => setSeleccion(null)}
        >
          <View style={{ flex: 1, backgroundColor: c.bg }}>
            <TopBar title="Ficha de producto" leading={{ kind: 'atras', onPress: () => setSeleccion(null) }} />
            {seleccion ? <FichaProducto productoId={seleccion} /> : null}
          </View>
        </Modal>
      </View>
    </RequirePermission>
  )
}
