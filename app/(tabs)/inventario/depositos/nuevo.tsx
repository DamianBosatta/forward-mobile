import React from 'react'
import {
  View, Text, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet, TouchableOpacity
} from 'react-native'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { ArrowLeft, Building2, MapPin, Check } from 'lucide-react-native'
import { safeHaptics } from '@/core/utils/haptics'
import { ForwardLogo, PremiumInput, PremiumButton } from '@/core/ui'
import { useColors, useIsDark } from '@/libs/theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDepositoForm } from '@/features/inventario/hooks/useDepositoForm'
import { MotiView } from 'moti'

export default function NuevoDepositoScreen() {
  const colors = useColors()
  const isDark = useIsDark()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  
  const {
    isEdit, nombre, setNombre, direccion, setDireccion,
    isPending, handleSubmit, resetForm
  } = useDepositoForm()

  // Limpiar formulario al entrar si no es edición
  useFocusEffect(
    React.useCallback(() => {
      if (!isEdit) {
        resetForm()
      }
    }, [isEdit, resetForm])
  )

  const handleGoBack = () => {
    safeHaptics.impact('light')
    router.replace('/(tabs)/inventario/depositos')
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 16,
        paddingTop: Math.max(insets.top, 20) + 20, paddingBottom: 20, paddingHorizontal: 24,
      }}>
        <MotiView
          from={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 12 }}
        >
          <TouchableOpacity 
            onPress={handleGoBack}
            style={{ 
              width: 44, height: 44, borderRadius: 22, 
              backgroundColor: colors.surface2, 
              alignItems: 'center', justifyContent: 'center', 
              borderWidth: 1, borderColor: colors.border 
            }}
          >
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
        </MotiView>
        
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 24, fontFamily: 'Outfit_900Black', color: colors.text }}>
            {isEdit ? 'EDITAR DEPÓSITO' : 'NUEVO DEPÓSITO'}
          </Text>
          <Text style={{ fontSize: 9, fontFamily: 'Outfit_800ExtraBold', color: colors.primary, letterSpacing: 1.5 }}>
            INFRAESTRUCTURA LOGÍSTICA
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24 }} showsVerticalScrollIndicator={false}>
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400 }}
          style={styles.section}
        >
          <PremiumInput
            label="Nombre del Depósito"
            value={nombre}
            onChangeText={setNombre}
            placeholder="EJ: HUB LOGÍSTICO SUR"
            autoCapitalize="characters"
            icon={<Building2 size={18} color={colors.primary} />}
          />

          <PremiumInput
            label="Dirección Física"
            value={direccion}
            onChangeText={setDireccion}
            placeholder="CALLE, NÚMERO, LOCALIDAD..."
            multiline
            numberOfLines={3}
            containerStyle={{ minHeight: 100 }}
            icon={<MapPin size={18} color={colors.primary} />}
          />
        </MotiView>

        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 300 }}
          style={{ marginTop: 40, gap: 12 }}
        >
          <PremiumButton
            title={isEdit ? 'GUARDAR CAMBIOS' : 'CREAR DEPÓSITO'}
            onPress={handleSubmit}
            loading={isPending}
            icon={<Check size={20} color="#fff" strokeWidth={3} />}
          />

          <PremiumButton
            title="CANCELAR"
            variant="secondary"
            onPress={handleGoBack}
            style={{ backgroundColor: 'transparent' }}
          />
        </MotiView>
      </ScrollView>

      <View style={{ alignItems: 'center', paddingBottom: insets.bottom + 20 }}>
        <View style={{ opacity: 0.2 }}>
          <ForwardLogo size={24} />
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  section: { gap: 10 },
})
