import React, { useState, useCallback, useMemo } from 'react'
import {
  View, Text, TextInput, Pressable, TouchableOpacity,
  ActivityIndicator, Alert, Appearance,
  ScrollView, StyleSheet, Platform
} from 'react-native'
import { useRouter, Link, useNavigation } from 'expo-router'
import { DrawerActions } from '@react-navigation/native';
import * as Haptics from 'expo-haptics'
import { safeHaptics } from '@/core/utils/haptics'
import { 
  Search, Plus, Pencil, UserX, Users, 
  ShieldCheck, Shield, Settings,
  ChevronRight, ArrowRight, ShieldAlert,
  MoreVertical, Info, Check, X, UserPlus, ShieldPlus
} from 'lucide-react-native'
import { FlashList } from '@shopify/flash-list'
import { BlurView } from 'expo-blur'
import { MotiView, AnimatePresence } from 'moti'
import Animated, { FadeInDown, FadeIn, FadeOut, Layout } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useUsuarios, useToggleActivo } from '@/libs/api-client/admin'
import type { UserListItem } from '@/libs/api-client/types'
import { 
  ForwardLogo, TopHeaderActions, ConfirmModal, 
  RequirePermission, GlassCard, SegmentedControl,
  KpiCardMobile, AuroraGlow, PremiumButton, PremiumInput,
  AnimatedListItem
} from '@/core/ui'
import { useColors, useThemeStore, useIsDark } from '@/libs/theme'
import { useRBAC } from '@/src/features/security/hooks/useRBAC'
import type { PermissionProfile } from '@/src/features/security/api/securityApi'

// ── Helpers ───────────────────────────────────────────────────────────────────

// 4-tier role model: AdministradorSistemas, Administrador, Gerencia, Empleado.
const getRoleColor = (role: string | null | undefined, colors: any) => {
  const primary = colors?.primary || '#00d1c1';
  if (!role || typeof role !== 'string') return '#64748B';
  const r = role.toLowerCase();
  if (r.includes('sistemas')) return primary;
  if (r.includes('admin')) return '#4F46E5';
  if (r.includes('gerencia') || r.includes('gerente')) return '#F59E0B';
  if (r.includes('empleado')) return '#10B981';
  return '#64748B';
}

const getRoleLabel = (role: string) => {
  if (role === 'AdministradorSistemas') return 'Super Admin';
  return role;
}

const getRoleRank = (roleName: string) => {
  const name = roleName.toLowerCase();
  if (name.includes('sistemas')) return 1;
  if (name.includes('admin')) return 1;
  if (name.includes('gerencia') || name.includes('gerente')) return 2;
  if (name.includes('empleado')) return 3;
  return 4;
};

const getRankLabel = (rank: number) => {
  switch (rank) {
    case 1: return 'Dirección & Sistemas';
    case 2: return 'Gerencia';
    case 3: return 'Operación';
    default: return 'Otros';
  }
}

// ── Components ────────────────────────────────────────────────────────────────

function UserAvatar({ nombre, apellido, role }: { nombre: string; apellido: string; role: string }) {
  const colors = useColors()
  const isDark = useIsDark()
  const initials = `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase()
  const bg = getRoleColor(role, colors)
  return (
    <View style={{
      width: 64, height: 64, borderRadius: 20,
      backgroundColor: bg + (isDark ? '15' : '10'),
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: bg + (isDark ? '30' : '20')
    }}>
      <Text style={{ color: bg, fontSize: 24, fontWeight: '900', letterSpacing: -1 }}>{initials}</Text>
    </View>
  )
}

function UserCardPremium({
  user, onEdit, onToggle, isSessionActive, index, rank
}: { user: UserListItem; onEdit: () => void; onToggle: () => void; isSessionActive?: boolean; index: number; rank?: number }) {
  const colors = useColors()
  const isDark = useIsDark()
  const mainRole = (user.roles ?? [])[0] ?? 'Sin Rol'
  const roleColor = getRoleColor(mainRole, colors)

  return (
    <MotiView
      from={{ opacity: 0, translateX: -20 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ type: 'timing', duration: 400, delay: index * 50 }}
      style={{ marginBottom: 12, width: '100%' }}
    >
      <TouchableOpacity activeOpacity={0.8} onPress={onEdit} style={{ width: '100%' }}>
        <GlassCard 
          intensity={isDark ? 10 : 25}
          style={{ 
            width: '100%', 
            padding: 20, 
            borderRadius: 28, 
            backgroundColor: isSessionActive ? colors.primary + '15' : colors.surface + '90',
            borderWidth: 1.5,
            borderColor: user.estaActivo ? colors.success : colors.danger,
            flexDirection: 'row',
            alignItems: 'center',
            overflow: 'hidden'
          }}>
          {/* Left Accent Bar */}
          <View style={{ 
            position: 'absolute', left: 0, top: '25%', bottom: '25%', 
            width: 4, backgroundColor: roleColor, borderRadius: 2 
          }} />

          {/* Avatar Section */}
          <View style={{ position: 'relative' }}>
            <UserAvatar nombre={user.nombre ?? ''} apellido={user.apellido ?? ''} role={mainRole} />
            {isSessionActive && (
              <MotiView 
                from={{ scale: 0.8, opacity: 0.5 }}
                animate={{ scale: 1.2, opacity: 1 }}
                transition={{ loop: true, type: 'timing', duration: 1500 }}
                style={{ 
                  position: 'absolute', bottom: -2, right: -2, 
                  width: 14, height: 14, borderRadius: 7, 
                  backgroundColor: '#10B981', borderWidth: 2, borderColor: colors.surface,
                }} 
              />
            )}
          </View>

          {/* Info Section */}
          <View style={{ flex: 1, marginLeft: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text 
                style={{ color: colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.8 }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {user.nombre} {user.apellido}
              </Text>
              {!user.estaActivo && (
                <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#EF444420' }}>
                  <Text style={{ color: '#EF4444', fontSize: 9, fontWeight: '900' }}>SUSPENDIDO</Text>
                </View>
              )}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: roleColor, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {getRoleLabel(mainRole)}
                </Text>
              </View>
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
              <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800' }}>RANK LVL-{rank || '?'}</Text>
            </View>
            
            <Text 
              style={{ color: colors.textMuted, fontSize: 12, marginTop: 8, fontWeight: '600' }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {(user.email ?? '').toLowerCase()}
            </Text>
          </View>

          {/* Action/Chevron Section */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ChevronRight size={22} color={colors.border} />
          </View>
        </GlassCard>
      </TouchableOpacity>
    </MotiView>
  )
}


function SpeedDial({ 
  onAddUser, onAddProfile 
}: { onAddUser: () => void; onAddProfile: () => void }) {
  const [open, setOpen] = useState(false)
  const colors = useColors()
  const isDark = useIsDark()
  const insets = useSafeAreaInsets()

  const toggle = () => {
    safeHaptics.impact('medium')
    setOpen(!open)
  }

  const actions = [
    { icon: <ShieldPlus size={20} color="#FFF" />, label: 'Plantilla de Permisos', color: '#EC4899', onPress: () => { toggle(); onAddProfile(); } },
    { icon: <UserPlus size={20} color="#FFF" />, label: 'Nuevo Usuario', color: colors.primary, onPress: () => { toggle(); onAddUser(); } },
  ]

  return (
    <>
      {open && (
        <MotiView 
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 998 }}
        >
          <TouchableOpacity style={{ flex: 1 }} onPress={toggle} />
        </MotiView>
      )}
      
      <View style={{ position: 'absolute', bottom: insets.bottom + 20, right: 20, alignItems: 'flex-end', zIndex: 999 }}>
        <AnimatePresence>
          {open && (
            <View style={{ marginBottom: 16, gap: 12 }}>
              {actions.map((action, i) => (
                <MotiView
                  key={i}
                  from={{ opacity: 0, scale: 0, translateY: 20 }}
                  animate={{ opacity: 1, scale: 1, translateY: 0 }}
                  exit={{ opacity: 0, scale: 0, translateY: 20 }}
                  transition={{ type: 'spring', damping: 12, delay: i * 50 }}
                >
                  <TouchableOpacity 
                    onPress={action.onPress}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}
                  >
                    <GlassCard style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '900', letterSpacing: 0.5 }}>{action.label.toUpperCase()}</Text>
                    </GlassCard>
                    <View style={{ 
                      width: 52, height: 52, borderRadius: 20, 
                      backgroundColor: action.color, 
                      alignItems: 'center', justifyContent: 'center', 
                      shadowColor: action.color, shadowRadius: 12, shadowOpacity: 0.6,
                      elevation: 8
                    }}>
                      {action.icon}
                    </View>
                  </TouchableOpacity>
                </MotiView>
              ))}
            </View>
          )}
        </AnimatePresence>

        <TouchableOpacity 
          onPress={toggle}
          activeOpacity={0.9}
          style={{ 
            width: 68, height: 68, borderRadius: 26, 
            backgroundColor: open ? colors.surface3 : colors.primary, 
            alignItems: 'center', justifyContent: 'center',
            shadowColor: open ? '#000' : colors.primary, shadowRadius: 20, shadowOpacity: 0.6,
            borderWidth: 1, borderColor: colors.border
          }}
        >
          <MotiView
            animate={{ rotate: open ? '135deg' : '0deg' }}
            transition={{ type: 'spring', damping: 15 }}
          >
            <Plus size={36} color={open ? colors.text : (isDark ? '#000' : '#FFF')} strokeWidth={2.5} />
          </MotiView>
        </TouchableOpacity>
      </View>
    </>
  )
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function UsuariosScreen() {
  const navigation = useNavigation();
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const themeColors = useColors()
  const isDark = useIsDark()
  const colors = themeColors || { primary: '#00d1c1', text: '#FFFFFF', textSecondary: '#FFFFFF60' }

  const [activeTab, setActiveTab] = useState<'STAFF' | 'PERFILES'>('STAFF')
  const [search, setSearch] = useState('')
  const [filterOpt, setFilterOpt] = useState<'Todos' | 'Activos' | 'Bloqueados'>('Todos')
  const [selectedRole, setSelectedRole] = useState<string | null>(null)

  // RBAC Hook — perfiles de permisos (la pestaña "Roles" del modelo viejo desaparece;
  // ahora espejamos la web: Equipo + Perfiles de permisos).
  const {
    profiles,
    sessions,
    isLoading: isLoadingRBAC,
  } = useRBAC()

  const { data, isLoading, isRefetching, refetch } = useUsuarios({
    searchTerm: search || undefined,
    isActive: filterOpt === 'Todos' ? undefined : filterOpt === 'Activos',
    role: selectedRole || undefined,
    pageNumber: 1,
    pageSize: 100,
  })

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
  
  const [pendingToggle, setPendingToggle] = useState<{ id: string, name: string, active: boolean } | null>(null)

  const toggleActivo = useToggleActivo()

  const requestToggle = useCallback((user: UserListItem) => {
    safeHaptics.impact('medium')
    setPendingToggle({ id: user.id ?? '', name: `${user.nombre ?? ''} ${user.apellido ?? ''}`, active: user.estaActivo ?? false })

    setModalConfig({
      visible: true,
      title: user.estaActivo ? 'Bloquear Acceso' : 'Restaurar Acceso',
      message: `¿Estás seguro que deseas ${user.estaActivo ? 'quitarle' : 'devolverle'} el acceso al sistema a ${user.nombre ?? ''} ${user.apellido ?? ''}?`,
      variant: user.estaActivo ? 'danger' : 'success',
      confirmLabel: user.estaActivo ? 'Bloquear' : 'Restaurar',
      cancelLabel: 'Cancelar',
      onConfirm: () => confirmToggle(user.id ?? ''),
      onCancel: () => setModalConfig(prev => ({ ...prev, visible: false }))
    })
  }, [])

  const confirmToggle = (userId: string) => {
    toggleActivo.mutate(userId, {
      onSettled: () => {
        setModalConfig(prev => ({ ...prev, visible: false }))
        setPendingToggle(null)
      }
    })
  }



  const openProfile = useCallback((id: string) => {
    safeHaptics.impact('medium')
    router.push(`/(tabs)/usuarios/perfil/${id}`)
  }, [router])

  const grantedModules = (profile: PermissionProfile) =>
    (profile.detalles ?? []).filter(d => d.canRead || d.canCreate || d.canUpdate || d.canDelete).length


  const users = useMemo(() => {
    let list = data?.items ?? [];
    
    // Client-side search optimization
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(u =>
        (u.nombre ?? '').toLowerCase().includes(s) ||
        (u.apellido ?? '').toLowerCase().includes(s) ||
        (u.email ?? '').toLowerCase().includes(s) ||
        (u.roles ?? []).some(r => r.toLowerCase().includes(s))
      );
    }

    if (filterOpt === 'Bloqueados') return list.filter(u => !u.estaActivo);
    if (filterOpt === 'Activos') return list.filter(u => u.estaActivo);
    return list;
  }, [data, search, filterOpt]);

  const groupedUsers = useMemo(() => {
    const grouped: Record<number, UserListItem[]> = {};
    users.forEach(u => {
      const mainRole = (u.roles ?? [])[0] ?? 'Sin Rol';
      const rank = getRoleRank(mainRole);
      if (!grouped[rank]) grouped[rank] = [];
      grouped[rank].push(u);
    });
    return grouped;
  }, [users]);

  const kpiActivos = (data?.items ?? []).filter(u => u.estaActivo).length
  const kpiBloqueados = (data?.items ?? []).filter(u => !u.estaActivo).length

  return (
    <RequirePermission module="MOD_USUARIOS" action="read" mode="screen">
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Superior Header */}
        {/* Compact Enterprise Header */}
        <BlurView intensity={25} tint={isDark ? "dark" : "light"} style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View style={{ paddingTop: insets.top + 2, paddingBottom: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity
                  onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
                  style={{ 
                    width: 38, height: 38, borderRadius: 12, 
                    backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', 
                    borderWidth: 1, borderColor: colors.border,
                  }}
                >
                  <ForwardLogo size={22} showText={false} />
                </TouchableOpacity>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text, letterSpacing: -0.5 }}>Usuarios</Text>
                  <Text style={{ fontSize: 9, color: colors.primary, fontWeight: '900', letterSpacing: 1, marginTop: -1 }}>EQUIPO Y PERMISOS</Text>

                </View>
              </View>
              <TopHeaderActions />
            </View>

            <View style={{ marginTop: 14, paddingHorizontal: 16 }}>
              <SegmentedControl
                options={[
                  { label: 'EQUIPO', value: 'STAFF' },
                  { label: 'PERFILES', value: 'PERFILES' }
                ]}
                value={activeTab}
                onChange={(v: any) => {
                  Haptics.selectionAsync()
                  setActiveTab(v)
                }}
              />
            </View>
          </View>
        </BlurView>

        <AnimatePresence>
          {activeTab === 'STAFF' ? (
            <MotiView
              key="staff"
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              exit={{ opacity: 0, translateY: 10 }}
              transition={{ type: 'timing', duration: 300 }}
              style={{ flex: 1 }}
            >
              <ScrollView 
                contentContainerStyle={{ paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
              >
                <View style={{ marginTop: 16 }}>
                    {/* Hero — encabezado limpio con KPIs reales */}
                    <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
                      <GlassCard style={{
                        width: '100%',
                        borderRadius: 28,
                        backgroundColor: colors.surface + '90',
                        overflow: 'hidden',
                        padding: 22
                      }}>
                        <AuroraGlow size={420} color={colors.primary} opacity={0.12} style={{ top: -180, left: -160 }} />

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                          <View style={{
                            width: 52, height: 52, borderRadius: 18,
                            backgroundColor: colors.primary,
                            alignItems: 'center', justifyContent: 'center',
                            shadowColor: colors.primary, shadowRadius: 16, shadowOpacity: 0.35
                          }}>
                            <Users size={26} color={isDark ? '#000' : '#FFF'} strokeWidth={2.5} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.8 }}>Equipo</Text>
                            <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 1 }}>Gestión de usuarios y accesos</Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          {[
                            { label: 'TOTAL', value: data?.totalCount ?? 0, color: colors.primary },
                            { label: 'ACTIVOS', value: kpiActivos, color: '#10B981' },
                            { label: 'BLOQUEADOS', value: kpiBloqueados, color: '#EF4444' },
                          ].map(kpi => (
                            <View key={kpi.label} style={{ flex: 1, backgroundColor: colors.surface2, padding: 14, borderRadius: 18 }}>
                              <Text style={{ color: kpi.color, fontSize: 24, fontWeight: '900', letterSpacing: -1 }}>{kpi.value}</Text>
                              <Text style={{ color: colors.textDisabled, fontSize: 8, fontWeight: '900', letterSpacing: 0.5, marginTop: 2 }}>{kpi.label}</Text>
                            </View>
                          ))}
                        </View>
                      </GlassCard>
                    </View>

                    {/* Unified Search Toolbar V3.7 */}
                    <View style={{ paddingHorizontal: 16 }}>
                      <View style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        gap: 12,
                        backgroundColor: colors.surface, 
                        borderRadius: 24,
                        paddingHorizontal: 16,
                        height: 64, 
                        borderWidth: 1,
                        borderColor: colors.border,
                        marginBottom: 20
                      }}>
                        <Search size={22} color={colors.primary} />
                        <TextInput
                          placeholder="Buscar personal..."
                          placeholderTextColor={colors.textDisabled}
                          value={search}
                          onChangeText={setSearch}
                          style={{ flex: 1, color: colors.text, fontSize: 16, fontWeight: '600' }}
                        />
                      </View>

                      {/* Filters */}
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 16 }}>
                        {(['Todos', 'Activos', 'Bloqueados'] as const).map((f) => {
                          const isSelected = filterOpt === f;
                          return (
                            <TouchableOpacity
                              key={f}
                              onPress={() => setFilterOpt(f)}
                              style={{
                                paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14,
                                backgroundColor: isSelected ? colors.primary + '15' : colors.surface2,
                                borderWidth: 1, borderColor: isSelected ? colors.primary + '30' : colors.border,
                              }}
                            >
                              <Text style={{ color: isSelected ? colors.primary : colors.textMuted, fontWeight: '900', fontSize: 11 }}>{f.toUpperCase()}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>

                      {/* Role Filters */}
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 16 }}>
                        {([
                          { label: 'Todos los roles', value: null },
                          { label: 'Administrador', value: 'Administrador' },
                          { label: 'Gerencia', value: 'Gerencia' },
                          { label: 'Empleado', value: 'Empleado' },
                        ] as const).map((opt) => {
                          const isSelected = selectedRole === opt.value
                          return (
                            <TouchableOpacity
                              key={String(opt.value)}
                              onPress={() => {
                                safeHaptics.selection()
                                setSelectedRole(opt.value)
                              }}
                              style={{
                                paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14,
                                backgroundColor: isSelected ? colors.primary + '20' : colors.surface2,
                                borderWidth: 1,
                                borderColor: isSelected ? colors.primary + '40' : colors.border,
                                flexDirection: 'row', alignItems: 'center', gap: 6,
                              }}
                            >
                              <Shield size={11} color={isSelected ? colors.primary : colors.textDisabled} />
                              <Text style={{ color: isSelected ? colors.primary : colors.textMuted, fontWeight: '900', fontSize: 11 }}>
                                {opt.label.toUpperCase()}
                              </Text>
                            </TouchableOpacity>
                          )
                        })}
                      </ScrollView>
                    </View>

                    {/* Grouped Staff Grid - Similar to Power Hierarchy */}
                    {isLoading ? (
                      <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
                    ) : (
                      <View style={{ paddingBottom: 40 }}>
                        {Object.keys(groupedUsers).sort((a, b) => Number(a) - Number(b)).map((rank) => {
                          const items = groupedUsers[Number(rank)];
                          if (items.length === 0) return null;
                          return (
                            <View key={rank} style={{ marginBottom: 24 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginBottom: 12 }}>
                                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary }} />
                                <Text style={{ color: colors.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>NIVEL {rank}</Text>
                                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                                <Text style={{ color: colors.textDisabled, fontSize: 8, fontWeight: '800' }}>{getRankLabel(Number(rank)).toUpperCase()}</Text>
                              </View>
                              
                              <View style={{ paddingHorizontal: 10, gap: 10, width: '100%' }}>
                                {items.map((user, idx) => (
                                  <UserCardPremium 
                                    key={user.id}
                                    user={user}
                                    index={idx}
                                    rank={Number(rank)}
                                    isSessionActive={sessions.some(s => s.userId === user.id)}
                                    onEdit={() => router.push(`/(tabs)/usuarios/${user.id}`)}
                                    onToggle={() => requestToggle(user)}
                                  />
                                ))}
                              </View>
                            </View>
                          );
                        })}
                        {users.length === 0 && (
                          <View style={{ paddingVertical: 100, alignItems: 'center' }}>
                            <UserX size={40} color={colors.textDisabled} />
                            <Text style={{ color: colors.textMuted, fontSize: 16, fontWeight: '800', marginTop: 16 }}>No se encontraron usuarios</Text>
                          </View>
                        )}
                      </View>
                    )}
                </View>
              </ScrollView>
            </MotiView>
          ) : (
            <MotiView
              key="seguridad"
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              exit={{ opacity: 0, translateY: 10 }}
              transition={{ type: 'timing', duration: 300 }}
              style={{ flex: 1 }}
            >
              <ScrollView 
                contentContainerStyle={{ paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
              >
                <View style={{ marginTop: 16 }}>
                    {/* Hero — Perfiles, encabezado limpio con KPIs reales */}
                    <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
                      <GlassCard
                        intensity={30}
                        style={{
                          width: '100%',
                          borderRadius: 28,
                          backgroundColor: colors.surface + '90',
                          overflow: 'hidden',
                          padding: 22
                        }}>
                        <AuroraGlow size={420} color={colors.primary} opacity={0.12} style={{ top: -180, left: -160 }} />

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                          <View style={{
                            width: 52, height: 52, borderRadius: 18,
                            backgroundColor: colors.primary,
                            alignItems: 'center', justifyContent: 'center',
                            shadowColor: colors.primary, shadowRadius: 16, shadowOpacity: 0.35
                          }}>
                            <ShieldCheck size={26} color={isDark ? '#000' : '#FFF'} strokeWidth={2.5} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.8 }}>Perfiles</Text>
                            <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 1 }}>Plantillas de permisos reutilizables</Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          {[
                            { label: 'PERFILES', value: profiles.length, color: colors.primary },
                            { label: 'ACTIVOS', value: profiles.filter(p => p.activo).length, color: '#10B981' },
                          ].map(kpi => (
                            <View key={kpi.label} style={{ flex: 1, backgroundColor: colors.surface2, padding: 14, borderRadius: 18 }}>
                              <Text style={{ color: kpi.color, fontSize: 24, fontWeight: '900', letterSpacing: -1 }}>{kpi.value}</Text>
                              <Text style={{ color: colors.textDisabled, fontSize: 8, fontWeight: '900', letterSpacing: 0.5, marginTop: 2 }}>{kpi.label}</Text>
                            </View>
                          ))}
                        </View>
                      </GlassCard>
                    </View>

                  {/* Perfiles de Permisos — espejo de la web (/usuarios/perfiles) */}
                  <View style={{ marginBottom: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', letterSpacing: -0.5 }}>Perfiles de Permisos</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '600' }}>Conjuntos reutilizables de permisos RCUD por módulo</Text>
                    </View>
                  </View>

                  {isLoadingRBAC ? (
                    <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
                  ) : profiles.length === 0 ? (
                    <View style={{ paddingVertical: 80, alignItems: 'center', paddingHorizontal: 40 }}>
                      <ShieldCheck size={40} color={colors.textDisabled} />
                      <Text style={{ color: colors.textMuted, fontSize: 15, fontWeight: '800', marginTop: 16, textAlign: 'center' }}>No hay perfiles definidos</Text>
                      <Text style={{ color: colors.textDisabled, fontSize: 12, fontWeight: '600', marginTop: 4, textAlign: 'center' }}>Creá el primero con el botón +</Text>
                    </View>
                  ) : (
                    <View style={{ paddingHorizontal: 16, paddingBottom: 100, gap: 10 }}>
                      {profiles.map((profile, idx) => {
                        const granted = grantedModules(profile)
                        return (
                          <MotiView
                            key={profile.id}
                            from={{ opacity: 0, translateY: 10 }}
                            animate={{ opacity: 1, translateY: 0 }}
                            transition={{ type: 'timing', duration: 300, delay: idx * 40 }}
                          >
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => openProfile(profile.id)}
                              style={{
                                flexDirection: 'row', alignItems: 'center', gap: 14,
                                padding: 16, borderRadius: 20,
                                backgroundColor: profile.activo ? colors.surface : colors.surface2,
                                borderWidth: 1.5, borderColor: profile.activo ? colors.success : colors.danger,
                                opacity: profile.activo ? 1 : 0.6,
                              }}
                            >
                              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primary + '10', alignItems: 'center', justifyContent: 'center' }}>
                                <ShieldCheck size={20} color={colors.primary} />
                              </View>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }} numberOfLines={1}>{profile.nombre}</Text>
                                  {!profile.activo && (
                                    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: colors.textMuted + '20' }}>
                                      <Text style={{ color: colors.textMuted, fontSize: 8, fontWeight: '900', letterSpacing: 0.5 }}>INACTIVO</Text>
                                    </View>
                                  )}
                                </View>
                                {!!profile.descripcion && (
                                  <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 2 }} numberOfLines={1}>{profile.descripcion}</Text>
                                )}
                                <Text style={{ color: colors.textDisabled, fontSize: 11, fontWeight: '700', marginTop: 4 }}>
                                  {granted} {granted === 1 ? 'módulo' : 'módulos'} con acceso
                                </Text>
                              </View>
                              <ChevronRight size={20} color={colors.border} />
                            </TouchableOpacity>
                          </MotiView>
                        )
                      })}
                    </View>
                  )}
                </View>

                {/* Se eliminó sección de auditoría por solicitud del usuario */}
              </ScrollView>
            </MotiView>
          )}
        </AnimatePresence>

        {/* Unified Action Button (SpeedDial) */}
        <RequirePermission module="MOD_USUARIOS" action="create">
          <SpeedDial 
            onAddUser={() => router.push('/(tabs)/usuarios/nuevo')}
            onAddProfile={() => router.push('/(tabs)/usuarios/perfil/new')}
          />
        </RequirePermission>

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
    </RequirePermission>
  )
}

const styles = StyleSheet.create({})
