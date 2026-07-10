import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity
} from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { safeHaptics } from '@/core/utils/haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useColors, useThemeStore, useIsDark, tokens } from '../libs/theme'
import { ForwardLogo, ConfirmModal, AuroraGlow, GlassCard } from '@/core/ui'
import { Sun, Moon, Truck, Fingerprint, Eye, EyeOff, Lock, User } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, FadeInDown, FadeIn, Easing
} from 'react-native-reanimated'
import { MotiView, MotiText } from 'moti'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { 
  authenticateWithBiometrics, 
  saveCredentials, 
  isBiometricsAvailable,
  getSavedCredentials
} from '@/features/auth/utils/biometrics'
import { PremiumInput, PremiumButton } from '@/core/ui'
import { useQueryClient } from '@tanstack/react-query'
import { API_URL, setApiUrl, ENV_PROD, ENV_DEV, ENV_LOCAL } from '@/libs/api-client'

const SHOW_ENV_SWITCHER = __DEV__

export default function LoginScreen() {
  const router = useRouter()
  const colors = useColors()
  const isDark = useIsDark()
  const { login, isLoading, error, isLocked, failedAttempts } = useAuth()
  const { mode, setMode } = useThemeStore()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const [hasBiometrics, setHasBiometrics] = useState(false)
  const [hasSavedCreds, setHasSavedCreds] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [currentUrl, setCurrentUrl] = useState(API_URL)

  const handleEnvChange = async (url: string) => {
    if (url === currentUrl) return
    safeHaptics.impact('medium')
    setCurrentUrl(url)
    await setApiUrl(url)
    // Wipe in-memory cache (setApiUrl already cleared the persisted copy) so login
    // hits the freshly selected API with no leftover data from the previous one.
    queryClient.clear()
  }

  // ── Animated Values ──
  const logoScale = useSharedValue(1)
  const bgOpacity = useSharedValue(0.3)

  // ── Modal State ──
  const [modalCfg, setModalCfg] = useState<{
    visible: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'success' | 'warning' | 'info' | 'primary';
  }>({
    visible: false,
    title: '',
    message: '',
    variant: 'danger',
  })

  const showAlert = (title: string, message: string, variant: any = 'danger') => {
    setModalCfg({ visible: true, title, message, variant });
  }

  // ── Inicialización ──
  useEffect(() => {
    checkBiometrics();
    // Animación de respiración del logo
    logoScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 2500 }),
        withTiming(1, { duration: 2500 })
      ),
      -1,
      true
    )

    // Animación sutil del fondo
    bgOpacity.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 4000 }),
        withTiming(0.2, { duration: 4000 })
      ),
      -1,
      true
    )
  }, []);

  const checkBiometrics = async () => {
    const available = await isBiometricsAvailable();
    const saved = await getSavedCredentials();
    setHasBiometrics(available);
    setHasSavedCreds(!!saved);
    
    if (available && saved) {
      handleBiometricLogin();
    }
  }

  const handleBiometricLogin = async () => {
    safeHaptics.impact('medium')
    const creds = await authenticateWithBiometrics();
    if (creds) {
      setUsername(creds.username);
      setPassword(creds.password);
      
      const success = await login(creds.username, creds.password);
      if (success) {
        handleLoginSuccess();
      }
    }
  }

  const handleLogin = async () => {
    safeHaptics.impact('heavy')
    if (!username.trim() || !password.trim()) {
      showAlert('CAMPO REQUERIDO', 'Por favor completá tu usuario y contraseña.', 'primary');
      return
    }

    const success = await login(username, password)
    
    if (success) {
      await saveCredentials({ username: username.trim(), password: password.trim() });
      handleLoginSuccess();
    }
  }

  const handleLoginSuccess = () => {
    setIsSuccess(true)
    safeHaptics.notification('success')
    setTimeout(() => {
      router.replace('/(tabs)')
    }, 3500)
  }

  useEffect(() => {
    if (error) {
      showAlert('ERROR DE ACCESO', error.toUpperCase(), 'danger');
      safeHaptics.notification('error')
    }
  }, [error])

  const animatedLogoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }]
  }))

  const animatedBgStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value
  }))

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#000000' }}
    >
      {/* ── Background Premium Dinámico (OLED Pure Black) ── */}
      <View style={StyleSheet.absoluteFillObject}>
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: '#000000' }} />
        <AuroraGlow opacity={0.2} />
      </View>

      {/* ── Theme Toggle ── */}
      <Animated.View 
        entering={FadeIn.delay(800)}
        style={{ position: 'absolute', top: insets.top + 16, right: 24, zIndex: 100 }}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            Haptics.selectionAsync()
            setMode(mode === 'dark' ? 'light' : 'dark')
          }}
          style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: colors.glassBg,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: colors.glassBorder,
          }}
        >
          {mode === 'dark' ? <Sun size={20} color={colors.primary} /> : <Moon size={20} color={colors.primary} />}
        </TouchableOpacity>
      </Animated.View>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40, width: '100%', maxWidth: 480, alignSelf: 'center' }}>
          
          {/* ── Brand Header ── */}
          <MotiView 
            from={{ opacity: 0, scale: 0.9, translateY: -20 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 15 }}
            style={{ alignItems: 'center', marginBottom: 48 }}
          >
            <Animated.View 
              style={[animatedLogoStyle, {
                width: 90, height: 90, borderRadius: 28,
                backgroundColor: 'rgba(255,255,255,0.03)',
                alignItems: 'center', justifyContent: 'center',
                marginBottom: 20, 
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)'
              }]}
            >
              <ForwardLogo size={65} showText={false} />
            </Animated.View>
            
            <Text style={{ 
              fontSize: 34, 
              fontWeight: '900', 
              color: '#FFFFFF', 
              letterSpacing: -1.5,
              fontFamily: 'Outfit_900Black'
            }}>
              Forward <Text style={{ color: colors.primary }}>Gestión</Text>
            </Text>
            <Text style={{ 
              fontSize: 11, 
              color: 'rgba(255,255,255,0.4)', 
              fontWeight: '900', 
              marginTop: 8, 
              letterSpacing: 2.5,
              fontFamily: 'Outfit_900Black',
              textTransform: 'uppercase'
            }}>
              Logística Inteligente • Argentina
            </Text>
          </MotiView>

          <Animated.View
            entering={FadeInDown.springify().damping(15).delay(400)}
          >
            <GlassCard intensity={25} style={{ padding: 4 }}>
              <View style={{ padding: 12 }}>
                <View style={{ marginBottom: 24, paddingLeft: 4 }}>
                  <Text style={{ fontSize: 22, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5, fontFamily: 'Outfit_900Black' }}>BIENVENIDO</Text>
                  <View style={{ width: 30, height: 3, backgroundColor: colors.primary, marginTop: 8, borderRadius: 2 }} />
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 10, fontWeight: '600', fontFamily: 'Outfit_600SemiBold' }}>
                    Iniciá sesión para gestionar tu flota y depósitos
                  </Text>
                </View>

                <View style={{ gap: 4 }}>
                  {/* Input Usuario */}
                  <PremiumInput
                    label="Usuario o Email"
                    placeholder="ej: administrador"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    icon={<User size={20} color={colors.primary} />}
                  />

                  {/* Input Password */}
                  <PremiumInput
                    label="Contraseña"
                    placeholder="••••••••"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    icon={<Lock size={20} color={colors.primary} />}
                    rightElement={
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                          Haptics.selectionAsync()
                          setShowPassword(!showPassword)
                        }}
                        style={{ padding: 8 }}
                      >
                        {showPassword ? (
                          <EyeOff size={22} color={colors.primary} />
                        ) : (
                          <Eye size={22} color={colors.textDisabled} />
                        )}
                      </TouchableOpacity>
                    }
                  />

                  {/* Selector de Entorno de Conexión */}
                  {SHOW_ENV_SWITCHER && (
                    <View style={{ marginTop: 12, marginBottom: 4 }}>
                      <Text style={{
                        fontSize: 10,
                        fontWeight: '900',
                        color: 'rgba(255,255,255,0.4)',
                        textTransform: 'uppercase',
                        letterSpacing: 1.5,
                        marginBottom: 8,
                        marginLeft: 4,
                        fontFamily: 'Outfit_700Bold'
                      }}>
                        Entorno de Conexión
                      </Text>
                      
                      <View style={{
                        flexDirection: 'row',
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        borderRadius: 14,
                        padding: 4,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.05)',
                      }}>
                        {/* Producción */}
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => handleEnvChange(ENV_PROD)}
                          style={{
                            flex: 1,
                            paddingVertical: 10,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 10,
                            backgroundColor: currentUrl === ENV_PROD ? colors.primary : 'transparent',
                          }}
                        >
                          <Text style={{
                            color: currentUrl === ENV_PROD ? '#ffffff' : 'rgba(255,255,255,0.6)',
                            fontWeight: '900',
                            fontSize: 11,
                            letterSpacing: 0.5,
                            fontFamily: 'Outfit_700Bold'
                          }}>
                            PRODUCCIÓN
                          </Text>
                        </TouchableOpacity>

                        {/* Desarrollo */}
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => handleEnvChange(ENV_DEV)}
                          style={{
                            flex: 1,
                            paddingVertical: 10,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 10,
                            backgroundColor: currentUrl === ENV_DEV ? colors.primary : 'transparent',
                          }}
                        >
                          <Text style={{
                            color: currentUrl === ENV_DEV ? '#ffffff' : 'rgba(255,255,255,0.6)',
                            fontWeight: '900',
                            fontSize: 11,
                            letterSpacing: 0.5,
                            fontFamily: 'Outfit_700Bold'
                          }}>
                            DESARROLLO
                          </Text>
                        </TouchableOpacity>

                        {/* Local (docker) — dev builds only */}
                        {__DEV__ && (
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => handleEnvChange(ENV_LOCAL)}
                            style={{
                              flex: 1,
                              paddingVertical: 10,
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: 10,
                              backgroundColor: currentUrl === ENV_LOCAL ? colors.primary : 'transparent',
                            }}
                          >
                            <Text style={{
                              color: currentUrl === ENV_LOCAL ? '#ffffff' : 'rgba(255,255,255,0.6)',
                              fontWeight: '900',
                              fontSize: 11,
                              letterSpacing: 0.5,
                              fontFamily: 'Outfit_700Bold'
                            }}>
                              LOCAL
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                    <PremiumButton
                      title={isLocked ? 'ACCESO BLOQUEADO' : 'INGRESAR AL SISTEMA'}
                      onPress={handleLogin}
                      loading={isLoading}
                      disabled={isLocked}
                      variant="primary"
                      size="lg"
                      style={{ flex: 1 }}
                    />

                    {hasBiometrics && hasSavedCreds && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={handleBiometricLogin}
                        style={[styles.biometricButton, { borderColor: colors.glassBorder, backgroundColor: 'rgba(255,255,255,0.03)' }]}
                      >
                        <Fingerprint size={32} color={colors.primary} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {failedAttempts > 0 && failedAttempts < 5 && (
                    <MotiView 
                      from={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      style={styles.attemptsInfo}
                    >
                      <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '700', fontFamily: 'Outfit_700Bold' }}>
                        ⚠️ {5 - failedAttempts} intentos restantes antes del bloqueo
                      </Text>
                    </MotiView>
                  )}
                </View>
              </View>
            </GlassCard>
          </Animated.View>

          {/* Footer Senior */}
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 1200 }}
            style={{ marginTop: 60, alignItems: 'center' }}
          >
            <View style={{ height: 1, width: 40, backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 16 }} />
            <Text style={[styles.footerText, { color: '#525252', fontFamily: 'Outfit_900Black' }]}>FORWARD v3.5 • PREMIUM ENTERPRISE</Text>
            <Text style={{ fontSize: 10, color: '#404040', marginTop: 4, fontWeight: '700', letterSpacing: 1, fontFamily: 'Outfit_700Bold' }}>SISTEMA DE GESTIÓN LOGÍSTICA</Text>
          </MotiView>

        </View>
      </ScrollView>

      <ConfirmModal
        visible={modalCfg.visible}
        title={modalCfg.title}
        message={modalCfg.message}
        variant={modalCfg.variant}
        confirmLabel="ENTENDIDO"
        onConfirm={() => setModalCfg(prev => ({ ...prev, visible: false }))}
        onCancel={() => setModalCfg(prev => ({ ...prev, visible: false }))}
      />

      {isSuccess && (
        <Animated.View entering={FadeIn.duration(400)} style={[StyleSheet.absoluteFillObject, { zIndex: 9999, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
          <SuccessSequence colors={colors} isDark={isDark} />
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  )
}

function SuccessSequence({ colors, isDark }: { colors: any, isDark: boolean }) {
  return (
    <MotiView
      from={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', damping: 15 }}
      style={{ alignItems: 'center', padding: 40 }}
    >
      <View style={[styles.successIconContainer, { 
        backgroundColor: colors.primary + '15',
        borderWidth: 2,
        borderColor: colors.primary + '30'
      }]}>
        <MotiView
          from={{ scale: 0.5, rotate: '0deg' }}
          animate={{ scale: 1, rotate: '360deg' }}
          transition={{ type: 'spring', duration: 1500 }}
        >
          <Truck color={colors.primary} size={70} strokeWidth={1.5} />
        </MotiView>
      </View>
      
      <MotiText 
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ delay: 300 }}
        style={[styles.successTitle, { color: colors.text }]}
      >
        ¡Acceso Exitoso!
      </MotiText>
      
      <MotiText 
        from={{ opacity: 0 }}
        animate={{ opacity: 0.7 }}
        transition={{ delay: 500 }}
        style={[styles.successSubtitle, { color: colors.textMuted }]}
      >
        Sincronizando depósitos y rutas...
      </MotiText>
      
      <View style={{ marginTop: 40, width: 200, height: 4, backgroundColor: colors.surface2, borderRadius: 2, overflow: 'hidden' }}>
        <MotiView
          from={{ translateX: -200 }}
          animate={{ translateX: 0 }}
          transition={{ type: 'timing', duration: 2500, easing: Easing.out(Easing.exp) }}
          style={{ width: '100%', height: '100%', backgroundColor: colors.primary }}
        />
      </View>
    </MotiView>
  )
}

const styles = StyleSheet.create({
  biometricButton: {
    width: 64,
    height: 64,
    borderRadius: tokens.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  attemptsInfo: {
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    paddingVertical: 8,
    borderRadius: 12,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  successIconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32
  },
  successTitle: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1
  },
  successSubtitle: {
    fontSize: 17,
    marginTop: 10,
    textAlign: 'center',
    fontWeight: '500'
  }
})

