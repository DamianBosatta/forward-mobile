import React from 'react'
import {
  View, Text, TouchableOpacity,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
  Image, StyleSheet
} from 'react-native'
import { useRouter, useNavigation } from 'expo-router'
import { DrawerActions, useFocusEffect } from '@react-navigation/native'
import { Package, DollarSign, Info, MapPin, Camera, X, Check } from 'lucide-react-native'
import { safeHaptics } from '@/core/utils/haptics'
import { ForwardLogo, PremiumInput, PremiumButton, GlassCard, ConfirmModal } from '@/core/ui'
import { useColors, useIsDark } from '@/libs/theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useProductoForm, FRACCIONES, UBICACIONES, fraccionWord } from '@/features/inventario/hooks/useProductoForm'
import { MotiView } from 'moti'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { canViewCost } from '@/features/ventas/lib/descuentos'

// ── Componente ────────────────────────────────────────────────────────────────

export default function NuevoProductoScreen() {
  const colors = useColors()
  const isDark = useIsDark()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const navigation = useNavigation()

  // S4 (ADR-6): resolve roles from auth store; gate cost field and create action
  const user = useAuthStore((s) => s.user)
  const userRoles = (user?.roles as string[] | undefined) ?? []
  const userCanViewCost = canViewCost(userRoles)

  const {
    isPending, isUploading,
    nombre, setNombre,
    descripcion, setDescripcion,
    bultoContenido, setBultoContenido,
    blisterContenido, setBlisterContenido,
    fraccionMinimaVenta, setFraccionMinimaVenta,
    ventaMinimaUnidades, setVentaMinimaUnidades,
    precioCompra, setPrecioCompra,
    margen, setMargen,
    ubicacion, setUbicacion,
    stockInicial, setStockInicial,
    stockMinimo, setStockMinimo,
    imageUri, setImageUri, setImageUrl,
    precioVentaSugerido,
    ventaMinimaPreview,
    grossProfit,
    roiPercentage,
    pickImage,
    handleSubmit,
    // State lifecycle management
    resetFormState,
    // Modal
    modalConfig,
  } = useProductoForm()

  // ── State Lifecycle: useFocusEffect (cleanup para creación) ───────────────
  useFocusEffect(
    React.useCallback(() => {
      resetFormState()
      return () => resetFormState()
    }, [resetFormState])
  )

  // S4 FIX #1 (ADR-6 / Decision #81): product-create is cost-roles only.
  // Non-cost roles get a read-only access-denied view, NOT a partially-editable form.
  // Web mirrors this with an early-return banner (producto-form.tsx lines ~69-75).
  if (!userCanViewCost) {
    return (
      <View
        testID="access-denied-inventario"
        style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', padding: 32 }}
      >
        <Package size={48} color={colors.textMuted} style={{ opacity: 0.4, marginBottom: 20 }} />
        <Text style={{ fontSize: 16, fontFamily: 'Outfit_700Bold', color: colors.textMuted, textAlign: 'center', marginBottom: 8 }}>
          ACCESS DENIED
        </Text>
        <Text style={{ fontSize: 12, fontFamily: 'Outfit_400Regular', color: colors.textMuted, textAlign: 'center', opacity: 0.7 }}>
          Only cost-authorized roles (Administrador, Gerente, AdministradorSistemas) can create or edit products.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)/inventario')}
          style={{ marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border }}
        >
          <Text style={{ fontSize: 12, fontFamily: 'Outfit_700Bold', color: colors.text }}>VOLVER AL INVENTARIO</Text>
        </TouchableOpacity>
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
        <MotiView
          from={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
        >
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
            NUEVO PRODUCTO
          </Text>
          <Text style={{ fontSize: 9, fontFamily: 'Outfit_800ExtraBold', color: colors.primary, letterSpacing: 1.5 }}>
            CONTROL MAESTRO DE CATÁLOGO
          </Text>
        </View>
        <TouchableOpacity 
          onPress={() => router.replace('/(tabs)/inventario')} 
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}
        >
          <X size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        
        {/* Selector de Imagen */}
        <View style={{ alignItems: 'center', marginTop: 10, marginBottom: 24 }}>
          <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 15 }}
          >
            <TouchableOpacity 
              onPress={pickImage}
              disabled={isUploading}
              style={{ 
                width: 140, height: 140, backgroundColor: colors.surface2, 
                borderRadius: 30, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, 
                alignItems: 'center', justifyContent: 'center', overflow: 'hidden' 
              }}
            >
              {imageUri ? (
                <>
                  <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  {isUploading && (
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                      <ActivityIndicator color={colors.primary} />
                    </View>
                  )}
                  <TouchableOpacity 
                    onPress={() => { setImageUri(null); setImageUrl(null) }}
                    style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(239, 68, 68, 0.9)', borderRadius: 12, padding: 6 }}
                  >
                    <X size={14} color="white" />
                  </TouchableOpacity>
                </>
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <Camera size={24} color={isDark ? '#fff' : '#000'} opacity={0.5} />
                  </View>
                  <Text style={{ color: colors.textMuted, fontSize: 10, fontFamily: 'Outfit_800ExtraBold', opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1 }}>SUBIR ASSET</Text>
                </View>
              )}
            </TouchableOpacity>
          </MotiView>
        </View>

        {/* Sección 1 — Información Básica */}
        <MotiView from={{ opacity: 0, translateY: 20 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: 100 }}>
          <View style={styles.sectionHeader}>
            <Package size={14} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }]}>ESPECIFICACIONES TÉCNICAS</Text>
          </View>
          
          <PremiumInput
            label="Nombre del Artículo"
            value={nombre}
            onChangeText={setNombre}
            placeholder="EJ: BATERÍA 9V DURACELL"
            autoCapitalize="characters"
          />

          <PremiumInput
            label="Descripción Técnica"
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder="DETALLES ADICIONALES DEL SKU..."
            multiline
            numberOfLines={3}
          />
        </MotiView>

        {/* Sección 2 — Empaque y fracción mínima de venta.
            El precio y el stock SIEMPRE son por unidad; esto solo declara cómo viene
            empaquetado y en qué fracción se vende. */}
        <MotiView from={{ opacity: 0, translateY: 20 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: 200 }} style={{ marginTop: 10 }}>
          <Text style={[styles.subSectionTitle, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }]}>EMPAQUE (OPCIONAL)</Text>

          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <PremiumInput
                label="Unid. por blister"
                keyboardType="numeric"
                value={blisterContenido}
                onChangeText={setBlisterContenido}
                placeholder="Ej: 6"
              />
            </View>
            <View style={{ flex: 1 }}>
              <PremiumInput
                label="Unid. por bulto"
                keyboardType="numeric"
                value={bultoContenido}
                onChangeText={setBultoContenido}
                placeholder="Ej: 800"
              />
            </View>
          </View>

          <Text style={[styles.subSectionTitle, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }]}>FRACCIÓN MÍNIMA DE VENTA</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            {FRACCIONES.map((f) => {
              const selected = fraccionMinimaVenta === f.value
              return (
                <TouchableOpacity
                  key={f.value}
                  onPress={() => {
                    safeHaptics.impact('light')
                    setFraccionMinimaVenta(f.value)
                  }}
                  style={[
                    styles.unitChip,
                    { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
                    selected && { backgroundColor: colors.primary, borderColor: colors.primary }
                  ]}
                >
                  <Text style={[styles.unitChipText, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }, selected && { color: '#fff' }]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
          {fraccionMinimaVenta === 'Pack' && (
            <View style={{ marginBottom: 12 }}>
              <PremiumInput
                label="Unidades por pack"
                keyboardType="numeric"
                value={ventaMinimaUnidades}
                onChangeText={setVentaMinimaUnidades}
                placeholder="Ej: 12"
              />
              {(blisterContenido || bultoContenido) && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  {blisterContenido ? (
                    <TouchableOpacity
                      onPress={() => { safeHaptics.impact('light'); setVentaMinimaUnidades(blisterContenido) }}
                      style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }}
                    >
                      <Text style={{ fontSize: 11, fontFamily: 'Outfit_600SemiBold', color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }}>
                        Usar blister ({blisterContenido})
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  {bultoContenido ? (
                    <TouchableOpacity
                      onPress={() => { safeHaptics.impact('light'); setVentaMinimaUnidades(bultoContenido) }}
                      style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }}
                    >
                      <Text style={{ fontSize: 11, fontFamily: 'Outfit_600SemiBold', color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }}>
                        Usar bulto ({bultoContenido})
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
            </View>
          )}
          <Text style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', fontSize: 11, fontFamily: 'Outfit_500Medium' }}>
            {ventaMinimaPreview > 1
              ? `Se venderá de a ${ventaMinimaPreview} unidades por ${fraccionWord(fraccionMinimaVenta)}. El precio y el stock se siguen manejando por unidad.`
              : 'Se venderá por unidad. El precio y el stock se manejan por unidad.'}
          </Text>
        </MotiView>

        {/* Sección 3 — Precios e Inventario */}
        <MotiView from={{ opacity: 0, translateY: 20 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: 300 }} style={{ marginTop: 10 }}>
          <Text style={[styles.subSectionTitle, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }]}>COSTOS E INVENTARIO</Text>
          
          {/* S4 (ADR-6): cost fields visible only to cost-authorized roles */}
          {userCanViewCost && (
            <>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 10 }}>
                <View style={{ flex: 1 }}>
                  <PremiumInput
                    label="Costo Base (ARS)"
                    keyboardType="numeric"
                    value={precioCompra}
                    onChangeText={setPrecioCompra}
                    placeholder="0.00"
                    icon={<DollarSign size={16} color={colors.primary} />}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <PremiumInput
                    label="Margen (%)"
                    keyboardType="numeric"
                    value={margen}
                    onChangeText={setMargen}
                    placeholder="20"
                  />
                </View>
              </View>

              {/* Precio de Venta Calculado - Widget Premium */}
              <MotiView
                animate={{
                  scale: [1, 1.02, 1],
                }}
                transition={{
                  type: 'timing',
                  duration: 2000,
                  loop: true,
                }}
              >
                <GlassCard style={[styles.priceWidget, { borderLeftColor: colors.primary }]}>
                  <View>
                    <Text style={[styles.priceLabel, { color: colors.primary }]}>VALOR SUGERIDO DE SALIDA</Text>
                    <Text style={[styles.priceValue, { color: colors.primary }]}>
                      ${precioVentaSugerido.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <View style={[styles.priceIconContainer, { backgroundColor: colors.primary + '20' }]}>
                    <DollarSign size={24} color={colors.primary} strokeWidth={3} />
                  </View>
                </GlassCard>
              </MotiView>

              {/* ROI Preview — shown only when cost > 0 (D6 / web parity) */}
              {parseFloat(precioCompra) > 0 && (
                <View style={styles.roiRow}>
                  <View style={styles.roiChip}>
                    <Text style={styles.roiLabel}>GANANCIA</Text>
                    <Text style={[styles.roiValue, { color: grossProfit >= 0 ? colors.primary : '#ef4444' }]}>
                      ${grossProfit.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <View style={styles.roiChip}>
                    <Text style={styles.roiLabel}>ROI</Text>
                    <Text style={[styles.roiValue, { color: roiPercentage >= 0 ? colors.primary : '#ef4444' }]}>
                      {roiPercentage.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              )}
            </>
          )}

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
            <View style={{ flex: 1 }}>
              <PremiumInput
                label="Stock Inicial"
                keyboardType="numeric"
                value={stockInicial}
                onChangeText={(v) => setStockInicial(v.replace(/[^0-9]/g, ''))} 
                placeholder="0"
              />
            </View>
            <View style={{ flex: 1 }}>
              <PremiumInput
                label="Alerta Mínima"
                keyboardType="numeric"
                value={stockMinimo}
                onChangeText={(v) => setStockMinimo(v.replace(/[^0-9]/g, ''))}
                placeholder="10"
              />
            </View>
          </View>

          <View style={{ marginBottom: 20 }}>
            <Text style={[styles.fieldLabel, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }]}>UBICACIÓN EN ALMACÉN</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {UBICACIONES.map((loc) => {
                const selected = ubicacion === loc.value
                return (
                  <TouchableOpacity
                    key={loc.value}
                    onPress={() => {
                      safeHaptics.impact('light')
                      setUbicacion(loc.value)
                    }}
                    style={[
                      styles.locChip,
                      { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
                      selected && { backgroundColor: colors.primary + '15', borderColor: colors.primary }
                    ]}
                  >
                    <Text style={[styles.locChipText, { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }, selected && { color: colors.primary }]}>
                      {loc.label === 'Ninguna' ? <MapPin size={12} color={selected ? colors.primary : (isDark ? "#fff" : "#000")} opacity={0.5} /> : loc.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        </MotiView>

        {/* Footer Acciones */}
        <MotiView from={{ opacity: 0, translateY: 20 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: 400 }} style={styles.footer}>
          {/* S4 (ADR-6): create action visible only to cost-authorized roles */}
          {userCanViewCost && (
            <PremiumButton
              title="CREAR ARTÍCULO"
              onPress={handleSubmit}
              loading={isPending}
              icon={<Check size={20} color="#fff" strokeWidth={3} />}
            />
          )}

          <PremiumButton
            title="CANCELAR"
            variant="secondary"
            onPress={() => router.replace('/(tabs)/inventario')}
            style={{ backgroundColor: 'transparent' }}
          />
        </MotiView>
      </ScrollView>

      <View style={{ alignItems: 'center', paddingBottom: insets.bottom + 20 }}>
        <View style={{ opacity: 0.2 }}>
          <ForwardLogo size={24} />
        </View>
      </View>

      <ConfirmModal
        visible={modalConfig.visible}
        title={modalConfig.title}
        message={modalConfig.message}
        variant={modalConfig.variant}
        confirmLabel={modalConfig.confirmLabel}
        cancelLabel={modalConfig.cancelLabel}
        hideButtons={modalConfig.hideButtons}
        onConfirm={modalConfig.onConfirm}
        onCancel={modalConfig.onCancel}
      />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  sectionTitle: { fontSize: 9, fontFamily: 'Outfit_900Black', textTransform: 'uppercase', letterSpacing: 2 },
  subSectionTitle: { fontSize: 11, fontFamily: 'Outfit_800ExtraBold', textTransform: 'uppercase', marginBottom: 16, letterSpacing: 1 },
  unitChip: { flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: 'center', borderWidth: 1 },
  unitChipText: { fontFamily: 'Outfit_700Bold', fontSize: 13 },
  detailBox: { backgroundColor: 'rgba(0, 193, 158, 0.05)', padding: 16, borderRadius: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(0, 193, 158, 0.15)' },
  priceWidget: { padding: 20, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderLeftWidth: 4 },
  priceLabel: { fontSize: 9, fontFamily: 'Outfit_900Black', textTransform: 'uppercase', letterSpacing: 1.5 },
  priceValue: { fontSize: 32, fontFamily: 'Outfit_900Black', marginTop: 4 },
  priceIconContainer: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  roiRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  roiChip: { flex: 1, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: 'rgba(0,193,158,0.06)', borderWidth: 1, borderColor: 'rgba(0,193,158,0.15)' },
  roiLabel: { fontSize: 8, fontFamily: 'Outfit_900Black', textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(0,193,158,0.7)', marginBottom: 2 },
  roiValue: { fontSize: 18, fontFamily: 'Outfit_900Black' },
  fieldLabel: { fontSize: 9, fontFamily: 'Outfit_800ExtraBold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, marginLeft: 4 },
  locChip: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1 },
  locChipText: { fontSize: 12, fontFamily: 'Outfit_600SemiBold' },
  footer: { marginTop: 20, gap: 12 }
})
