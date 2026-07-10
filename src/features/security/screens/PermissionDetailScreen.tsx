import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, Switch } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { PermissionProfile, PermissionProfileDetail } from '../api/securityApi'
import { GlassCard, PremiumInput, AuroraGlow, ConfirmModal } from '@/core/ui'
import { Shield, Save, ArrowLeft, Eye, Edit3, PlusCircle, Trash2, LayoutGrid, ShieldCheck, Activity } from 'lucide-react-native'
import { useColors, BRAND, useIsDark } from '@/libs/theme'
import { logger } from '@/core/utils/logger'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MotiView, AnimatePresence } from 'moti'
import { useRouter } from 'expo-router'
import { produce } from 'immer'
import { useRBAC, rbacKeys } from '../hooks/useRBAC'
import { safeHaptics } from '@/core/utils/haptics'
import { BlurView } from 'expo-blur'

interface Props {
  profileId: string
}

export const PermissionDetailScreen = ({ profileId }: Props) => {
  const colors = useColors()
  const isDark = useIsDark()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const queryClient = useQueryClient()
  const rbac = useRBAC()

  // Local state for editing
  const [editedProfile, setEditedProfile] = useState<PermissionProfile | null>(null)
  const [isSaving, setIsSaving] = useState(false)
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

  // Find profile from cache if exists, otherwise it will be fetched (handled by useEffect)
  useEffect(() => {
    if (profileId === 'new') {
      setEditedProfile({
        id: '',
        nombre: '',
        descripcion: '',
        activo: true,
        detalles: []
      })
    } else {
      const profile = rbac.profiles.find(p => p.id === profileId)
      if (profile) {
        setEditedProfile(profile)
      } else {
        // If not in cache (direct deep link), we might need a separate query
        // but useRBAC already fetches all profiles. Let's wait for them.
      }
    }
  }, [profileId, rbac.profiles])

  const handleSave = async () => {
    if (!editedProfile?.nombre) {
      setModalConfig({
        visible: true,
        title: 'Error',
        message: 'El nombre del perfil es obligatorio',
        variant: 'danger',
        confirmLabel: 'Entendido',
        hideButtons: false,
        onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false })),
        onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
      })
      return
    }

    setIsSaving(true)
    try {
      if (profileId === 'new') {
        await rbac.createProfile(editedProfile)
      } else {
        await rbac.updateProfile({ id: profileId, profile: editedProfile })
      }
      safeHaptics.notification('success')
      setModalConfig({
        visible: true,
        title: 'Éxito',
        message: 'Perfil guardado correctamente',
        variant: 'success',
        confirmLabel: 'Excelente',
        hideButtons: false,
        onConfirm: () => {
          setModalConfig(prev => ({ ...prev, visible: false }))
          router.navigate('/(tabs)/usuarios')
        },
        onCancel: () => {
          setModalConfig(prev => ({ ...prev, visible: false }))
          router.navigate('/(tabs)/usuarios')
        },
      })
    } catch (err) {
      logger.error('ERROR_SAVE_PERMISSION_PROFILE', { error: err, profileId })
      setModalConfig({
        visible: true,
        title: 'Error',
        message: 'No se pudo guardar el perfil. Revisa la conexión.',
        variant: 'danger',
        confirmLabel: 'Entendido',
        hideButtons: false,
        onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false })),
        onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (profileId === 'new') return

    setModalConfig({
      visible: true,
      title: 'Desactivar Rol',
      message: '¿Estás seguro que deseas desactivar los permisos de este rol? Se revocarán inmediatamente de todos los usuarios que lo tengan asignado.',
      variant: 'danger',
      confirmLabel: 'Desactivar',
      cancelLabel: 'Cancelar',
      onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
      onConfirm: async () => {
        setModalConfig(prev => ({ ...prev, visible: false }))
        setIsSaving(true)
        try {
          await rbac.deleteProfile(profileId)
          safeHaptics.notification('success')
          router.navigate('/(tabs)/usuarios')
        } catch (err) {
          setModalConfig({
            visible: true,
            title: 'Error',
            message: 'No se pudo desactivar el rol',
            variant: 'danger',
            confirmLabel: 'Entendido',
            onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false })),
            onCancel: () => setModalConfig(prev => ({ ...prev, visible: false })),
          })
        } finally {
          setIsSaving(false)
        }
      }
    })
  }

  const togglePermission = (moduleName: string, permission: keyof Omit<PermissionProfileDetail, 'id' | 'module'>) => {
    if (!editedProfile) return
    safeHaptics.impact('light')
    
    setEditedProfile(produce(editedProfile, draft => {
      let detail = draft.detalles.find(d => d.module === moduleName)
      if (!detail) {
        detail = {
          id: `local-${moduleName}`,
          module: moduleName,
          canRead: false,
          canCreate: false,
          canUpdate: false,
          canDelete: false
        }
        draft.detalles.push(detail)
      }
      
      // Update the specific permission
      const newVal = !detail[permission];
      (detail[permission] as boolean) = newVal;
      if (newVal && (permission === 'canCreate' || permission === 'canUpdate' || permission === 'canDelete')) {
        detail.canRead = true;
      }
    }))
  }

  const modules = [
    { id: 'MOD_VENTAS', label: 'Ventas', icon: '🛒' },
    { id: 'MOD_COMPRAS', label: 'Compras', icon: '📦' },
    { id: 'MOD_STOCK', label: 'Stock', icon: '🏢' },
    { id: 'MOD_PEDIDOS', label: 'Pedidos', icon: '📝' },
    { id: 'MOD_VIAJES', label: 'Logística', icon: '🚚' },
    { id: 'MOD_CC', label: 'Cta. Corriente', icon: '💳' },
    { id: 'MOD_PAGOS', label: 'Tesorería', icon: '💰' },
    { id: 'MOD_PRODUCTOS', label: 'Productos', icon: '📦' },
    { id: 'MOD_CLIENTES', label: 'Clientes', icon: '👥' },
    { id: 'MOD_PROVEEDORES', label: 'Proveedores', icon: '🏭' },
    { id: 'MOD_REPORTES', label: 'Reportes', icon: '📊' },
    { id: 'MOD_USUARIOS', label: 'Usuarios', icon: '🛡️' },
    { id: 'MOD_CONFIGURACION', label: 'Configuración', icon: '⚙️' },
  ]

  if (!editedProfile && profileId !== 'new') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Premium Header */}
      <BlurView intensity={25} tint={isDark ? "dark" : "light"} style={{ zIndex: 10 }}>
        <View style={{ paddingTop: insets.top + 10, paddingBottom: 16, paddingHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TouchableOpacity 
              onPress={() => router.navigate('/(tabs)/usuarios')}
              style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}
            >
              <ArrowLeft color={colors.text} size={22} />
            </TouchableOpacity>
            
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text, letterSpacing: -0.5 }}>
                {profileId === 'new' ? 'NUEVO PERFIL' : 'EDITAR PERFIL'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                <Text style={{ fontSize: 9, color: colors.primary, fontWeight: '900', letterSpacing: 1 }}>PLANTILLA DE PERMISOS</Text>
              </View>
            </View>

            <TouchableOpacity 
              onPress={handleSave}
              disabled={isSaving}
              style={{ 
                width: 44, height: 44, borderRadius: 16, 
                backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
                shadowColor: colors.primary, shadowRadius: 10, shadowOpacity: 0.3
              }}
            >
              {isSaving ? <ActivityIndicator color={isDark ? "#000" : "#FFF"} size="small" /> : <Save color={isDark ? "#000" : "#FFF"} size={22} />}
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>

      <ScrollView 
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <AuroraGlow size={500} color={colors.primary} opacity={0.1} style={{ top: -100, right: -100 }} />
        
        <View style={{ padding: 20 }}>
          <GlassCard style={{ padding: 24, borderRadius: 32, backgroundColor: colors.surface + '90', borderWidth: 1, borderColor: colors.border }}>
             <View style={{ marginBottom: 24 }}>
                <View style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldCheck size={28} color={colors.primary} />
                </View>
             </View>

            <PremiumInput
              label="ETIQUETA DEL PERFIL"
              placeholder="Ej: Contador, Encargado de depósito..."
              value={editedProfile?.nombre}
              onChangeText={(text) => setEditedProfile(p => p ? {...p, nombre: text} : null)}
              containerStyle={{ marginBottom: 20 }}
            />

            <PremiumInput
              label="DESCRIPCIÓN OPERATIVA"
              placeholder="Define el alcance de este perfil..."
              value={editedProfile?.descripcion}
              onChangeText={(text) => setEditedProfile(p => p ? {...p, descripcion: text} : null)}
              multiline
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 }}>
              <View>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>Perfil activo</Text>
                <Text style={{ color: colors.textDisabled, fontSize: 11, marginTop: 2 }}>Los usuarios con este perfil mantienen sus permisos</Text>
              </View>
              <Switch
                value={editedProfile?.activo ?? true}
                onValueChange={(val) => setEditedProfile(p => p ? { ...p, activo: val } : null)}
                trackColor={{ false: colors.border, true: colors.primary + '80' }}
                thumbColor={editedProfile?.activo ? colors.primary : colors.textDisabled}
              />
            </View>
          </GlassCard>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 40, marginBottom: 20, paddingHorizontal: 4 }}>
            <LayoutGrid size={18} color={colors.primary} />
            <Text style={{ fontSize: 14, fontWeight: '900', color: colors.text, letterSpacing: 1 }}>MATRIZ DE ACCESO GRANULAR</Text>
          </View>

          <View style={{ gap: 12 }}>
            {modules.map((mod, idx) => {
              const detail = editedProfile?.detalles.find(d => d.module === mod.id) || {
                canRead: false, canCreate: false, canUpdate: false, canDelete: false
              }

              return (
                <MotiView
                  key={mod.id}
                  from={{ opacity: 0, translateY: 10 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 300, delay: idx * 50 }}
                >
                  <GlassCard intensity={15} style={{ padding: 16, borderRadius: 24, borderWidth: 1, borderColor: colors.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 18 }}>{mod.icon}</Text>
                        </View>
                        <View>
                          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>{mod.label}</Text>
                          <Text style={{ fontSize: 9, fontWeight: '700', color: colors.textDisabled }}>{mod.id}</Text>
                        </View>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border + '20', paddingTop: 16 }}>
                      <PermissionToggle 
                        icon={Eye} label="Ver" 
                        active={detail.canRead} 
                        onToggle={() => togglePermission(mod.id, 'canRead')} 
                        colors={colors}
                      />
                      <PermissionToggle 
                        icon={PlusCircle} label="Crear" 
                        active={detail.canCreate} 
                        onToggle={() => togglePermission(mod.id, 'canCreate')} 
                        colors={colors}
                      />
                      <PermissionToggle 
                        icon={Edit3} label="Edit" 
                        active={detail.canUpdate} 
                        onToggle={() => togglePermission(mod.id, 'canUpdate')} 
                        colors={colors}
                      />
                      <PermissionToggle 
                        icon={Trash2} label="Borrar" 
                        active={detail.canDelete} 
                        onToggle={() => togglePermission(mod.id, 'canDelete')} 
                        colors={colors}
                      />
                    </View>
                  </GlassCard>
                </MotiView>
              )
            })}
          </View>

          {profileId !== 'new' && (
            <TouchableOpacity 
              onPress={handleDelete}
              style={{ 
                marginTop: 40, flexDirection: 'row', alignItems: 'center', 
                justifyContent: 'center', gap: 10, padding: 20, 
                borderRadius: 24, backgroundColor: '#EF444410', 
                borderWidth: 1, borderColor: '#EF444430' 
              }}
            >
              <Trash2 size={20} color="#EF4444" />
              <Text style={{ color: '#EF4444', fontWeight: '900', fontSize: 13, letterSpacing: 1 }}>DESACTIVAR ROL (REVOCAR PERMISOS)</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

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

const PermissionToggle = ({ icon: Icon, label, active, onToggle, colors }: any) => (
  <TouchableOpacity 
    onPress={onToggle}
    activeOpacity={0.7}
    style={{ alignItems: 'center', gap: 8, flex: 1 }}
  >
    <MotiView
      animate={{ 
        backgroundColor: active ? colors.primary + '20' : colors.surface2,
        borderColor: active ? colors.primary : colors.border
      }}
      style={{ 
        width: 48, height: 48, borderRadius: 16, 
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1.5
      }}
    >
      <Icon size={22} color={active ? colors.primary : colors.textDisabled} />
    </MotiView>
    <Text style={{ fontSize: 9, fontWeight: '900', color: active ? colors.text : colors.textDisabled, letterSpacing: 0.5 }}>
      {label.toUpperCase()}
    </Text>
  </TouchableOpacity>
)
