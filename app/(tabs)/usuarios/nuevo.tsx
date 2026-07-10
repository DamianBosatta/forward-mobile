import React, { useState, useCallback, useMemo, useEffect } from 'react'
import {
  View, Text, TouchableOpacity,
  ScrollView, Switch, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform
} from 'react-native'
import { useRouter, useNavigation } from 'expo-router'
import { DrawerActions, useFocusEffect } from '@react-navigation/native'
import {
  ArrowLeft, Eye, EyeOff, User, Mail, Lock,
  ShieldCheck, Check, X, Fingerprint,
  ChevronLeft, Save, Shield, Box,
  PlusCircle, Edit3, Trash2, ShieldAlert, LayoutGrid
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { safeHaptics } from '@/core/utils/haptics'
import { MotiView, AnimatePresence } from 'moti'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { logger } from '@/core/utils/logger'

import {
  ForwardLogo, PremiumInput, GlassCard,
  AuroraGlow, PremiumButton, ConfirmModal
} from '@/core/ui'
import { useCreateUsuario } from '@/libs/api-client/admin'
import { useRBAC } from '@/src/features/security/hooks/useRBAC'
import { useColors, BRAND } from '@/libs/theme'
import type { AppRole, AppModule, ModulePermission } from '@/libs/api-client/types'

// ── Module Registry ────────────────────────────────────────────────────────────

const ALL_MODULES = [
  { id: 'MOD_VENTAS',        label: 'Ventas',         icon: '🛒' },
  { id: 'MOD_COMPRAS',       label: 'Compras',        icon: '📦' },
  { id: 'MOD_STOCK',         label: 'Stock',          icon: '🏢' },
  { id: 'MOD_PEDIDOS',       label: 'Pedidos',        icon: '📝' },
  { id: 'MOD_VIAJES',        label: 'Logística',      icon: '🚚' },
  { id: 'MOD_CC',            label: 'Cta. Corriente', icon: '💳' },
  { id: 'MOD_PAGOS',         label: 'Tesorería',      icon: '💰' },
  { id: 'MOD_PRODUCTOS',     label: 'Productos',      icon: '🏷️' },
  { id: 'MOD_CLIENTES',      label: 'Clientes',       icon: '👥' },
  { id: 'MOD_PROVEEDORES',   label: 'Proveedores',    icon: '🏭' },
  { id: 'MOD_REPORTES',      label: 'Reportes',       icon: '📊' },
  { id: 'MOD_USUARIOS',      label: 'Usuarios',       icon: '🛡️' },
  { id: 'MOD_CONFIGURACION', label: 'Configuración',  icon: '⚙️' },
] as const

// ── Role Config ───────────────────────────────────────────────────────────────

const ROLE_ICONS: Record<string, any> = {
  'Administrador': { icon: ShieldCheck, color: BRAND.blue, label: 'Administrador', desc: 'Gestión completa salvo configuración' },
  'Gerencia': { icon: User, color: '#7C3AED', label: 'Gerencia', desc: 'Supervisión y reportes' },
  'Empleado': { icon: Box, color: BRAND.lime, label: 'Empleado', desc: 'Acceso operativo según su perfil' },
  // AdministradorSistemas is a system-only role; it is not creatable from this screen.
  'AdministradorSistemas': { icon: ShieldAlert, color: '#EF4444', label: 'Super Admin', desc: 'Control total del sistema' },
}

const getRoleConfig = (name: string) => ROLE_ICONS[name] || { icon: Shield, color: '#64748B', label: name, desc: 'Rol personalizado' }

// ── Permission Toggle ─────────────────────────────────────────────────────────

const PermissionToggle = ({ icon: Icon, label, active, color, onToggle, colors }: {
  icon: any; label: string; active: boolean; color: string; onToggle: () => void; colors: any
}) => (
  <TouchableOpacity
    onPress={onToggle}
    activeOpacity={0.7}
    style={{ alignItems: 'center', gap: 6, flex: 1 }}
  >
    <MotiView
      animate={{
        backgroundColor: active ? color + '20' : colors.surface2,
        borderColor: active ? color : colors.border,
      }}
      style={{
        width: 48, height: 48, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1.5,
      }}
    >
      <Icon size={20} color={active ? color : colors.textDisabled} />
    </MotiView>
    <Text style={{ fontSize: 9, fontWeight: '900', color: active ? colors.text : colors.textDisabled, letterSpacing: 0.5 }}>
      {label.toUpperCase()}
    </Text>
  </TouchableOpacity>
)

// ── Screen ────────────────────────────────────────────────────────────────────

export default function NuevoUsuarioScreen() {
  const router = useRouter()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const colors = useColors()
  const isDark = colors.background === '#000000'
  const createUser = useCreateUsuario()
  const { roles, profiles, isLoading: isLoadingRoles } = useRBAC()

  const [nombre,   setNombre]   = useState('')
  const [apellido, setApellido] = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [role,     setRole]     = useState<string>('Empleado')

  const [permissions, setPermissions] = useState<ModulePermission[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)

  const [modalConfig, setModalConfig] = useState<{
    visible: boolean;
    title: string;
    message?: string;
    variant: 'success' | 'danger' | 'warning' | 'info';
    confirmLabel?: string;
    cancelLabel?: string;
    hideButtons?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    variant: 'info',
    onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false })),
    onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
  })

  // Encontrar perfil asociado al rol seleccionado
  const selectedRoleData = roles.find(r => r.name === role)
  const associatedProfile = profiles.find(p => p.id === selectedRoleData?.profileId)

  // Pre-fill permissions based on selected role tier
  useEffect(() => {
    setSelectedProfileId(null)
    if (role === 'Administrador') {
      setPermissions(
        ALL_MODULES
          .filter(m => m.id !== 'MOD_CONFIGURACION')
          .map(m => ({ module: m.id, canRead: true, canCreate: true, canUpdate: true, canDelete: true }))
      )
    } else {
      setPermissions([])
    }
  }, [role])

  // Apply a permission profile preset
  const handleProfileSelect = (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId)
    if (!profile) return
    setSelectedProfileId(profileId)
    setPermissions(
      profile.detalles.map(d => ({
        module: d.module,
        canRead: d.canRead,
        canCreate: d.canCreate,
        canUpdate: d.canUpdate,
        canDelete: d.canDelete,
      }))
    )
  }

  // Toggle a single RCUD bit with auto-enable-read logic
  const togglePermission = (moduleName: string, field: 'canRead' | 'canCreate' | 'canUpdate' | 'canDelete') => {
    safeHaptics.impact('light')
    setPermissions(prev => {
      const existing = prev.find(p => p.module === moduleName)
      const current = existing ?? { module: moduleName, canRead: false, canCreate: false, canUpdate: false, canDelete: false }
      const updated = { ...current, [field]: !current[field] }
      // Auto-enable read when granting write permissions
      if ((field === 'canCreate' || field === 'canUpdate' || field === 'canDelete') && updated[field]) {
        updated.canRead = true
      }
      if (existing) {
        return prev.map(p => p.module === moduleName ? updated : p)
      } else {
        return [...prev, updated]
      }
    })
  }

  const handleSubmit = async () => {
    if (!nombre || !apellido || !email || !password) {
      safeHaptics.notification('error')
      return setModalConfig({
        visible: true,
        title: 'Campos requeridos',
        message: 'Completá todos los campos obligatorios.',
        variant: 'warning',
        confirmLabel: 'Entendido',
        hideButtons: false,
        onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false })),
        onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
      })
    }

    try {
      await createUser.mutateAsync({
        nombre,
        apellido,
        email,
        password,
        role: role as any,
        permissions
      })
      safeHaptics.notification('success')
      setModalConfig({
        visible: true,
        title: '¡Éxito!',
        message: `${nombre} ${apellido} fue creado correctamente.`,
        variant: 'success',
        confirmLabel: 'Visto',
        hideButtons: false,
        onConfirm: () => {
          setModalConfig(prev => ({ ...prev, visible: false }))
          router.replace('/(tabs)/usuarios')
        },
        onCancel: () => {
          setModalConfig(prev => ({ ...prev, visible: false }))
          router.replace('/(tabs)/usuarios')
        },
      })
    } catch (e: any) {
      logger.error('ERROR_CREATE_USER', { error: e, email })
      setModalConfig({
        visible: true,
        title: 'Error',
        message: e?.message ?? 'No se pudo crear el usuario.',
        variant: 'danger',
        confirmLabel: 'Entendido',
        hideButtons: false,
        onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false })),
        onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
      })
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AuroraGlow color={`${BRAND.blue}${isDark ? '20' : '10'}`} />

      {/* Header */}
      <BlurView
        intensity={isDark ? 20 : 40}
        tint={isDark ? 'dark' : 'light'}
        style={{
          paddingTop: insets.top + 10,
          paddingBottom: 15,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottomWidth: 1,
          borderBottomColor: colors.border
        }}
      >
        <TouchableOpacity
          onPress={() => router.navigate('/(tabs)/usuarios')}
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.border
          }}
        >
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: '900', color: colors.text, letterSpacing: -0.3 }}>Nuevo usuario</Text>
          <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600', marginTop: 1 }}>Alta de acceso al sistema</Text>
        </View>
        <View style={{ width: 44 }} />
      </BlurView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 160 }}
          showsVerticalScrollIndicator={false}
        >
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 100 }}
          >
            {/* ── Personal Data ──────────────────────────────────────────────── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <User size={16} color={BRAND.blue} />
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '900', letterSpacing: 1.2 }}>DATOS PERSONALES</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <PremiumInput
                  label="NOMBRE"
                  value={nombre}
                  onChangeText={setNombre}
                  placeholder="Ej: Damian"
                />
              </View>
              <View style={{ flex: 1 }}>
                <PremiumInput
                  label="APELLIDO"
                  value={apellido}
                  onChangeText={setApellido}
                  placeholder="Ej: Rossi"
                />
              </View>
            </View>

            <PremiumInput
              label="EMAIL CORPORATIVO"
              value={email}
              onChangeText={setEmail}
              placeholder="usuario@forward.com"
              keyboardType="email-address"
              autoCapitalize="none"
              icon={<Mail size={18} color={colors.textDisabled} />}
            />

            <View style={{ marginTop: 16 }}>
              <PremiumInput
                label="CONTRASEÑA TEMPORAL"
                value={password}
                onChangeText={setPassword}
                placeholder="********"
                secureTextEntry
                autoCapitalize="none"
                icon={<Lock size={18} color={colors.textDisabled} />}
              />
            </View>

            {/* ── Authority Level ────────────────────────────────────────────── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 40, marginBottom: 20 }}>
              <ShieldCheck size={16} color={BRAND.blue} />
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '900', letterSpacing: 1.2 }}>NIVEL DE AUTORIDAD</Text>
            </View>

            {isLoadingRoles ? (
              <ActivityIndicator color={BRAND.blue} />
            ) : (
              <View style={{ gap: 10 }}>
                {roles.map((r) => {
                  const isSelected = role === r.name
                  const config = getRoleConfig(r.name)
                  const Icon = config.icon

                  return (
                    <TouchableOpacity
                      key={r.id}
                      activeOpacity={0.8}
                      onPress={() => {
                        Haptics.selectionAsync()
                        setRole(r.name)
                      }}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 14,
                        padding: 14, borderRadius: 18,
                        backgroundColor: isSelected ? config.color + '12' : colors.surface,
                        borderWidth: 1.5,
                        borderColor: isSelected ? config.color + '55' : colors.border,
                      }}
                    >
                      <View style={{
                        width: 44, height: 44, borderRadius: 13,
                        backgroundColor: isSelected ? config.color + '20' : colors.surface2,
                        alignItems: 'center', justifyContent: 'center'
                      }}>
                        <Icon size={20} color={isSelected ? config.color : colors.textDisabled} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>{config.label}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600', marginTop: 1 }} numberOfLines={1}>
                          {config.desc}
                        </Text>
                      </View>
                      <View style={{
                        width: 22, height: 22, borderRadius: 11,
                        alignItems: 'center', justifyContent: 'center',
                        borderWidth: 2,
                        borderColor: isSelected ? config.color : colors.border,
                        backgroundColor: isSelected ? config.color : 'transparent',
                      }}>
                        {isSelected && <Check size={13} color={isDark ? '#000' : '#FFF'} strokeWidth={3} />}
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}

            {/* Permission inheritance preview from role's associated profile */}
            <AnimatePresence>
              {associatedProfile && (
                <MotiView
                  key={associatedProfile.id}
                  from={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ marginTop: 24, overflow: 'hidden' }}
                >
                  <GlassCard style={{
                    padding: 16,
                    backgroundColor: isDark ? colors.surface : colors.surface2,
                    borderStyle: 'dashed',
                    borderWidth: 1,
                    borderColor: colors.border
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <Fingerprint size={16} color={BRAND.lime} />
                      <Text style={{ color: BRAND.lime, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>HERENCIA: {associatedProfile.nombre.toUpperCase()}</Text>
                    </View>
                    <Text style={{ color: colors.textDisabled, fontSize: 10, marginBottom: 12 }}>
                      Al crear la cuenta, el usuario tendrá acceso a los siguientes módulos:
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {associatedProfile.detalles.filter(d => d.canRead).slice(0, 8).map(d => (
                        <View key={d.module} style={{ backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}>
                          <Text style={{ color: colors.textSecondary, fontSize: 9, fontWeight: '800' }}>{d.module.replace('MOD_', '')}</Text>
                        </View>
                      ))}
                    </View>
                  </GlassCard>
                </MotiView>
              )}
            </AnimatePresence>

            {/* ── Profile / Specialization Picker ───────────────────────────── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 40, marginBottom: 16 }}>
              <Fingerprint size={16} color={BRAND.lime} />
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '900', letterSpacing: 1.2 }}>PERFIL / ESPECIALIZACIÓN</Text>
            </View>
            <Text style={{ color: colors.textDisabled, fontSize: 11, marginBottom: 12 }}>
              Seleccionar un perfil pre-configura la matriz de permisos.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {profiles.filter(p => (p as any).activo !== false).map(p => (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => handleProfileSelect(p.id)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
                    backgroundColor: selectedProfileId === p.id ? `${BRAND.lime}20` : colors.surface2,
                    borderWidth: 1,
                    borderColor: selectedProfileId === p.id ? `${BRAND.lime}50` : colors.border,
                  }}
                >
                  <Text style={{ color: selectedProfileId === p.id ? BRAND.lime : colors.textMuted, fontSize: 12, fontWeight: '800' }}>
                    {p.nombre}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* ── RCUD Permission Matrix ─────────────────────────────────────── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 40, marginBottom: 20 }}>
              <LayoutGrid size={16} color={BRAND.blue} />
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '900', letterSpacing: 1.2 }}>MATRIZ DE PERMISOS</Text>
            </View>

            <View style={{ gap: 12 }}>
              {ALL_MODULES.map((mod, idx) => {
                const perm = permissions.find(p => p.module === mod.id) ?? { module: mod.id, canRead: false, canCreate: false, canUpdate: false, canDelete: false }
                return (
                  <MotiView
                    key={mod.id}
                    from={{ opacity: 0, translateY: 10 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', duration: 300, delay: idx * 30 }}
                  >
                    <GlassCard intensity={15} style={{ padding: 16, borderRadius: 24 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 18 }}>{mod.icon}</Text>
                        </View>
                        <View>
                          <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>{mod.label}</Text>
                          <Text style={{ fontSize: 9, fontWeight: '700', color: colors.textDisabled }}>{mod.id}</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border + '20', paddingTop: 16 }}>
                        <PermissionToggle icon={Eye} label="Ver" active={perm.canRead ?? false} color={BRAND.blue} onToggle={() => togglePermission(mod.id, 'canRead')} colors={colors} />
                        <PermissionToggle icon={PlusCircle} label="Crear" active={perm.canCreate ?? false} color={BRAND.lime} onToggle={() => togglePermission(mod.id, 'canCreate')} colors={colors} />
                        <PermissionToggle icon={Edit3} label="Editar" active={perm.canUpdate ?? false} color="#F59E0B" onToggle={() => togglePermission(mod.id, 'canUpdate')} colors={colors} />
                        <PermissionToggle icon={Trash2} label="Borrar" active={perm.canDelete ?? false} color="#EF4444" onToggle={() => togglePermission(mod.id, 'canDelete')} colors={colors} />
                      </View>
                    </GlassCard>
                  </MotiView>
                )
              })}
            </View>
          </MotiView>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Action Footer */}
      <BlurView
        intensity={isDark ? 40 : 80}
        tint={isDark ? 'dark' : 'light'}
        style={{
          position: 'absolute',
          bottom: 0,
          width: '100%',
          padding: 20,
          paddingBottom: insets.bottom + 10,
          borderTopWidth: 1,
          borderTopColor: colors.border
        }}
      >
        <PremiumButton
          title="CREAR USUARIO"
          onPress={handleSubmit}
          loading={createUser.isPending}
          icon={<Save size={20} color={isDark ? "#000" : "#FFF"} />}
        />
      </BlurView>

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
    </View>
  )
}
