import React, { useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native'
import { useRouter, useNavigation } from 'expo-router'
import { DrawerActions, useFocusEffect } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import { safeHaptics } from '@/core/utils/haptics'
import { Wallet, Check, Search, Users, Building2, X, FileText } from 'lucide-react-native'
import { useColors, useIsDark } from '@/libs/theme'
import { BlurView } from 'expo-blur'
import { AuroraGlow, GlassCard, ForwardLogo } from '@/core/ui'
import { useNuevaCuentaForm } from '@/features/cuentas/hooks/useNuevaCuentaForm'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function NuevaCuentaScreen() {
  const colors = useColors()
  const isDark = useIsDark()
  const router = useRouter()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()

  const { state, actions } = useNuevaCuentaForm()
  const {
    nombre,
    tipoDestino,
    socioId,
    socioSearch,
    socioTipo,
    esPrincipal,
    error,
    socios,
    loadingSocios,
    isPending,
  } = state

  // ── State Lifecycle: cleanup al salir ────────────────────────────────────
  const { resetFormState } = actions
  useFocusEffect(
    useCallback(() => {
      resetFormState()
      return () => resetFormState()
    }, [resetFormState])
  )

  const inputBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const placeholderColor = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'
  const sectionLabelColor = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Premium Header */}
      <View style={styles.header}>
        <BlurView
          intensity={isDark ? 80 : 60}
          tint={isDark ? 'dark' : 'light'}
          style={[styles.headerBlur, { paddingTop: insets.top + 10 }]}
        >
          <AuroraGlow size={100} color={colors.primary} opacity={0.12} />
          <View style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <ForwardLogo size={24} showText={false} onPress={() => {
              safeHaptics.impact('light')
              navigation.dispatch(DrawerActions.openDrawer())
            }} />
          </View>
          <Text style={[styles.headerTitle, { color: colors.text, flex: 1 }]}>
            NUEVA CUENTA
          </Text>
          <TouchableOpacity
            onPress={() => router.replace('/(tabs)/cuentas')}
            style={{ padding: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderRadius: 12 }}
          >
            <X size={20} color={colors.text} />
          </TouchableOpacity>
        </BlurView>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={{ marginTop: insets.top + 70 }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Tipo de Cuenta (Propia / Socio) ─────────────────────────── */}
          <GlassCard intensity={4} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: sectionLabelColor }]}>TIPO DE CUENTA</Text>
            <View style={styles.tipoRow}>
              {(['propia', 'socio'] as const).map((tipo) => {
                const isActive = tipoDestino === tipo
                return (
                  <TouchableOpacity
                    key={tipo}
                    style={[
                      styles.tipoBtn,
                      {
                        backgroundColor: isActive ? `${colors.primary}20` : 'transparent',
                        borderColor: isActive ? colors.primary : colors.border,
                      }
                    ]}
                    onPress={() => {
                      safeHaptics.impact('light')
                      actions.setTipoDestino(tipo)
                    }}
                  >
                    <Text style={[styles.tipoBtnText, { color: isActive ? colors.primary : colors.textMuted }]}>
                      {tipo === 'propia' ? '🏦 Propia' : '👥 De Socio'}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </GlassCard>

          {/* ── Nombre de la Cuenta (SIEMPRE visible, era el campo faltante) ── */}
          <GlassCard intensity={4} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: sectionLabelColor }]}>DATOS DE LA CUENTA</Text>
            <Text style={[styles.label, { color: colors.textMuted }]}>Nombre de la cuenta</Text>
            <View style={[styles.inputRow, { backgroundColor: inputBg, borderColor: inputBorder }]}>
              <FileText size={16} color={colors.textDisabled} />
              <TextInput
                style={[styles.inputBare, { color: colors.text }]}
                placeholder="Ej: Caja Chica, Banco Santander..."
                placeholderTextColor={placeholderColor}
                value={nombre}
                onChangeText={actions.setNombre}
                autoCapitalize="words"
              />
            </View>
          </GlassCard>

          {/* ── Selector de Socio (solo si tipo = socio) ─────────────────── */}
          {tipoDestino === 'socio' && (
            <GlassCard intensity={4} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: sectionLabelColor }]}>ASIGNAR A SOCIO</Text>

              {/* Cliente / Proveedor toggle */}
              <View style={styles.tipoRow}>
                {(['Cliente', 'Proveedor'] as const).map((tipo) => {
                  const isActive = socioTipo === tipo
                  return (
                    <TouchableOpacity
                      key={tipo}
                      style={[
                        styles.tipoBtn,
                        {
                          backgroundColor: isActive ? `${colors.primary}20` : 'transparent',
                          borderColor: isActive ? colors.primary : colors.border,
                        }
                      ]}
                      onPress={() => {
                        safeHaptics.impact('light')
                        actions.setSocioTipo(tipo)
                        actions.setSocioId(null)
                      }}
                    >
                      {tipo === 'Cliente'
                        ? <Users size={16} color={isActive ? colors.primary : colors.textMuted} />
                        : <Building2 size={16} color={isActive ? colors.primary : colors.textMuted} />
                      }
                      <Text style={[styles.tipoBtnText, { color: isActive ? colors.primary : colors.textMuted }]}>
                        {tipo}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              {/* Buscador */}
              <View style={[styles.inputRow, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                <Search size={16} color={colors.textDisabled} />
                <TextInput
                  style={[styles.inputBare, { color: colors.text }]}
                  placeholder="Buscar por nombre o CUIT..."
                  placeholderTextColor={placeholderColor}
                  value={socioSearch}
                  onChangeText={actions.setSocioSearch}
                />
              </View>

              {/* Lista de socios */}
              <View style={{ maxHeight: 220 }}>
                {loadingSocios ? (
                  <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
                ) : socios.length === 0 ? (
                  <Text style={{ textAlign: 'center', color: colors.textDisabled, paddingVertical: 20, fontSize: 13, fontFamily: 'Outfit_500Medium' }}>
                    No se encontraron resultados
                  </Text>
                ) : (
                  socios.map(socio => (
                    <TouchableOpacity
                      key={socio.id}
                      style={[
                        styles.socioItem,
                        {
                          backgroundColor: socioId === socio.id ? `${colors.primary}15` : 'transparent',
                          borderWidth: 1,
                          borderColor: socioId === socio.id ? `${colors.primary}40` : 'transparent',
                        }
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync()
                        actions.setSocioId(socio.id ?? null)
                      }}
                    >
                      <View>
                        <Text style={[styles.socioName, { color: colors.text }]}>{socio.razonSocial}</Text>
                        <Text style={{ fontSize: 12, color: colors.textDisabled, fontFamily: 'Outfit_500Medium' }}>{socio.cuit}</Text>
                      </View>
                      {socioId === socio.id && <Check size={18} color={colors.primary} strokeWidth={3} />}
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </GlassCard>
          )}

          {/* ── Cuenta Principal ─────────────────────────────────────────── */}
          {tipoDestino === 'socio' && (
            <GlassCard intensity={4} style={styles.section}>
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.switchLabel, { color: colors.text }]}>Cuenta Principal</Text>
                  <Text style={[styles.switchSub, { color: colors.textMuted }]}>
                    Usada por defecto en ventas y compras
                  </Text>
                </View>
                <Switch
                  value={esPrincipal}
                  onValueChange={actions.setEsPrincipal}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </GlassCard>
          )}

          {/* ── Error ────────────────────────────────────────────────────── */}
          {error ? (
            <Text style={[styles.errorText, { fontFamily: 'Outfit_600SemiBold', textAlign: 'center' }]}>
              {error}
            </Text>
          ) : null}

          {/* ── Guardar ──────────────────────────────────────────────────── */}
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: isPending ? 0.7 : 1 }]}
            onPress={actions.handleGuardar}
            activeOpacity={0.85}
            disabled={isPending}
          >
            {isPending
              ? <ActivityIndicator color={colors.bg} />
              : <>
                  <Wallet size={20} color={colors.bg} strokeWidth={2.5} />
                  <Text style={[styles.saveBtnText, { color: colors.bg }]}>Crear Cuenta</Text>
                </>
            }
          </TouchableOpacity>
          <View style={{ height: 120 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    overflow: 'hidden',
  },
  headerBlur: {
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Outfit_900Black',
    letterSpacing: -0.5,
  },
  scroll: {
    padding: 20,
    paddingBottom: 60,
  },
  section: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    gap: 14,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Outfit_900Black',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 2,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 2,
    gap: 10,
    borderWidth: 1,
  },
  inputBare: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
  },
  tipoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tipoBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
  },
  tipoBtnText: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
  socioItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  socioName: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  switchSub: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    marginTop: 2,
  },
  errorText: {
    fontSize: 13,
    marginBottom: 12,
  },
  saveBtn: {
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
  },
  saveBtnText: {
    fontSize: 16,
    fontFamily: 'Outfit_900Black',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
})
