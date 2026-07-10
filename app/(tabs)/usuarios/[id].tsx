import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View, Text, TouchableOpacity,
  ScrollView, Switch, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert,
  Modal
} from 'react-native'
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router'
import { DrawerActions, useFocusEffect } from '@react-navigation/native'
import {
  ArrowLeft, User, Mail, ShieldCheck, Check,
  UserCheck, UserX, X, ChevronLeft, Save,
  Trash2, Fingerprint, RefreshCcw, Shield,
  Box,
  Smartphone, Key, Globe, Activity, ShieldAlert,
  Zap, History, LayoutGrid, Eye, EyeOff,
  PlusCircle, Edit3
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { produce } from 'immer'
import { safeHaptics } from '@/core/utils/haptics'
import { MotiView, AnimatePresence } from 'moti'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { logger } from '@/core/utils/logger'
import { useQueryClient } from '@tanstack/react-query'
import { useIsDark } from '@/libs/theme'
import { formatToLocalTime } from '@/src/utils/date'

import { 
  ForwardLogo, PremiumInput, GlassCard, 
  AuroraGlow, PremiumButton, ConfirmModal 
} from '@/core/ui'
import { 
  useUsuario, useUpdateUsuario, useUpdatePermisos, 
  useToggleActivo, useUserSessions, useUserLogs,
  useResetPassword, adminKeys 
} from '@/libs/api-client/admin'
import { useRBAC } from '@/src/features/security/hooks/useRBAC'
import { useAuthStore } from '@/src/features/auth/store/auth.store'
import { useColors, BRAND } from '@/libs/theme'
import type { AppRole, AppModule, ModulePermission } from '@/libs/api-client/types'

// ── Role Config ───────────────────────────────────────────────────────────────

const ROLE_ICONS: Record<string, any> = {
  'Administrador': { icon: ShieldCheck, color: BRAND.blue, label: 'Administrador', desc: 'Gestión completa salvo configuración' },
  'Gerencia': { icon: User, color: '#7C3AED', label: 'Gerencia', desc: 'Supervisión y reportes' },
  'Empleado': { icon: Box, color: BRAND.lime, label: 'Empleado', desc: 'Acceso operativo según su perfil' },
  'AdministradorSistemas': { icon: ShieldAlert, color: '#EF4444', label: 'Super Admin', desc: 'Control total del sistema' },
}

const getRoleConfig = (name: string) => ROLE_ICONS[name] || { icon: Shield, color: '#64748B', label: name, desc: 'Rol personalizado' }

// ── Components ──────────────────────────────────────────────────────────────

// ── All 13 modules for the interactive permission matrix ──────────────────────
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
]

// ── Per-toggle component reusing the PermissionDetailScreen visual style ──────
const PermissionToggle = ({
  icon: Icon, label, active, color, onToggle, colors,
}: {
  icon: any; label: string; active: boolean; color: string;
  onToggle: () => void; colors: any
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

// ── Interactive PermissionMatrix ──────────────────────────────────────────────
const PermissionMatrix = ({
  permissions,
  onChange,
}: {
  permissions: ModulePermission[]
  onChange: (updated: ModulePermission[]) => void
}) => {
  const colors = useColors()

  const toggle = (moduleId: string, field: 'canRead' | 'canCreate' | 'canUpdate' | 'canDelete') => {
    safeHaptics.impact('light')
    const next = produce(permissions, (draft) => {
      let entry = draft.find(p => p.module === moduleId)
      if (!entry) {
        entry = { module: moduleId, canRead: false, canCreate: false, canUpdate: false, canDelete: false }
        draft.push(entry)
      }
      const newVal = !entry[field]
      entry[field] = newVal
      // Auto-enable canRead when any write permission is turned on
      if (newVal && field !== 'canRead') {
        entry.canRead = true
      }
    })
    onChange(next)
  }

  return (
    <GlassCard style={{ padding: 16, marginTop: 20, backgroundColor: colors.surface + '03' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <LayoutGrid size={18} color={BRAND.blue} />
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '900', letterSpacing: 1 }}>PERMISOS DEL USUARIO</Text>
      </View>

      <View style={{ gap: 12 }}>
        {ALL_MODULES.map((mod, idx) => {
          const entry = permissions.find(p => p.module === mod.id) ?? {
            module: mod.id, canRead: false, canCreate: false, canUpdate: false, canDelete: false,
          }

          return (
            <MotiView
              key={mod.id}
              from={{ opacity: 0, translateY: 8 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 250, delay: idx * 30 }}
            >
              <GlassCard intensity={10} style={{ padding: 14, borderRadius: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 16 }}>{mod.icon}</Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>{mod.label}</Text>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: colors.textDisabled }}>{mod.id}</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border + '20', paddingTop: 12 }}>
                  <PermissionToggle
                    icon={Eye} label="Ver"
                    active={entry.canRead ?? false}
                    color={BRAND.blue}
                    onToggle={() => toggle(mod.id, 'canRead')}
                    colors={colors}
                  />
                  <PermissionToggle
                    icon={PlusCircle} label="Crear"
                    active={entry.canCreate ?? false}
                    color={BRAND.lime}
                    onToggle={() => toggle(mod.id, 'canCreate')}
                    colors={colors}
                  />
                  <PermissionToggle
                    icon={Edit3} label="Editar"
                    active={entry.canUpdate ?? false}
                    color="#F59E0B"
                    onToggle={() => toggle(mod.id, 'canUpdate')}
                    colors={colors}
                  />
                  <PermissionToggle
                    icon={Trash2} label="Borrar"
                    active={entry.canDelete ?? false}
                    color="#EF4444"
                    onToggle={() => toggle(mod.id, 'canDelete')}
                    colors={colors}
                  />
                </View>
              </GlassCard>
            </MotiView>
          )
        })}
      </View>
    </GlassCard>
  )
}

const UserSessions = ({ sessions, onRevoke }: { sessions: any[], onRevoke: (id: string) => void }) => {
  const colors = useColors()
  if (!sessions || sessions.length === 0) return null;

  return (
    <View style={{ marginTop: 40 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Smartphone size={16} color={BRAND.blue} />
        <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '900', letterSpacing: 1.2 }}>SESIONES ACTIVAS</Text>
      </View>

      <View style={{ gap: 12 }}>
        {sessions.map((s) => (
          <GlassCard key={s.id} style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface + '03' }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: BRAND.blue + '15', alignItems: 'center', justifyContent: 'center' }}>
              <Smartphone size={20} color={BRAND.blue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>{s.device || 'Dispositivo Desconocido'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <Globe size={10} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>{s.ip}</Text>
                <Text style={{ color: colors.border }}>•</Text>
                <Text style={{ color: colors.textMuted, fontSize: 10 }}>{formatToLocalTime(s.createdAt)}</Text>
              </View>
            </View>
            <TouchableOpacity 
              onPress={() => onRevoke(s.id)}
              style={{ padding: 10, borderRadius: 10, backgroundColor: '#EF444415' }}
            >
              <ShieldAlert size={16} color="#EF4444" />
            </TouchableOpacity>
          </GlassCard>
        ))}
      </View>
    </View>
  );
};

export default function EditarUsuarioScreen() {
  const router = useRouter()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id: string }>()
  const queryClient = useQueryClient()
  const colors = useColors()
  const isDark = useIsDark()

  const { data: user, isLoading, refetch } = useUsuario(id!)
  const { data: sessions, refetch: refetchSessions } = useUserSessions(id!)
  const { data: logs } = useUserLogs(id!)
  const updateUsuario = useUpdateUsuario(id!)
  const updatePermisos = useUpdatePermisos(id!)
  const toggleActivo = useToggleActivo()
  const resetPassword = useResetPassword()
  const rbac = useRBAC()
  const { roles, profiles, isLoading: isLoadingRBAC, revokeSession } = rbac
  const { isSuperAdmin } = useAuthStore()

  const [nombre,   setNombre]   = useState('')
  const [apellido, setApellido] = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [role,     setRole]     = useState<string>('')
  const [showPassword, setShowPassword] = useState(false)
  const [permissions, setPermissions] = useState<ModulePermission[]>([])
  const [profileSheetVisible, setProfileSheetVisible] = useState(false)
  const [pendingProfile, setPendingProfile] = useState<any>(null)
  
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

  // Poblar datos al cargar
  useEffect(() => {
    if (user) {
      setNombre(user.nombre ?? '')
      setApellido(user.apellido ?? '')
      setEmail(user.email ?? '')
      setRole((user.roles ?? [])[0] ?? 'Empleado')
      setPermissions((user as any).permissions ?? [])
    }
  }, [user])

  // Encontrar perfil asociado al rol seleccionado
  const selectedRoleData = roles.find(r => r.name === role)
  const associatedProfile = profiles.find(p => p.id === selectedRoleData?.profileId)

  const handleSave = async () => {
    if (!nombre || !apellido || !email) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType?.Error || ('Error'.toLowerCase() as any))
      return setModalConfig({
        visible: true,
        title: 'Campos requeridos',
        message: 'Nombre, Apellido y Email son obligatorios.',
        variant: 'warning',
        confirmLabel: 'Entendido',
        onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false })),
        onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
      })
    }

    try {
      await updateUsuario.mutateAsync({ nombre, apellido, email, role: role as any, password })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType?.Success || ('Success'.toLowerCase() as any))
      setModalConfig({
        visible: true,
        title: '¡Éxito!',
        message: 'Perfil actualizado correctamente.',
        variant: 'success',
        confirmLabel: 'Excelente',
        onConfirm: () => {
          setModalConfig(prev => ({ ...prev, visible: false }))
          router.navigate('/(tabs)/usuarios')
        },
        onCancel: () => {
          setModalConfig(prev => ({ ...prev, visible: false }))
          router.navigate('/(tabs)/usuarios')
        },
      })
    } catch (e: any) {
      logger.error('ERROR_UPDATE_USER', { error: e, userId: id })
      setModalConfig({
        visible: true,
        title: 'Error',
        message: e?.message ?? 'No se pudo actualizar el usuario.',
        variant: 'danger',
        confirmLabel: 'Entendido',
        onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false })),
        onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
      })
    }
  }

  const confirmToggle = () => {
    toggleActivo.mutate(id!, {
      onSuccess: () => {
        setModalConfig(prev => ({ ...prev, visible: false }))
        Haptics.notificationAsync(Haptics.NotificationFeedbackType?.Success || ('Success'.toLowerCase() as any))
        refetch()
      }
    })
  }

  const handlePasswordReset = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType?.Warning || ('Warning'.toLowerCase() as any))
      await resetPassword.mutateAsync(id!)
      setModalConfig({
        visible: true,
        title: 'Link Enviado',
        message: `Se ha enviado un correo de recuperación a ${email}`,
        variant: 'success',
        confirmLabel: 'Entendido',
        onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false })),
        onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
      })
    } catch (e: any) {
      setModalConfig({
        visible: true,
        title: 'Error',
        message: e?.message || 'No se pudo procesar la solicitud',
        variant: 'danger',
        confirmLabel: 'Entendido',
        onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false })),
        onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
      })
    }
  }

  const handleRevokeSession = async (tokenId: string) => {
    try {
      await revokeSession(tokenId)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType?.Success || ('Success'.toLowerCase() as any))
      refetchSessions()
    } catch (e: any) {
      setModalConfig({
        visible: true,
        title: 'Error',
        message: 'No se pudo cerrar la sesión',
        variant: 'danger',
        confirmLabel: 'Entendido',
        onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false })),
        onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
      })
    }
  }

  if (isLoading || isLoadingRBAC) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={BRAND.blue} />
      </View>
    )
  }

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <UserX size={48} color={colors.textMuted} />
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 20 }}>Usuario no encontrado</Text>
        <TouchableOpacity onPress={() => router.navigate('/(tabs)/usuarios')} style={{ marginTop: 20 }}>
          <Text style={{ color: BRAND.blue, fontWeight: '700' }}>VOLVER ATRÁS</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AuroraGlow color={user.estaActivo ? `${BRAND.blue}20` : '#EF444415'} />
      
      {/* Header */}
      <BlurView intensity={20} tint={isDark ? "dark" : "light"} style={{ paddingTop: insets.top + 10, paddingBottom: 15, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity 
          onPress={() => router.navigate('/(tabs)/usuarios')}
          style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}
        >
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        
        <View style={{ alignItems: 'center', flex: 1, paddingHorizontal: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: '900', color: colors.text, letterSpacing: -0.3 }}>Editar usuario</Text>
          <Text numberOfLines={1} style={{ fontSize: 12, color: colors.textMuted, fontWeight: '600', marginTop: 1 }}>
            {user.nombre} {user.apellido}
          </Text>
        </View>

        <TouchableOpacity 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle?.Medium || ('Medium'.toLowerCase() as any))
            setModalConfig({
              visible: true,
              title: user.estaActivo ? 'Suspender Acceso' : 'Reactivar Acceso',
              message: user.estaActivo 
                ? `¿Confirmas revocar el acceso a ${user.nombre}? No podrá ingresar al sistema hasta ser rehabilitado.` 
                : `¿Deseas habilitar nuevamente el acceso para ${user.nombre}?`,
              variant: user.estaActivo ? 'danger' : 'success',
              confirmLabel: user.estaActivo ? 'Suspender' : 'Reactivar',
              cancelLabel: 'Cancelar',
              onConfirm: confirmToggle,
              onCancel: () => setModalConfig(prev => ({ ...prev, visible: false }))
            })
          }}
          style={{ 
            width: 44, height: 44, borderRadius: 14, 
            backgroundColor: user.estaActivo ? '#EF444415' : '#22C55E15', 
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: user.estaActivo ? '#EF444430' : '#22C55E30'
          }}
        >
          {user.estaActivo ? <UserX size={20} color="#EF4444" /> : <UserCheck size={20} color="#22C55E" />}
        </TouchableOpacity>
      </BlurView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={{ padding: 20, paddingBottom: 160 }}
          showsVerticalScrollIndicator={false}
        >
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
          >
            {/* Status Indicator Tactical */}
            <GlassCard 
              intensity={15}
              style={{ 
                padding: 16, 
                marginBottom: 32, 
                flexDirection: 'row', 
                alignItems: 'center', 
                gap: 16, 
                borderColor: user.estaActivo ? `${BRAND.lime}40` : '#EF444440',
                backgroundColor: user.estaActivo ? `${BRAND.lime}05` : '#EF444405',
                borderWidth: 1.5,
                borderRadius: 20
              }}
            >
              <View style={{ 
                width: 48, 
                height: 48, 
                borderRadius: 16, 
                backgroundColor: user.estaActivo ? `${BRAND.lime}15` : '#EF444415',
                alignItems: 'center', 
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: user.estaActivo ? `${BRAND.lime}30` : '#EF444430'
              }}>
                <Activity size={24} color={user.estaActivo ? BRAND.lime : '#EF4444'} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>ESTADO DE CUENTA</Text>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 2 }}>
                  {user.estaActivo ? 'Cuenta activa' : 'Cuenta suspendida'}
                </Text>
              </View>

              <TouchableOpacity 
                activeOpacity={0.7}
                style={{ 
                  backgroundColor: colors.surface2, 
                  paddingHorizontal: 12, 
                  paddingVertical: 8, 
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <History size={14} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '900' }}>LOGS</Text>
              </TouchableOpacity>
            </GlassCard>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <User size={16} color={BRAND.blue} />
              <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '900', letterSpacing: 1.2 }}>INFORMACIÓN BASE</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <PremiumInput 
                  label="NOMBRE"
                  value={nombre}
                  onChangeText={setNombre}
                />
              </View>
              <View style={{ flex: 1 }}>
                <PremiumInput 
                  label="APELLIDO"
                  value={apellido}
                  onChangeText={setApellido}
                />
              </View>
            </View>

            <PremiumInput 
              label="EMAIL CORPORATIVO"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              icon={<Mail size={18} color={colors.textMuted} />}
            />

            <PremiumInput 
              label="CONTRASEÑA DE ACCESO"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              placeholder="••••••••"
              icon={<Key size={18} color={colors.textMuted} />}
              rightElement={
                <TouchableOpacity 
                  onPress={() => setShowPassword(!showPassword)}
                  style={{ padding: 8 }}
                >
                  {showPassword ? <EyeOff size={20} color={BRAND.blue} /> : <Eye size={20} color={colors.textMuted} />}
                </TouchableOpacity>
              }
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 40, marginBottom: 20 }}>
              <ShieldCheck size={16} color={BRAND.blue} />
              <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '900', letterSpacing: 1.2 }}>ROL Y AUTORIDAD</Text>
            </View>

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
                      <Icon size={20} color={isSelected ? config.color : colors.textMuted} />
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

            {/* Permission Preview */}
            <AnimatePresence>
              {associatedProfile && (
                <MotiView
                  key={associatedProfile.id}
                  from={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ marginTop: 24, overflow: 'hidden' }}
                >
                  <GlassCard style={{ padding: 16, backgroundColor: colors.surface + '03', borderStyle: 'dashed', borderWidth: 1, borderColor: colors.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <Fingerprint size={16} color={BRAND.lime} />
                      <Text style={{ color: BRAND.lime, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>PERFIL: {associatedProfile.nombre.toUpperCase()}</Text>
                    </View>
                    
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {associatedProfile.detalles.filter(d => d.canRead).slice(0, 6).map(d => (
                        <View key={d.module} style={{ backgroundColor: colors.surface2, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}>
                          <Text style={{ color: colors.textMuted, fontSize: 9, fontWeight: '800' }}>{d.module.replace('MOD_', '')}</Text>
                        </View>
                      ))}
                      {associatedProfile.detalles.length > 6 && (
                        <View style={{ backgroundColor: colors.surface2, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                          <Text style={{ color: colors.textDisabled, fontSize: 9, fontWeight: '800' }}>+{associatedProfile.detalles.length - 6} MÁS</Text>
                        </View>
                      )}
                    </View>
                  </GlassCard>
                </MotiView>
              )}
            </AnimatePresence>

            {/* "Aplicar Perfil" — super admin only */}
            {isSuperAdmin() && (
              <TouchableOpacity
                onPress={() => {
                  safeHaptics.impact('medium')
                  setProfileSheetVisible(true)
                }}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  padding: 14, borderRadius: 16,
                  backgroundColor: '#7C3AED15',
                  borderWidth: 1, borderColor: '#7C3AED30',
                  marginTop: 24,
                }}
              >
                <ShieldAlert size={18} color="#7C3AED" />
                <Text style={{ color: '#7C3AED', fontWeight: '900', fontSize: 13, letterSpacing: 1 }}>
                  APLICAR PERFIL DE PERMISOS
                </Text>
              </TouchableOpacity>
            )}

            {/* Interactive permission matrix */}
            <PermissionMatrix permissions={permissions} onChange={setPermissions} />

            {/* Save permissions */}
            <TouchableOpacity
              onPress={async () => {
                try {
                  await updatePermisos.mutateAsync(permissions)
                  safeHaptics.notification('success')
                  setModalConfig({
                    visible: true,
                    title: 'Permisos actualizados',
                    message: 'Los permisos del usuario fueron guardados correctamente.',
                    variant: 'success',
                    confirmLabel: 'Excelente',
                    onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false })),
                    onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
                  })
                } catch (e: any) {
                  safeHaptics.notification('error')
                  setModalConfig({
                    visible: true,
                    title: 'Error',
                    message: e?.message ?? 'No se pudieron guardar los permisos.',
                    variant: 'danger',
                    confirmLabel: 'Entendido',
                    onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false })),
                    onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
                  })
                }
              }}
              disabled={updatePermisos.isPending}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: 8, marginTop: 16, padding: 14, borderRadius: 16,
                backgroundColor: BRAND.blue + '15',
                borderWidth: 1, borderColor: BRAND.blue + '30',
                opacity: updatePermisos.isPending ? 0.6 : 1,
              }}
            >
              {updatePermisos.isPending
                ? <ActivityIndicator size="small" color={BRAND.blue} />
                : <Save size={16} color={BRAND.blue} />
              }
              <Text style={{ color: BRAND.blue, fontWeight: '900', fontSize: 13, letterSpacing: 1 }}>
                GUARDAR PERMISOS
              </Text>
            </TouchableOpacity>

            <UserSessions
              sessions={sessions || []}
              onRevoke={handleRevokeSession}
            />

            {/* Password Reset Removed per User Request */}
          </MotiView>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Action Footer */}
      <BlurView intensity={40} tint={isDark ? "dark" : "light"} style={{ position: 'absolute', bottom: 0, width: '100%', padding: 20, paddingBottom: insets.bottom + 10 }}>
        <PremiumButton 
          title="ACTUALIZAR PERFIL"
          onPress={handleSave}
          loading={updateUsuario.isPending}
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

      {/* Profile selection bottom-sheet (super admin only) */}
      <Modal
        visible={profileSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setProfileSheetVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <MotiView
            from={{ translateY: 400 }}
            animate={{ translateY: 0 }}
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: 32, borderTopRightRadius: 32,
              padding: 24, paddingBottom: insets.bottom + 20,
              maxHeight: '75%',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <View>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', letterSpacing: -0.5 }}>APLICAR PERFIL</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 2 }}>
                  Reemplaza los permisos actuales del usuario
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setProfileSheetVisible(false)}
                style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ gap: 12 }}>
                {rbac.profiles.filter(p => (p as any).activo !== false).map((profile) => (
                  <TouchableOpacity
                    key={profile.id}
                    onPress={() => {
                      safeHaptics.impact('medium')
                      setPendingProfile(profile)
                    }}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 14,
                      backgroundColor: colors.surface2, padding: 16, borderRadius: 16,
                      borderWidth: 1.5, borderColor: colors.border,
                    }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#7C3AED15', alignItems: 'center', justifyContent: 'center' }}>
                      <Shield size={20} color="#7C3AED" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>{profile.nombre}</Text>
                      {profile.descripcion ? (
                        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{profile.descripcion}</Text>
                      ) : null}
                    </View>
                    <ChevronLeft size={18} color={colors.textDisabled} style={{ transform: [{ rotate: '180deg' }] }} />
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </MotiView>
        </View>
      </Modal>

      {/* Confirm profile application */}
      <ConfirmModal
        visible={!!pendingProfile}
        title="Aplicar Perfil"
        message={`Esto reemplazará los permisos actuales del usuario con los del perfil "${pendingProfile?.nombre ?? ''}". ¿Confirmás?`}
        variant="warning"
        confirmLabel="Aplicar"
        cancelLabel="Cancelar"
        onCancel={() => setPendingProfile(null)}
        onConfirm={async () => {
          if (!pendingProfile) return
          try {
            await rbac.applyProfile({ profileId: pendingProfile.id, userId: id! })
            await refetch()
            safeHaptics.notification('success')
          } catch (e: any) {
            safeHaptics.notification('error')
            setModalConfig({
              visible: true,
              title: 'Error',
              message: e?.message ?? 'No se pudo aplicar el perfil.',
              variant: 'danger',
              confirmLabel: 'Entendido',
              onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false })),
              onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
            })
          } finally {
            setPendingProfile(null)
            setProfileSheetVisible(false)
          }
        }}
      />
    </View>
  )
}