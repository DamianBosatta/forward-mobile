import React from 'react'
import { View, Text, Pressable, FlatList, Platform } from 'react-native'
import { Building2 } from 'lucide-react-native'
import { MotiView } from 'moti'
import { ModalHeader, SearchBar } from './SharedModalComponents'

interface ProveedorModalProps {
  visible: boolean
  onClose: () => void
  colors: any
  provSearch: string
  setProvSearch: (s: string) => void
  proveedoresFiltrados: any[]
  onSelectProveedor: (item: any) => void
}

export function ProveedorModal({ visible, onClose, colors, provSearch, setProvSearch, proveedoresFiltrados, onSelectProveedor }: ProveedorModalProps) {
  if (!visible) return null

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
      <Pressable style={{ flex: 1 }} onPress={onClose} />
      <MotiView from={{ translateY: 800 }} animate={{ translateY: 0 }} style={{ height: '85%', backgroundColor: colors.bg, borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden' }}>
        <ModalHeader title="Seleccionar Proveedor" onClose={onClose} colors={colors} />
        <View style={{ padding: 16 }}>
          <SearchBar value={provSearch} onChangeText={setProvSearch} placeholder="BUSCAR POR RAZÓN SOCIAL..." colors={colors} />
        </View>
        <FlatList
          data={proveedoresFiltrados}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => { onSelectProveedor(item); onClose() }}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: pressed ? colors.surface2 : colors.surface, borderRadius: 20, padding: 16, marginBottom: 10,
                borderWidth: 1, borderColor: colors.border
              })}
            >
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center' }}>
                <Building2 size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '900', color: colors.text, fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.razonSocial}</Text>
                <Text style={{ fontWeight: '700', color: colors.textDisabled, fontSize: 10, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>CUIT: {item.cuit}</Text>
              </View>
            </Pressable>
          )}
        />
      </MotiView>
    </View>
  )
}
