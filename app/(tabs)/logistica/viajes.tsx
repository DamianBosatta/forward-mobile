/**
 * viajes.tsx — Planificar Viaje wizard host screen.
 *
 * Management-only: gated by RequirePermission(MOD_VIAJES:read) + isMgmtRole.
 *
 * Wizard architecture:
 *   - Single route, step state lives in viajeDraft (Zustand — ephemeral, NOT persisted).
 *   - Each step is a full-screen component rendered conditionally from draft.step.
 *   - Hardware back maps to setStep(step - 1); at step 1 it exits the screen.
 *   - resetViajeDraft is called on unmount to prevent stale state if user navigates away.
 *
 * Steps:
 *   1. StepSelectEmpacados  — select ventas empacadas
 *   2. StepAssign           — chofer + vehículo + depósito + POST hojas-ruta
 *   3. StepReorder          — read-only review of the server-optimized stop order
 *   4. StepConfirm          — validate + iniciar viaje + share Manifiesto PDF
 */

import React, { useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  BackHandler,
  StyleSheet,
} from 'react-native'
import { ArrowLeft } from 'lucide-react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors, tokens } from '@/libs/theme'
import { RequirePermission } from '@/core/ui'
import { safeHaptics } from '@/core/utils/haptics'
import { usePermissions } from '@/src/core/auth/RequirePermission'
import { isMgmtRole } from '@/src/features/logistica/lib/rbac'
import { useLogisticaStore } from '@/src/features/logistica/store/logistica.store'
import { WizardStepper } from '@/src/features/logistica/components/viajes/WizardStepper'
import { StepSelectEmpacados } from '@/src/features/logistica/components/viajes/StepSelectEmpacados'
import { StepAssign } from '@/src/features/logistica/components/viajes/StepAssign'
import { StepReorder } from '@/src/features/logistica/components/viajes/StepReorder'
import { StepConfirm } from '@/src/features/logistica/components/viajes/StepConfirm'
import type { WizardStep } from '@/src/features/logistica/store/logistica.store'

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

function WizardHost() {
  const colors = useColors()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { viajeDraft, setStep, resetViajeDraft } = useLogisticaStore()
  const currentStep = viajeDraft.step

  // ── Hardware back handler ────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (currentStep > 1) {
          setStep((currentStep - 1) as WizardStep)
          return true // consumed — do not bubble to OS
        }
        // Step 1: allow the default back (navigate to hub)
        return false
      }

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress)
      return () => subscription.remove()
    }, [currentStep, setStep]),
  )

  // ── Reset draft on unmount (prevents stale state if user exits mid-wizard) ──
  useEffect(() => {
    return () => {
      resetViajeDraft()
    }
  }, [resetViajeDraft])

  // ── Step advancement helpers ─────────────────────────────────────────────────
  const goNext = () => setStep((currentStep + 1) as WizardStep)
  const goBack = () => {
    if (currentStep > 1) {
      setStep((currentStep - 1) as WizardStep)
    } else {
      // Exit the wizard to the logística hub. Drawer nav: router.back() lands on
      // the main menu, so navigate to the hub by name instead.
      router.navigate('/(tabs)/logistica')
    }
  }
  const handleComplete = () => {
    // resetViajeDraft already called in StepConfirm before this callback
    router.replace('/(tabs)/logistica')
  }

  // ── Step rendering ───────────────────────────────────────────────────────────
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <StepSelectEmpacados onNext={goNext} />
      case 2:
        return <StepAssign onNext={goNext} onBack={goBack} />
      case 3:
        return <StepReorder onNext={goNext} onBack={goBack} />
      case 4:
        return <StepConfirm onBack={goBack} onComplete={handleComplete} />
      default:
        return null
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Back button — exits the wizard at step 1, goes to previous step otherwise */}
      <View style={[styles.wizardBackRow, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => {
            safeHaptics.impact('light')
            goBack()
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={[styles.wizardBackCircle, { backgroundColor: colors.surface2 }]}
        >
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Step indicator header */}
      <WizardStepper currentStep={currentStep} />

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Active step */}
      <View style={styles.stepContent}>{renderStep()}</View>
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Default export — wrapped in permission + management gate
// ─────────────────────────────────────────────────────────────────────────────

export default function ViajesScreen() {
  const colors = useColors()
  const { roles } = usePermissions()

  if (!isMgmtRole(roles)) {
    return (
      <View style={[styles.gateContainer, { backgroundColor: colors.bg }]}>
        <Text style={[styles.gateTitle, { color: colors.text }]}>Sin permisos</Text>
        <Text style={[styles.gateSubtitle, { color: colors.textMuted }]}>
          Esta sección es solo para administradores.
        </Text>
      </View>
    )
  }

  return (
    <RequirePermission module="MOD_VIAJES" action="read" mode="screen">
      <WizardHost />
    </RequirePermission>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  wizardBackRow: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  wizardBackCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
  },
  stepContent: {
    flex: 1,
  },
  gateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
  },
  gateTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: tokens.spacing.sm,
  },
  gateSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
})
