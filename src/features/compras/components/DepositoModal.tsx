import React from 'react'
import { View, Text, Pressable, FlatList } from 'react-native'
import { Package } from 'lucide-react-native'
import { MotiView } from 'moti'
import { ModalHeader } from './SharedModalComponents'
import { BRAND } from '@/libs/theme'

interface DepositoModalProps {
  visible: boolean
  onClose: () => void
  colors: any
  depositos: any[]
  onSelectDeposito: (item: any) => void
}

export function DepositoModal({ visible, onClose, colors, depositos, onSelectDeposito }: DepositoModalProps) {
  if (!visible) return null

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
      <Pressable style={{ flex: 1 }} onPress={onClose} />
      <MotiView from={{ translateY: 400 }} animate={{ translateY: 0 }} style={{ height: '50%', backgroundColor: colors.bg, borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden' }}>
        <ModalHeader title="Depósito Destino" onClose={onClose} colors={colors} />
        <FlatList
          data={depositos}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => { onSelectDeposito(item); onClose() }}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: pressed ? colors.surface2 : colors.surface, borderRadius: 20, padding: 16, marginBottom: 10,
                borderWidth: 1, borderColor: colors.border
              })}
            >
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: `${BRAND.blue}15`, alignItems: 'center', justifyContent: 'center' }}>
                <Package size={20} color={BRAND.blue} />
              </View>
              <Text style={{ fontWeight: '900', color: colors.text, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>{item.nombre}</Text>
            </Pressable>
          )}
        />
      </MotiView>
    </View>
  )
}
