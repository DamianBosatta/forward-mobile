/**
 * VehiculoFormSheet — Modal bottom-sheet for creating and editing vehicles.
 *
 * Fields: Patente, Modelo, CapacidadCargaKg (all required).
 * Validation (before mutation):
 *   - All three fields must be non-empty
 *   - capacidadCargaKg must be > 0
 *
 * When vehiculo prop is supplied → edit mode (useUpdateVehiculo).
 * When vehiculo is null/undefined → create mode (useCreateVehiculo).
 *
 * Deactivation is NOT available from this sheet; it lives on VehiculoCard
 * as a one-way action (v1 backend has no reactivation endpoint).
 */

import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from 'react-native'
import { X, Save, Truck } from 'lucide-react-native'
import { useColors, useIsDark } from '@/libs/theme'
import { PremiumInput } from '@/core/ui'
import { safeHaptics } from '@/core/utils/haptics'
import { useCreateVehiculo, useUpdateVehiculo } from '@/libs/api-client/logistica'
import type { VehiculoCrudResult } from '@/libs/api-client/logistica'
import { BlurView } from 'expo-blur'

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

export interface VehiculoFormErrors {
  patente?: string
  modelo?: string
  capacidadCargaKg?: string
}

/** Pure validation — exported so tests can call it directly. */
export function validateVehiculoForm(
  patente: string,
  modelo: string,
  capacidadCargaKgStr: string,
): VehiculoFormErrors {
  const errors: VehiculoFormErrors = {}

  if (!patente.trim()) {
    errors.patente = 'La patente es requerida'
  }
  if (!modelo.trim()) {
    errors.modelo = 'El modelo es requerido'
  }
  const capacidad = parseFloat(capacidadCargaKgStr)
  if (!capacidadCargaKgStr.trim()) {
    errors.capacidadCargaKg = 'La capacidad es requerida'
  } else if (isNaN(capacidad) || capacidad <= 0) {
    errors.capacidadCargaKg = 'La capacidad debe ser mayor a 0'
  }

  return errors
}

/** Returns true when the form is ready to submit (no validation errors). */
export function isVehiculoFormValid(
  patente: string,
  modelo: string,
  capacidadCargaKgStr: string,
): boolean {
  return Object.keys(validateVehiculoForm(patente, modelo, capacidadCargaKgStr)).length === 0
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface VehiculoFormSheetProps {
  visible: boolean
  vehiculo?: VehiculoCrudResult | null
  onClose: () => void
  onSuccess: (message: string) => void
  onError: (message: string) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function VehiculoFormSheet({
  visible,
  vehiculo,
  onClose,
  onSuccess,
  onError,
}: VehiculoFormSheetProps) {
  const colors = useColors()
  const isDark = useIsDark()

  const isEditMode = vehiculo != null

  // ── Field state ──────────────────────────────────────────────────────────
  const [patente, setPatente] = useState('')
  const [modelo, setModelo] = useState('')
  const [capacidadStr, setCapacidadStr] = useState('')
  const [fieldErrors, setFieldErrors] = useState<VehiculoFormErrors>({})

  // ── Mutations ────────────────────────────────────────────────────────────
  const { mutateAsync: createVehiculo, isPending: isCreating } = useCreateVehiculo()
  const { mutateAsync: updateVehiculo, isPending: isUpdating } = useUpdateVehiculo()

  const isPending = isCreating || isUpdating

  // ── Seed form when editing ───────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      if (vehiculo) {
        setPatente(vehiculo.patente)
        setModelo(vehiculo.modelo)
        setCapacidadStr(String(vehiculo.capacidadCargaKg))
      } else {
        setPatente('')
        setModelo('')
        setCapacidadStr('')
      }
      setFieldErrors({})
    }
  }, [visible, vehiculo])

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleClose = () => {
    Keyboard.dismiss()
    onClose()
  }

  const handleSubmit = async () => {
    const errors = validateVehiculoForm(patente, modelo, capacidadStr)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      safeHaptics.notification('warning')
      return
    }

    const payload = {
      patente: patente.trim().toUpperCase(),
      modelo: modelo.trim(),
      capacidadCargaKg: parseFloat(capacidadStr),
    }

    try {
      Keyboard.dismiss()
      if (isEditMode && vehiculo) {
        await updateVehiculo({ id: vehiculo.id, ...payload })
        onSuccess('Vehículo actualizado correctamente')
      } else {
        await createVehiculo(payload)
        onSuccess('Vehículo creado correctamente')
      }
      safeHaptics.notification('success')
      onClose()
    } catch {
      safeHaptics.notification('error')
      onError('Error al guardar el vehículo. Intente nuevamente.')
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const submitDisabled = isPending || !isVehiculoFormValid(patente, modelo, capacidadStr)

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: isDark ? '#111111' : colors.surface },
            ]}
            onPress={() => {}} // stop backdrop close propagation
          >
            <BlurView
              intensity={isDark ? 20 : 50}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />

            {/* Handle */}
            <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : colors.border }]} />

            {/* Header */}
            <View style={styles.header}>
              <View style={[styles.headerIcon, { backgroundColor: colors.primary + '18' }]}>
                <Truck size={20} color={colors.primary} strokeWidth={2} />
              </View>

              <Text style={[styles.headerTitle, { color: colors.text }]}>
                {isEditMode ? 'Editar Vehículo' : 'Nuevo Vehículo'}
              </Text>

              <TouchableOpacity
                onPress={handleClose}
                hitSlop={12}
                accessibilityLabel="Cerrar"
                accessibilityRole="button"
              >
                <View style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border + '60' }]}>
                  <X size={18} color={colors.textMuted} strokeWidth={2.5} />
                </View>
              </TouchableOpacity>
            </View>

            {/* Form */}
            <ScrollView
              style={styles.formScroll}
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <PremiumInput
                label="Patente"
                placeholder="Ej: AB 123 CD"
                value={patente}
                onChangeText={(t) => {
                  setPatente(t)
                  if (fieldErrors.patente) setFieldErrors((e) => ({ ...e, patente: undefined }))
                }}
                autoCapitalize="characters"
                maxLength={10}
              />
              {fieldErrors.patente ? (
                <Text style={[styles.errorText, { color: colors.danger }]}>
                  {fieldErrors.patente}
                </Text>
              ) : null}

              <PremiumInput
                label="Modelo"
                placeholder="Ej: Ford Transit"
                value={modelo}
                onChangeText={(t) => {
                  setModelo(t)
                  if (fieldErrors.modelo) setFieldErrors((e) => ({ ...e, modelo: undefined }))
                }}
                autoCapitalize="words"
              />
              {fieldErrors.modelo ? (
                <Text style={[styles.errorText, { color: colors.danger }]}>
                  {fieldErrors.modelo}
                </Text>
              ) : null}

              <PremiumInput
                label="Capacidad (Kg)"
                placeholder="Ej: 1500"
                value={capacidadStr}
                onChangeText={(t) => {
                  setCapacidadStr(t)
                  if (fieldErrors.capacidadCargaKg)
                    setFieldErrors((e) => ({ ...e, capacidadCargaKg: undefined }))
                }}
                keyboardType="decimal-pad"
              />
              {fieldErrors.capacidadCargaKg ? (
                <Text style={[styles.errorText, { color: colors.danger }]}>
                  {fieldErrors.capacidadCargaKg}
                </Text>
              ) : null}

              {/* Submit */}
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  {
                    backgroundColor: submitDisabled
                      ? colors.primary + '50'
                      : colors.primary,
                  },
                ]}
                onPress={handleSubmit}
                disabled={submitDisabled}
                activeOpacity={0.8}
                accessibilityLabel={isEditMode ? 'Guardar cambios' : 'Crear vehículo'}
                accessibilityRole="button"
              >
                {isPending ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <>
                    <Save size={18} color="#000" strokeWidth={2.5} />
                    <Text style={styles.submitLabel}>
                      {isEditMode ? 'Guardar cambios' : 'Crear vehículo'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  keyboardView: {
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    minHeight: 360,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'Outfit_800ExtraBold',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formScroll: {
    flex: 1,
  },
  formContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
    gap: 4,
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    marginTop: -8,
    marginBottom: 4,
    marginLeft: 4,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 16,
  },
  submitLabel: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Outfit_800ExtraBold',
    color: '#000',
  },
})
