import React from 'react'
import {
  View, Text, StyleSheet, ScrollView, 
  TouchableOpacity, TextInput, ActivityIndicator, 
  KeyboardAvoidingView, Platform, Modal, Image
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useRouter, useNavigation } from 'expo-router'
import { DrawerActions, useFocusEffect } from '@react-navigation/native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { safeHaptics } from '@/core/utils/haptics'
import { ArrowLeft, Check, Camera, X, ArrowRightLeft } from 'lucide-react-native'
import { useColors, useIsDark } from '@/libs/theme'
import { ForwardLogo } from '@/core/ui'
import { useNuevaTransaccionForm } from '@/features/tesoreria/hooks/useNuevaTransaccionForm'


function SearchableSelector<T extends { id: string, label: string }>({ 
  label, 
  options, 
  selectedId, 
  onSelect,
  placeholder = "SELECCIONE..."
}: { 
  label: string, 
  options: T[], 
  selectedId: string | null, 
  onSelect: (id: string) => void,
  placeholder?: string
}) {
  const colors = useColors()
  const [modalVisible, setModalVisible] = React.useState(false)
  const [search, setSearch] = React.useState('')

  const selectedOpt = options.find(o => o.id === selectedId)
  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))

  return (
    <View>
      <Text style={{ 
        color: colors.textMuted, fontSize: 9, 
        fontFamily: 'Outfit_900Black', textTransform: 'uppercase', 
        letterSpacing: 1.5, marginBottom: 10, marginLeft: 4 
      }}>
        {label}
      </Text>
      
      <TouchableOpacity
        onPress={() => {
          safeHaptics.impact('light')
          setModalVisible(true)
        }}
        style={{
          backgroundColor: colors.surface2,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border
        }}
      >
        <Text style={{
          fontSize: 14,
          fontFamily: selectedOpt ? 'Outfit_800ExtraBold' : 'Outfit_600SemiBold',
          color: selectedOpt ? colors.primary : colors.textDisabled
        }}>
          {selectedOpt ? selectedOpt.label.toUpperCase() : placeholder}
        </Text>
      </TouchableOpacity>

      <Modal 
        visible={modalVisible} 
        animationType="slide" 
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={{ padding: 8 }}>
              <ArrowLeft size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontFamily: 'Outfit_900Black', color: colors.text }}>
              BUSCAR {label.replace(/\(.*\)/, '')}
            </Text>
          </View>
          
          <View style={{ padding: 16 }}>
            <TextInput
              style={{
                backgroundColor: colors.surface2,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 16,
                color: colors.text,
                fontFamily: 'Outfit_600SemiBold',
                marginBottom: 16
              }}
              placeholder="Buscar por nombre..."
              placeholderTextColor={colors.textDisabled}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />

            <ScrollView keyboardShouldPersistTaps="handled">
              {filtered.length === 0 ? (
                <Text style={{ color: colors.textDisabled, fontFamily: 'Outfit_600SemiBold', textAlign: 'center', marginTop: 20 }}>No se encontraron resultados.</Text>
              ) : (
                filtered.map(opt => (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => {
                      safeHaptics.impact('medium')
                      onSelect(opt.id)
                      setModalVisible(false)
                      setSearch('')
                    }}
                    style={{
                      paddingVertical: 16,
                      borderBottomWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 14, fontFamily: 'Outfit_700Bold' }}>
                      {opt.label.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
              <View style={{ height: 100 }} />
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  )
}

export default function NuevaTransaccionScreen() {
  const colors = useColors()
  const isDark = useIsDark()
  const router = useRouter()
  const navigation = useNavigation()
  const { state, actions } = useNuevaTransaccionForm()

  // ── State Lifecycle: useFocusEffect (cleanup para creación) ───────────────
  const { resetFormState } = actions
  useFocusEffect(
    React.useCallback(() => {
      resetFormState()
      return () => resetFormState()
    }, [resetFormState])
  )

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: 20 },
    section: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 10,
      fontFamily: 'Outfit_900Black',
      color: colors.textDisabled,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
      marginBottom: 12,
    },
    label: {
      fontSize: 11,
      fontFamily: 'Outfit_700Bold',
      color: colors.textMuted,
      marginBottom: 8,
      letterSpacing: 0.5,
    },
    input: {
      backgroundColor: colors.surface2,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 16,
      color: colors.text,
      fontFamily: 'Outfit_700Bold',
    },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
      marginTop: 8,
      marginBottom: 60,
    },
    saveBtnText: {
      fontSize: 16,
      fontFamily: 'Outfit_900Black',
      color: colors.bg,
      letterSpacing: 1,
    },
    errorText: {
      color: colors.danger,
      fontSize: 12,
      fontFamily: 'Outfit_700Bold',
      marginBottom: 16,
      textAlign: 'center',
    }
  })

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between',
          alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              alignItems: 'center', justifyContent: 'center'
            }}>
              <ForwardLogo size={24} showText={false} onPress={() => { safeHaptics.impact('light'); navigation.dispatch(DrawerActions.openDrawer()); }} />
            </View>
            <View>
              <Text style={{ fontSize: 22, fontFamily: 'Outfit_900Black', color: colors.text, letterSpacing: -0.5 }}>
                NUEVA OPERACIÓN
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.success }} />
                <Text style={{ fontSize: 8, fontFamily: 'Outfit_800ExtraBold', letterSpacing: 1.5, color: colors.success }}>
                  REGISTRO DE MOVIMIENTO
                </Text>
              </View>
            </View>
          </View>
          <TouchableOpacity onPress={() => router.replace('/(tabs)/tesoreria')} style={{ padding: 8, backgroundColor: colors.surface2, borderRadius: 20 }}>
            <X size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled">
          {/* Monto */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Importe</Text>
            <View>
              <Text style={s.label}>MONTO TOTAL (ARS)</Text>
              <TextInput
                style={s.input}
                value={state.monto}
                onChangeText={actions.setMonto}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textDisabled}
              />
            </View>
          </View>

          {/* Tipo de Movimiento */}
          <View style={s.section}>
            <SearchableSelector
              label="CATEGORÍA DE MOVIMIENTO"
              options={state.tipos?.map(t => ({ id: t.id ?? '', label: t.nombre ?? '' })) || []}
              selectedId={state.tipoMovimientoId}
              onSelect={actions.setTipoMovimientoId}
            />
          </View>

          {/* Lógica Dinámica de Cuentas y Socios */}
          {(state.selectedTipo?.nombre ?? '').toLowerCase().includes('transferencia') ? (
            <>
              <View style={s.section}>
                <SearchableSelector
                  label="CUENTA DE ORIGEN (TUS CUENTAS)"
                  options={state.cuentasPropias.map(c => ({ id: c.id ?? '', label: c.nombre ?? '' }))}
                  selectedId={state.cuentaOrigenId}
                  onSelect={actions.setCuentaOrigenId}
                />
              </View>
              <View style={s.section}>
                <SearchableSelector
                  label="CUENTA DE DESTINO (TUS CUENTAS)"
                  options={state.cuentasPropias.filter(c => c.id !== state.cuentaOrigenId).map(c => ({ id: c.id ?? '', label: c.nombre ?? '' }))}
                  selectedId={state.cuentaDestinoId}
                  onSelect={actions.setCuentaDestinoId}
                />
              </View>
            </>
          ) : (state.selectedTipo?.nombre ?? '').toLowerCase().includes('cobro') ? (
            <>
              <View style={s.section}>
                <SearchableSelector
                  label="CLIENTE (ORIGEN DE LOS FONDOS)"
                  options={state.cuentasClientes.map(c => ({ id: c.socioComercialId!, label: c.razonSocial! }))}
                  selectedId={state.socioId}
                  onSelect={actions.setSocioId}
                />
              </View>
              <View style={s.section}>
                <SearchableSelector
                  label="TU CUENTA (DESTINO DE LOS FONDOS)"
                  options={state.cuentasPropias.map(c => ({ id: c.id ?? '', label: c.nombre ?? '' }))}
                  selectedId={state.cuentaOrigenId}
                  onSelect={actions.setCuentaOrigenId}
                />
              </View>
            </>
          ) : state.selectedTipo?.factor === -1 ? ( // Pago, Gasto, etc.
            <>
              <View style={s.section}>
                <SearchableSelector
                  label="TU CUENTA (ORIGEN DE LOS FONDOS)"
                  options={state.cuentasPropias.map(c => ({ id: c.id ?? '', label: c.nombre ?? '' }))}
                  selectedId={state.cuentaOrigenId}
                  onSelect={actions.setCuentaOrigenId}
                />
              </View>
              {(state.selectedTipo?.nombre ?? '').toLowerCase().includes('proveedor') && (
                <View style={s.section}>
                  <SearchableSelector
                    label="PROVEEDOR (DESTINO DE LOS FONDOS)"
                    options={state.cuentasProveedores.map(c => ({ id: c.socioComercialId!, label: c.razonSocial! }))}
                    selectedId={state.socioId}
                    onSelect={actions.setSocioId}
                  />
                </View>
              )}
            </>
          ) : (
            // Default fallback (e.g. Ajuste)
            <View style={s.section}>
              <SearchableSelector
                label="CUENTA AFECTADA (TUS CUENTAS)"
                options={state.cuentasPropias.map(c => ({ id: c.id ?? '', label: c.nombre ?? '' }))}
                selectedId={state.cuentaOrigenId}
                onSelect={actions.setCuentaOrigenId}
              />
            </View>
          )}

          {/* Observaciones */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Detalles</Text>
            <View>
              <Text style={s.label}>OBSERVACIONES (OBLIGATORIO)</Text>
              <TextInput
                style={[s.input, { height: 60, textAlignVertical: 'top' }]}
                value={state.observaciones}
                onChangeText={actions.setObservaciones}
                multiline
                placeholder="MOTIVO DEL MOVIMIENTO..."
                placeholderTextColor={colors.textDisabled}
              />
            </View>
          </View>

          {/* Comprobante */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Comprobante (Opcional)</Text>
            {state.comprobanteUri ? (
              <View style={{ borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
                <Image source={{ uri: state.comprobanteUri }} style={{ width: '100%', height: 150 }} />
                <TouchableOpacity 
                  onPress={() => {
                    safeHaptics.impact('light')
                    actions.setComprobanteUri(null)
                  }}
                  style={{
                    position: 'absolute', top: 8, right: 8, 
                    backgroundColor: 'rgba(0,0,0,0.6)', 
                    padding: 8, borderRadius: 20
                  }}
                >
                  <X size={16} color="#FFF" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={async () => {
                  safeHaptics.impact('medium')
                  const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    quality: 0.7,
                  })
                  if (!result.canceled) {
                    actions.setComprobanteUri(result.assets[0].uri)
                  }
                }}
                style={{
                  backgroundColor: colors.surface2,
                  borderRadius: 10,
                  paddingVertical: 12,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderStyle: 'dashed'
                }}
              >
                <Camera size={24} color={colors.primary} style={{ marginBottom: 8 }} />
                <Text style={{ color: colors.primary, fontSize: 12, fontFamily: 'Outfit_700Bold' }}>ADJUNTAR IMAGEN</Text>
              </TouchableOpacity>
            )}
          </View>

          {state.error && <Text style={s.errorText}>{state.error.toUpperCase()}</Text>}

          <TouchableOpacity
            style={s.saveBtn}
            onPress={() => {
              safeHaptics.impact('medium')
              actions.handleGuardar()
            }}
            disabled={state.isPending}
          >
            {state.isPending ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <>
                <Check size={20} color={colors.bg} strokeWidth={3} />
                <Text style={s.saveBtnText}>REGISTRAR MOVIMIENTO</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
