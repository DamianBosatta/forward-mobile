/**
 * WizardStepper.tsx — Step indicator header for the Planificar Viaje wizard.
 *
 * Renders 4 numbered steps with connecting lines. The active step is
 * highlighted with the primary color; completed steps show a filled circle.
 */

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Check } from 'lucide-react-native'
import { useColors, tokens } from '@/libs/theme'
import type { WizardStep } from '@/src/features/logistica/store/logistica.store'

const STEPS: { label: string }[] = [
  { label: 'Pedidos' },
  { label: 'Asignar' },
  { label: 'Ordenar' },
  { label: 'Confirmar' },
]

export interface WizardStepperProps {
  currentStep: WizardStep
}

export function WizardStepper({ currentStep }: WizardStepperProps) {
  const colors = useColors()

  return (
    <View style={styles.container}>
      {STEPS.map((step, index) => {
        const stepNumber = (index + 1) as WizardStep
        const isCompleted = stepNumber < currentStep
        const isActive = stepNumber === currentStep

        const circleColor = isCompleted || isActive ? colors.primary : colors.border
        const textColor = isCompleted || isActive ? colors.primary : colors.textMuted
        const labelColor = isActive ? colors.text : colors.textMuted

        return (
          <React.Fragment key={stepNumber}>
            {/* Step circle + label */}
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.circle,
                  {
                    backgroundColor: isCompleted || isActive ? colors.primary : 'transparent',
                    borderColor: circleColor,
                  },
                ]}
              >
                {isCompleted ? (
                  <Check size={12} color="#000" strokeWidth={3} />
                ) : (
                  <Text
                    style={[
                      styles.stepNumber,
                      { color: isActive ? '#000' : textColor },
                    ]}
                    maxFontSizeMultiplier={1.3}
                  >
                    {stepNumber}
                  </Text>
                )}
              </View>
              <Text
                style={[styles.stepLabel, { color: labelColor }]}
                numberOfLines={1}
              >
                {step.label}
              </Text>
            </View>

            {/* Connector line (not after last step) */}
            {index < STEPS.length - 1 && (
              <View
                style={[
                  styles.connector,
                  {
                    backgroundColor: stepNumber < currentStep ? colors.primary : colors.border,
                  },
                ]}
              />
            )}
          </React.Fragment>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  stepItem: {
    alignItems: 'center',
    gap: 4,
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '700',
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 56,
  },
  connector: {
    flex: 1,
    height: 2,
    marginBottom: 16, // align with circles (labels sit below)
    marginHorizontal: 4,
  },
})
