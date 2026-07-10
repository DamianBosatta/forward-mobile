import React from 'react'
import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { ArrowLeft, CreditCard, Info } from 'lucide-react-native'
import { useColors } from '../../../libs/theme'

export default function CuentaCorrienteScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const colors = useColors()

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16, gap: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>Cuenta Corriente</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <View style={{ backgroundColor: colors.surface2, padding: 24, borderRadius: 24, alignItems: 'center', gap: 16 }}>
          <CreditCard size={48} color={colors.primary} strokeWidth={1.5} />
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
              Módulo en Construcción
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 8 }}>
              Estamos preparando la vista detallada de movimientos para el socio ID:
            </Text>
            <Text style={{ color: colors.textDisabled, fontSize: 11, fontFamily: 'monospace', marginTop: 4 }}>
              {id}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 32, paddingHorizontal: 24, paddingVertical: 16, backgroundColor: 'rgba(59,130,246,0.05)', borderRadius: 16, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Info size={20} color={colors.primary} />
          <Text style={{ flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 18 }}>
            Pronto podrás ver aquí la composición de saldo, facturas pendientes y recibos aplicados.
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}
