import { View, Text, Pressable } from 'react-native'
import { useRouter, useNavigation } from 'expo-router'
import { DrawerActions } from '@react-navigation/native';
import { useAuthStore } from '../../libs/store/auth.store'
import { useThemeStore, useColors, type ThemeMode } from '../../libs/theme'
import { LogOut, Sun, Moon, Monitor, Shield, Building2 } from 'lucide-react-native'
import { ForwardLogo, ConfirmModal } from '@/core/ui'
import { API_URL, setApiUrl, ENV_PROD, ENV_DEV, ENV_LOCAL } from '@/libs/api-client'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { safeHaptics } from '@/core/utils/haptics'
const THEME_OPTIONS: { mode: ThemeMode; label: string; Icon: any }[] = [
  { mode: 'dark', label: 'Oscuro', Icon: Moon },
  { mode: 'light', label: 'Claro', Icon: Sun },
  { mode: 'system', label: 'Sistema', Icon: Monitor },
]

export default function PerfilScreen() {
  const navigation = useNavigation();
  const { user, logout } = useAuthStore()
  const { mode, setMode } = useThemeStore()
  const colors = useColors()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()

  const [logoutVisible, setLogoutVisible] = useState(false)
  const [envModalVisible, setEnvModalVisible] = useState(false)
  const [pendingEnvUrl, setPendingEnvUrl] = useState<string | null>(null)

  const handleLogout = () => {
    setLogoutVisible(true)
  }

  const handleEnvChange = (url: string) => {
    if (url === API_URL) return
    setPendingEnvUrl(url)
    setEnvModalVisible(true)
  }

  const confirmEnvChange = async () => {
    if (!pendingEnvUrl) return
    safeHaptics.notification('success')
    await setApiUrl(pendingEnvUrl)
    // Drop in-memory cache too (setApiUrl already wiped the persisted copy) so the
    // next login refetches from the new API instead of serving the old backend's data.
    queryClient.clear()
    logout()
    router.replace('/login')
    setEnvModalVisible(false)
  }

  const confirmLogout = () => {
    safeHaptics.notification('success')
    logout()
    router.replace('/login')
    setLogoutVisible(false)
  }

  const userRoles = user?.roles?.join(', ') || 'Colaborador'
  const isSuperAdmin = userRoles.toLowerCase().includes('admin')

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20, paddingTop: insets.top || 48 }}>
      <Text style={{ fontSize: 28, fontWeight: '900', color: colors.text, marginBottom: 24 }}>Ajustes</Text>

      {/* User Card */}
      <View style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 24, marginBottom: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
        <View style={{ marginBottom: 16 }}>
          <ForwardLogo size={42} showText={false} onPress={() => { safeHaptics.impact('light'); navigation.dispatch(DrawerActions.openDrawer()); }} />
        </View>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900' }}>{user?.username || 'Usuario'}</Text>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: isSuperAdmin ? colors.primary + '15' : colors.surface2, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
          {isSuperAdmin ? <Shield size={12} color={colors.primary} /> : <Building2 size={12} color={colors.textMuted} />}
          <Text style={{ color: isSuperAdmin ? colors.primary : colors.textMuted, fontSize: 13, fontWeight: '700', textTransform: 'uppercase' }}>
            {userRoles}
          </Text>
        </View>
      </View>

      {/* Theme Toggle */}
      <View style={{ backgroundColor: colors.surface, borderRadius: 24, overflow: 'hidden', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
        <View style={{ paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>Apariencia (Tema)</Text>
        </View>
        <View style={{ flexDirection: 'row', padding: 8, gap: 6 }}>
          {THEME_OPTIONS.map(({ mode: m, label, Icon }) => {
            const isActive = mode === m
            return (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingVertical: 12,
                  borderRadius: 16,
                  backgroundColor: isActive ? colors.primary : 'transparent',
                  shadowColor: isActive ? colors.primary : 'transparent',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: isActive ? 0.3 : 0,
                  shadowRadius: 4,
                  elevation: isActive ? 2 : 0,
                }}
              >
                <Icon size={16} color={isActive ? '#fff' : colors.textMuted} strokeWidth={isActive ? 2.5 : 2} />
                <Text style={{ fontSize: 13, fontWeight: isActive ? '800' : '600', color: isActive ? '#fff' : colors.textMuted }}>
                  {label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      {/* Info */}
      <View style={{ backgroundColor: colors.surface, borderRadius: 24, overflow: 'hidden', marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
        <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Versión</Text>
          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>Forward Mobile V4.0</Text>
        </View>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Entorno API</Text>
          
          <View style={{
            flexDirection: 'row',
            backgroundColor: colors.surface2,
            borderRadius: 14,
            padding: 4,
            borderWidth: 1,
            borderColor: colors.border,
            marginTop: 4
          }}>
            {/* Producción */}
            <Pressable
              onPress={() => handleEnvChange(ENV_PROD)}
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
                backgroundColor: API_URL === ENV_PROD ? colors.primary : 'transparent',
              }}
            >
              <Text style={{
                color: API_URL === ENV_PROD ? '#ffffff' : colors.textMuted,
                fontWeight: '800',
                fontSize: 12,
                letterSpacing: 0.5,
              }}>
                PRODUCCIÓN
              </Text>
            </Pressable>

            {/* Desarrollo */}
            <Pressable
              onPress={() => handleEnvChange(ENV_DEV)}
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
                backgroundColor: API_URL === ENV_DEV ? colors.primary : 'transparent',
              }}
            >
              <Text style={{
                color: API_URL === ENV_DEV ? '#ffffff' : colors.textMuted,
                fontWeight: '800',
                fontSize: 12,
                letterSpacing: 0.5,
              }}>
                DESARROLLO
              </Text>
            </Pressable>

            {/* Local (docker) — dev builds only */}
            {__DEV__ && (
              <Pressable
                onPress={() => handleEnvChange(ENV_LOCAL)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 10,
                  backgroundColor: API_URL === ENV_LOCAL ? colors.primary : 'transparent',
                }}
              >
                <Text style={{
                  color: API_URL === ENV_LOCAL ? '#ffffff' : colors.textMuted,
                  fontWeight: '800',
                  fontSize: 12,
                  letterSpacing: 0.5,
                }}>
                  LOCAL
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* Logout Button */}
      <Pressable
        onPress={handleLogout}
        style={{
          backgroundColor: colors.danger,
          borderRadius: 20,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: colors.danger,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 6,
          elevation: 4
        }}
      >
        <LogOut size={20} color="#fff" strokeWidth={2.5} />
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16, marginLeft: 10 }}>Cerrar sesión</Text>
      </Pressable>

      {/* Logout Modal */}
      <ConfirmModal
        visible={logoutVisible}
        title="CERRAR SESIÓN"
        message="¿ESTÁS SEGURO QUE QUERÉS SALIR DEL SISTEMA? DEBERÁS VOLVER A INGRESAR TUS CREDENCIALES."
        variant="danger"
        confirmLabel="SALIR"
        cancelLabel="CANCELAR"
        onConfirm={confirmLogout}
        onCancel={() => setLogoutVisible(false)}
      />

      {/* Env Change Confirmation Modal */}
      <ConfirmModal
        visible={envModalVisible}
        title="CAMBIAR DE ENTORNO"
        message={`¿ESTÁS SEGURO QUE QUERÉS CAMBIAR AL ENTORNO DE ${pendingEnvUrl === ENV_DEV ? 'DESARROLLO' : pendingEnvUrl === ENV_LOCAL ? 'LOCAL (DOCKER)' : 'PRODUCCIÓN'}? SE CERRARÁ TU SESIÓN ACTUAL PARA EVITAR CONFLICTOS.`}
        variant="warning"
        confirmLabel="CAMBIAR Y SALIR"
        cancelLabel="CANCELAR"
        onConfirm={confirmEnvChange}
        onCancel={() => setEnvModalVisible(false)}
      />
    </View>
  )
}
