import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform, Animated, StyleSheet
} from 'react-native'
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router'
import { DrawerActions, useFocusEffect } from '@react-navigation/native'
import {
  ArrowLeft, Building2, Mail, Phone,
  MapPin, CreditCard, Save, CheckCircle2, X
} from 'lucide-react-native'
import { safeHaptics } from '@/core/utils/haptics'
import { ForwardLogo, RequirePermission } from '@/core/ui'
import { useSocioForm } from '@/features/socios/hooks/useSocioForm'
import { useColors, useIsDark } from '@/libs/theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MotiView } from 'moti'

// ─── constantes ──────────────────────────────────────────────────────────────

const CONDICIONES_IVA = [
  'Responsable Inscripto',
  'Monotributista',
  'Exento',
  'Consumidor Final',
] as const

// ─── sub-componente: campo con ícono ─────────────────────────────────────────

interface FieldProps {
  label: string
  value: string
  onChangeText: (v: string) => void
  placeholder: string
  Icon: any
  required?: boolean
  keyboardType?: any
  autoCapitalize?: any
  maxLength?: number
  valid?: boolean
}

function FormField({
  label, value, onChangeText, placeholder, Icon,
  required, keyboardType, autoCapitalize, maxLength, valid,
}: FieldProps) {
  const colors = useColors()
  const [focused, setFocused] = useState(false)

  const borderColor = focused
    ? colors.primary
    : valid
    ? colors.success + '99'
    : colors.border

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{
        color: colors.textDisabled, fontSize: 8,
        marginBottom: 8, marginLeft: 4, fontFamily: 'Outfit_900Black',
        textTransform: 'uppercase', letterSpacing: 1.5,
      }}>
        {label}{required ? ' *' : ''}
      </Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface2,
        borderRadius: 14, borderWidth: focused ? 1.5 : 1, borderColor: borderColor,
        paddingHorizontal: 14, minHeight: 52,
      }}>
        <Icon size={18} color={focused ? colors.primary : colors.textDisabled} />
        <TextInput
          style={{
            flex: 1, color: colors.text,
            paddingVertical: 14, marginLeft: 10,
            fontSize: 14, fontFamily: 'Outfit_700Bold',
            letterSpacing: (label.includes('CUIT') || label.includes('Email')) ? 0.5 : 0,
          }}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textDisabled}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {valid && !focused && (
          <CheckCircle2 size={18} color={colors.success} />
        )}
      </View>
    </View>
  )
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function SkeletonBox({ width, height }: { width: string | number; height: number }) {
  const colors = useColors()
  const anim = React.useRef(new Animated.Value(0.4)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start()
  }, [])
  return (
    <Animated.View style={{
      width: width as any, height, borderRadius: 10,
      backgroundColor: colors.surface2,
      opacity: anim, marginBottom: 8,
    }} />
  )
}

// ─── pantalla principal ───────────────────────────────────────────────────────

export default function SocioFormScreen() {
  const router = useRouter()
  const navigation = useNavigation()
  const colors = useColors()
  const isDark = useIsDark()
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id?: string }>()

  const { form, setters, validation, status, actions, lifecycle } = useSocioForm(id)

  const { resetForm, bumpFocusKey } = actions
  const { queryClient: socioQC, sociosKeys: socioKeys } = lifecycle

  useFocusEffect(
    useCallback(() => {
      if (!id) resetForm()
      return () => {}
    }, [id, resetForm])
  )

  const handleGoBack = () => {
    safeHaptics.impact('light')
    router.replace('/(tabs)/socios')
  }

  if (status.isEditing && status.isLoadingSocio) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 24, gap: 16 }}>
          <SkeletonBox width={44} height={44} />
          <SkeletonBox width={200} height={30} />
          <SkeletonBox width="100%" height={100} />
          <SkeletonBox width="100%" height={100} />
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      {/* Header Premium */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 16,
        paddingTop: Math.max(insets.top, 20) + 20, paddingBottom: 20,
        paddingHorizontal: 24,
      }}>
        <MotiView from={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}>
          <View style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: colors.surface2,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: colors.border
          }}>
            <ForwardLogo size={24} showText={false} onPress={() => { safeHaptics.impact('light'); navigation.dispatch(DrawerActions.openDrawer()); }} />
          </View>
        </MotiView>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 24, fontFamily: 'Outfit_900Black', color: colors.text }}>
            {status.isEditing ? 'EDITAR SOCIO' : 'NUEVO SOCIO'}
          </Text>
          <Text style={{ fontSize: 9, fontFamily: 'Outfit_800ExtraBold', color: colors.primary, letterSpacing: 1.5 }}>
            REGISTRO MAESTRO DE ENTIDADES
          </Text>
        </View>
        <TouchableOpacity onPress={handleGoBack} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}>
          <X size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <MotiView from={{ opacity: 0, translateY: 20 }} animate={{ opacity: 1, translateY: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <Building2 size={14} color={colors.primary} />
            <Text style={{ color: colors.textDisabled, fontSize: 9, fontFamily: 'Outfit_900Black', textTransform: 'uppercase', letterSpacing: 2 }}>IDENTIDAD COMERCIAL</Text>
          </View>

          {/* Tipo Selector Segmentado */}
          <View style={{ marginBottom: 24 }}>
            <Text style={styles.fieldLabel}>TIPO DE RELACIÓN</Text>
            <View style={{ flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: 16, padding: 4, borderWidth: 1, borderColor: colors.border }}>
              {(['Cliente', 'Proveedor'] as const).map((label, idx) => {
                const active = form.tipoRaw === idx
                return (
                  <TouchableOpacity
                    key={label}
                    onPress={() => {
                      safeHaptics.impact('light')
                      setters.setTipoRaw(idx as 0 | 1)
                    }}
                    style={{
                      flex: 1, paddingVertical: 12, alignItems: 'center',
                      borderRadius: 12,
                      backgroundColor: active ? colors.primary : 'transparent',
                    }}
                  >
                    <Text style={{ fontFamily: 'Outfit_800ExtraBold', fontSize: 13, color: active ? '#fff' : colors.textMuted }}>{label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          <FormField
            label="Razón Social"
            value={form.razonSocial}
            onChangeText={setters.setRazonSocial}
            placeholder="NOMBRE O EMPRESA"
            Icon={Building2}
            required
            valid={validation.validRazon}
          />

          <FormField
            label="CUIT"
            value={form.cuit}
            onChangeText={(v) => setters.setCuit(v.replace(/[^0-9]/g, ''))}
            placeholder="00-00000000-0"
            Icon={CreditCard}
            required
            keyboardType="numeric"
            maxLength={11}
            valid={validation.validCuit}
          />

          {status.formError && (
            <View style={{ backgroundColor: colors.danger + '15', borderRadius: 14, padding: 14, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <X size={16} color={colors.danger} />
              <Text style={{ flex: 1, color: colors.danger, fontFamily: 'Outfit_700Bold', fontSize: 12 }}>{status.formError}</Text>
            </View>
          )}

          <Text style={styles.sectionHeader}>SITUACIÓN FISCAL</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
            {CONDICIONES_IVA.map((cond) => {
              const active = form.condicionIva === cond
              return (
                <TouchableOpacity
                  key={cond}
                  onPress={() => { safeHaptics.impact('light'); setters.setCondicionIva(cond) }}
                  style={[styles.condPill, { backgroundColor: active ? colors.primary + '15' : colors.surface2, borderColor: active ? colors.primary : colors.border }]}
                >
                  <Text style={{ fontSize: 12, fontFamily: 'Outfit_700Bold', color: active ? colors.primary : colors.textMuted }}>{cond}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <Text style={styles.sectionHeader}>DATOS DE CONTACTO</Text>
          <FormField label="Email" value={form.email} onChangeText={setters.setEmail} placeholder="CORREO@EJEMPLO.COM" Icon={Mail} keyboardType="email-address" autoCapitalize="none" valid={!!form.email && validation.validEmail} />
          <FormField label="Teléfono" value={form.telefono} onChangeText={setters.setTelefono} placeholder="+54 9 ..." Icon={Phone} keyboardType="phone-pad" valid={form.telefono.length >= 8} />
          <FormField label="Dirección" value={form.direccion} onChangeText={setters.setDireccion} placeholder="CALLE, ALTURA, CIUDAD" Icon={MapPin} valid={form.direccion.length >= 5} />
        </MotiView>
      </ScrollView>

      {/* Action Bar */}
      <View style={[styles.actionBar, { backgroundColor: colors.bg, borderTopColor: colors.border }]}>
        <TouchableOpacity onPress={handleGoBack} style={[styles.cancelBtn, { backgroundColor: colors.surface2 }]}>
          <Text style={styles.cancelBtnText}>CANCELAR</Text>
        </TouchableOpacity>

        <RequirePermission module={form.tipoRaw === 0 ? 'MOD_CLIENTES' : 'MOD_PROVEEDORES'} action={status.isEditing ? 'update' : 'create'}>
          <TouchableOpacity onPress={actions.submit} disabled={status.isPending} style={[styles.submitBtn, { backgroundColor: colors.primary }]}>
            {status.isPending ? <ActivityIndicator color="#fff" /> : (
              <>
                <Save size={20} color="#fff" />
                <Text style={styles.submitBtnText}>{status.isEditing ? 'ACTUALIZAR' : 'GUARDAR'}</Text>
              </>
            )}
          </TouchableOpacity>
        </RequirePermission>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  liveDot: { width: 4, height: 4, borderRadius: 2 },
  liveText: { fontSize: 8, fontWeight: '800', letterSpacing: 1.5 },
  fieldLabel: { color: '#737373', fontSize: 8, fontFamily: 'Outfit_900Black', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, marginLeft: 4 },
  sectionHeader: { color: '#737373', fontSize: 10, fontFamily: 'Outfit_900Black', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16, marginTop: 8 },
  condPill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  actionBar: { flexDirection: 'row', gap: 12, paddingHorizontal: 24, paddingVertical: 20, borderTopWidth: 1 },
  cancelBtn: { flex: 1, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { color: '#737373', fontFamily: 'Outfit_900Black', fontSize: 12, letterSpacing: 1.5 },
  submitBtn: { flex: 2, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  submitBtnText: { color: '#fff', fontFamily: 'Outfit_900Black', fontSize: 13, letterSpacing: 1.5 }
})
