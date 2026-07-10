import React from 'react'
import { View, Text, Pressable, FlatList, TextInput, ActivityIndicator } from 'react-native'
import { Tag, Minus, Plus } from 'lucide-react-native'
import { Image as ExpoImage } from 'expo-image'
import { ModalHeader, SearchBar } from './SharedModalComponents'
import { getFullImageUrl } from '@/libs/api-client'

function ProductCatalogItem({
  item, cantidadActual, onUpdate, colors
}: {
  item: any
  cantidadActual: number
  onUpdate: (prod: any, qty: number) => void
  colors: any
}) {
  const imgUrl = getFullImageUrl(item.imageUrl)

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: cantidadActual > 0 ? `${colors.primary}05` : colors.surface,
        borderRadius: 20,
        padding: 12,
      }}>
        <View style={{
          width: 56, height: 56, borderRadius: 14,
          backgroundColor: colors.surface2,
          overflow: 'hidden',
          alignItems: 'center', justifyContent: 'center',
        }}>
          {imgUrl
            ? <ExpoImage source={imgUrl} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            : <Tag size={24} color={colors.textDisabled} />
          }
        </View>

        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }} numberOfLines={2}>
            {item.nombre}
          </Text>
          <Text style={{ fontSize: 15, fontWeight: '900', color: colors.primary, marginTop: 4 }}>
            ${(item.precioCompraBase || item.precioVenta * 0.7 || 0).toLocaleString('es-AR')}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface2, borderRadius: 14 }}>
          <Pressable onPress={() => onUpdate(item, (cantidadActual || 0) - 1)} style={{ padding: 12 }}>
            <Minus size={16} color={cantidadActual > 0 ? colors.text : colors.textDisabled} strokeWidth={3} />
          </Pressable>
          <TextInput 
            style={{ color: cantidadActual > 0 ? colors.text : colors.textDisabled, fontWeight: '900', fontSize: 16, minWidth: 24, textAlign: 'center', padding: 0 }}
            keyboardType="number-pad"
            value={cantidadActual > 0 ? String(cantidadActual) : ''}
            placeholder="0"
            placeholderTextColor={colors.textDisabled}
            onChangeText={v => {
              const num = parseInt(v, 10)
              if (!isNaN(num)) onUpdate(item, num)
              else if (v === '') onUpdate(item, 0)
            }}
          />
          <Pressable onPress={() => onUpdate(item, (cantidadActual || 0) + 1)} style={{ padding: 12 }}>
            <Plus size={16} color={colors.primary} strokeWidth={3} />
          </Pressable>
        </View>
      </View>
    </View>
  )
}

interface CatalogModalProps {
  visible: boolean
  onClose: () => void
  colors: any
  productSearch: string
  setProductSearch: (s: string) => void
  loadingProds: boolean
  productosFiltrados: any[]
  detalles: any[]
  setProductoCantidad: (prod: any, qty: number) => void
}

export function CatalogModal({ visible, onClose, colors, productSearch, setProductSearch, loadingProds, productosFiltrados, detalles, setProductoCantidad }: CatalogModalProps) {
  if (!visible) return null

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1001, backgroundColor: colors.bg }}>
      <ModalHeader title="Catálogo Maestro" onClose={onClose} colors={colors} />
      <View style={{ padding: 16 }}>
        <SearchBar value={productSearch} onChangeText={setProductSearch} placeholder="BUSCAR PRODUCTO..." colors={colors} autoFocus />
      </View>
      {loadingProds ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} /> : (
        <FlatList
          data={productosFiltrados}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }}
          renderItem={({ item }) => {
            const det = detalles.find(d => d.productoId === item.id)
            return (
              <ProductCatalogItem 
                item={item} 
                cantidadActual={det?.cantidad || 0} 
                onUpdate={setProductoCantidad}
                colors={colors}
              />
            )
          }}
        />
      )}
    </View>
  )
}
