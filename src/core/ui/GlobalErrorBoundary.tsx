import React from 'react'
import { View, Text, StyleSheet, ScrollView, Platform, BackHandler, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useColors, useIsDark } from '@/libs/theme'
import { ForwardLogo } from './ForwardLogo'
import { GlassCard } from './GlassCard'
import { AlertOctagon, RefreshCcw, Home, LogOut, ChevronLeft } from 'lucide-react-native'
import { safeHaptics } from '@/core/utils/haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { MotiView } from 'moti'
import { logger } from '@/src/core/utils/logger'

export interface GlobalErrorBoundaryProps {
  error: Error
  retry: () => void
}

export function GlobalErrorBoundary({ error, retry }: GlobalErrorBoundaryProps) {
  // Capture the error in the local log file immediately
  React.useEffect(() => {
    logger.error('CRITICAL_CRASH:', error.name, error.message, error.stack);
  }, [error]);

  const colors = useColors()
  const isDark = useIsDark()
  const router = useRouter()

  const handleRetry = () => {
    safeHaptics.notification('success')
    retry()
  }

  const handleGoHome = () => {
    safeHaptics.impact('medium')
    router.replace('/')
    setTimeout(retry, 100)
  }

  const handleExit = () => {
    safeHaptics.impact('heavy')
    if (Platform.OS === 'android') {
      BackHandler.exitApp()
    } else {
      router.replace('/')
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <MotiView 
          from={{ opacity: 0, scale: 0.9 }} 
          animate={{ opacity: 1, scale: 1 }} 
          style={styles.content}
        >
          <View style={styles.header}>
            <ForwardLogo size={60} showText={false} />
            <Text style={[styles.brandText, { color: colors.text }]}>FORWARD</Text>
          </View>

          <View style={[styles.mainCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.iconContainer, { backgroundColor: colors.danger + '20' }]}>
              <AlertOctagon size={48} color={colors.danger} strokeWidth={2.5} />
            </View>

            <Text style={[styles.title, { color: colors.text }]}>Algo salió mal</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              La aplicación ha detectado un error crítico. Podés intentar reanudar el módulo o volver al panel principal.
            </Text>

            <View style={[styles.errorBox, { backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)' }]}>
              <ScrollView style={{ maxHeight: 100 }} showsVerticalScrollIndicator={false}>
                <Text style={[styles.errorTitle, { color: colors.danger }]}>{error.name}</Text>
                <Text style={[styles.errorMessage, { color: colors.text }]}>{error.message}</Text>
              </ScrollView>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity onPress={handleRetry} activeOpacity={0.8}>
                <LinearGradient
                  colors={[colors.primary, colors.primaryHover]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.primaryBtn}
                >
                  <RefreshCcw size={18} color={colors.bg} />
                  <Text style={[styles.primaryBtnText, { color: colors.bg }]} maxFontSizeMultiplier={1.3}>REINTENTAR MÓDULO</Text>
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.secondaryActions}>
                <TouchableOpacity 
                  onPress={handleGoHome}
                  style={[styles.secondaryBtn, { backgroundColor: colors.surface2, borderColor: colors.border }]}
                >
                  <Home size={18} color={colors.text} />
                  <Text style={[styles.secondaryBtnText, { color: colors.text }]} maxFontSizeMultiplier={1.3}>INICIO</Text>
                </TouchableOpacity>

                {Platform.OS === 'android' && (
                  <TouchableOpacity 
                    onPress={handleExit}
                    style={[styles.secondaryBtn, { backgroundColor: colors.surface2, borderColor: colors.border }]}
                  >
                    <LogOut size={18} color={colors.danger} />
                    <Text style={[styles.secondaryBtnText, { color: colors.danger }]} maxFontSizeMultiplier={1.3}>SALIR</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          <Text style={[styles.footerText, { color: colors.textDisabled }]}>
            Si el problema persiste, contactá al soporte técnico del sistema.
          </Text>
        </MotiView>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 40, gap: 12 },
  brandText: { fontSize: 24, fontWeight: '900', letterSpacing: 6 },
  mainCard: { width: '100%', borderRadius: 32, padding: 32, borderWidth: 1, alignItems: 'center' },
  iconContainer: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontSize: 26, fontWeight: '900', marginBottom: 12, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 32, fontWeight: '600' },
  errorBox: { width: '100%', padding: 16, borderRadius: 16, marginBottom: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  errorTitle: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  errorMessage: { fontSize: 12, fontWeight: '700', lineHeight: 18 },
  actions: { width: '100%', gap: 12 },
  primaryBtn: { height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  primaryBtnText: { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  secondaryActions: { flexDirection: 'row', gap: 12 },
  secondaryBtn: { flex: 1, height: 50, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1 },
  secondaryBtnText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  footerText: { marginTop: 40, fontSize: 11, fontWeight: '700', textAlign: 'center', opacity: 0.5 }
})
