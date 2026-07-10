import React from 'react'
import { View, Text, Pressable, TextInput, Platform } from 'react-native'
import { X, Search } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export function ModalHeader({ title, onClose, colors }: { title: string, onClose: () => void, colors: any }) {
  const insets = useSafeAreaInsets()
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 20, paddingTop: Math.max(insets.top, 24), backgroundColor: colors.surface }}>
       <Text style={{ fontSize: 14, fontWeight: '900', color: colors.text, textTransform: 'uppercase', letterSpacing: 1.5 }}>{title}</Text>
       <Pressable onPress={onClose} style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
         <X size={20} color={colors.textDisabled} />
       </Pressable>
    </View>
  )
}

export function SearchBar({ value, onChangeText, placeholder, colors, autoFocus }: any) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface2, borderRadius: 16, paddingHorizontal: 16, height: 52 }}>
      <Search size={18} color={colors.textDisabled} />
      <TextInput 
        style={{ flex: 1, marginLeft: 12, color: colors.text, fontWeight: '800', fontSize: 14, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }} 
        placeholder={placeholder} placeholderTextColor={colors.textDisabled}
        value={value} onChangeText={onChangeText} autoFocus={autoFocus}
      />
    </View>
  )
}
