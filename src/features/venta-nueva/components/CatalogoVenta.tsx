import React, { useState } from 'react'
import { ActivityIndicator, FlatList, Text, TextInput, View } from 'react-native'
import { Search } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { canViewStock } from '@/features/ventas/lib/descuentos'
import { useCatalogoVenta } from '../hooks/useCatalogoVenta'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
import { cantidadEn } from '../lib/carrito'
import { ProductoCatalogoCard } from './ProductoCatalogoCard'
import { CarritoFlotante, CarritoPanel } from './CarritoVenta'
import { EditarLineaSheet } from './EditarLineaSheet'

interface CatalogoVentaProps {
  onVerVenta: () => void
  onElegirFragancias?: (productoId: string) => void
}

/**
 * Agregar productos (plan 9 §2.1, PR 2.3). Teléfono: una columna y el carrito flotante.
 * Tablet vertical: dos columnas. Tablet horizontal (≥ 900): grilla de 3 con el carrito
 * fijo a la derecha (plan §8).
 */
export function CatalogoVenta({ onVerVenta, onElegirFragancias }: CatalogoVentaProps) {
  const c = useColors()
  const { formFactor, isTabletLandscape } = useResponsive()
  const [busqueda, setBusqueda] = useState('')
  const { productos, totalCount, isLoading, cargarMas } = useCatalogoVenta(busqueda)
  const { lineas, agregar, sumar, restar, quitar, reemplazar } = useCarritoVenta()
  const [editando, setEditando] = useState<string | null>(null)
  const verCantidades = canViewStock((useAuthStore((s) => s.user?.roles) ?? []) as string[])
  const columnas = formFactor === 'tabletLandscape' ? 3 : formFactor === 'tabletPortrait' ? 2 : 1

  const lista = (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ padding: space[4], gap: space[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], height: 48, borderRadius: radii.campo, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, paddingHorizontal: space[3] }}>
          <Search size={20} color={c.textSecondary} />
          <TextInput
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Buscar por código o nombre"
            placeholderTextColor={c.textSecondary}
            accessibilityLabel="Buscar por código o nombre"
            autoCorrect={false}
            style={{ ...typeScale.cuerpo, flex: 1, color: c.text, paddingVertical: 0 }}
          />
        </View>
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{`Mostrando ${productos.length} de ${totalCount}`}</Text>
      </View>
      <FlatList
        key={columnas}
        data={productos}
        numColumns={columnas}
        keyExtractor={(p) => p.id}
        columnWrapperStyle={columnas > 1 ? { gap: space[3] } : undefined}
        contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: space[4], gap: space[3] }}
        onEndReached={cargarMas}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          isLoading ? <ActivityIndicator color={c.brand} /> : <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>No hay productos que coincidan.</Text>
        }
        renderItem={({ item }) => (
          <ProductoCatalogoCard
            producto={item}
            cantidad={cantidadEn(lineas, item.id)}
            verCantidades={verCantidades}
            onAgregar={() => agregar(item)}
            onSumar={() => sumar(item.id)}
            onRestar={() => restar(item.id)}
            onElegirFragancias={() => onElegirFragancias?.(item.id)}
            onEditar={() => setEditando(item.id)}
          />
        )}
      />
      {!isTabletLandscape && (
        <View style={{ padding: space[4], paddingTop: 0 }}>
          <CarritoFlotante lineas={lineas} onVerVenta={onVerVenta} />
        </View>
      )}
    </View>
  )

  const hoja = (
    <EditarLineaSheet
      linea={lineas.find((l) => l.productoId === editando) ?? null}
      onClose={() => setEditando(null)}
      onConfirm={(l) => { reemplazar(l); setEditando(null) }}
      onQuitar={(id) => { quitar(id); setEditando(null) }}
    />
  )
  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      {lista}
      {isTabletLandscape && <CarritoPanel lineas={lineas} onVerVenta={onVerVenta} />}
      {hoja}
    </View>
  )
}
