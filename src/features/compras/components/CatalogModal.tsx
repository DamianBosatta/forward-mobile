import React from 'react'
import { ActivityIndicator, FlatList, Modal, Text, TextInput, View } from 'react-native'
import { Package } from 'lucide-react-native'
import { Image as ExpoImage } from 'expo-image'
import { Button, Field, TopBar } from '@/core/ui/fw'
import { Redondo } from '@/features/venta-nueva/components/ProductoCatalogoCard'
import { getFullImageUrl } from '@/libs/api-client'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'

interface ProductoElegible {
  id: string
  nombre: string
  codigoPropio?: string | null
  imageUrl?: string | null
}

/** Fila del selector (lámina CompraLinea): foto, código, nombre y "+ Añadir" o −/cantidad/+; la cantidad se puede tipear. */
function FilaProducto({ item, cantidad, onCambiar }: { item: ProductoElegible; cantidad: number; onCambiar: (prod: any, qty: number) => void }) {
  const c = useColors()
  const imgUrl = getFullImageUrl(item.imageUrl ?? undefined)
  const enCompra = cantidad > 0

  return (
    <View
      testID={`producto-${item.id}`}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[3], borderRadius: radii.tarjeta,
        backgroundColor: enCompra ? c.brandSoft : c.surface, borderWidth: 2, borderColor: enCompra ? c.brand : c.surface,
      }}
    >
      <View style={{ width: 56, height: 56, borderRadius: radii.campo, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {imgUrl ? <ExpoImage source={imgUrl} style={{ width: 56, height: 56 }} contentFit="cover" /> : <Package size={28} color={c.textSecondary} />}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        {!!item.codigoPropio && <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{item.codigoPropio}</Text>}
        <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }} numberOfLines={2}>{item.nombre}</Text>
      </View>
      {enCompra ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
          <Redondo c={c} label="−" a11y={`Restar ${item.nombre}`} onPress={() => onCambiar(item, cantidad - 1)} />
          <TextInput
            accessibilityLabel={`Cantidad de ${item.nombre}`}
            keyboardType="number-pad"
            value={String(cantidad)}
            onChangeText={(v) => {
              const num = parseInt(v, 10)
              if (!isNaN(num)) onCambiar(item, num)
              else if (v === '') onCambiar(item, 0)
            }}
            style={{ ...typeScale.cuerpoDestacado, ...importe, minWidth: 48, minHeight: 44, textAlign: 'center', paddingVertical: 0, borderRadius: radii.campo, backgroundColor: c.action, color: c.onAction }}
          />
          <Redondo c={c} label="+" a11y={`Sumar ${item.nombre}`} onPress={() => onCambiar(item, cantidad + 1)} />
        </View>
      ) : (
        <View style={{ minWidth: 112 }}>
          <Button label="+ Añadir" variant="secundario" accessibilityLabel={`Añadir ${item.nombre}`} onPress={() => onCambiar(item, 1)} />
        </View>
      )}
    </View>
  )
}

interface CatalogModalProps {
  visible: boolean
  onClose: () => void
  productSearch: string
  setProductSearch: (s: string) => void
  loadingProds: boolean
  productosFiltrados: any[]
  hayMasProductos?: boolean
  cargarMasProductos?: () => void
  detalles: any[]
  setProductoCantidad: (prod: any, qty: number) => void
}

/** Selector de productos de la compra (láminas Compra y CompraLinea), con el kit de `core/ui/fw`. */
export function CatalogModal({ visible, onClose, productSearch, setProductSearch, loadingProds, productosFiltrados, hayMasProductos, cargarMasProductos, detalles, setProductoCantidad }: CatalogModalProps) {
  const c = useColors()
  if (!visible) return null

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View accessibilityLabel="Agregar productos" style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar title="Agregar productos" leading={{ kind: 'atras', onPress: onClose }} />
        <View style={{ padding: space[4] }}>
          <Field label="Buscar producto" placeholder="Nombre o código" value={productSearch} onChangeText={setProductSearch} autoFocus autoCorrect={false} />
        </View>
        {loadingProds ? <ActivityIndicator style={{ marginTop: space[10] }} color={c.brand} /> : (
          <FlatList
            data={productosFiltrados}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: space[4], gap: space[2] }}
            onEndReached={cargarMasProductos}
            onEndReachedThreshold={0.5}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={{ ...typeScale.cuerpo, color: c.textSecondary, textAlign: 'center', marginTop: space[6] }}>No hay productos con esa búsqueda</Text>}
            ListFooterComponent={hayMasProductos ? <ActivityIndicator style={{ marginVertical: space[4] }} color={c.brand} /> : null}
            renderItem={({ item }) => (
              <FilaProducto item={item} cantidad={detalles.find((d) => d.productoId === item.id)?.cantidad || 0} onCambiar={setProductoCantidad} />
            )}
          />
        )}
        <View style={{ padding: space[4], backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border }}>
          <Button label="Listo" onPress={onClose} />
        </View>
      </View>
    </Modal>
  )
}
