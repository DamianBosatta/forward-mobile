/**
 * ScannerModal — Full-screen barcode scanner for the picking board.
 *
 * Uses expo-camera v17 (SDK 54) CameraView with onBarcodeScanned.
 * Fires onScanned once per scan; subsequent detections are debounced for 2s.
 * Handles camera permission: request-flow or settings-deep-link when permanently denied.
 */

import React, { useRef, useCallback, useEffect } from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import type { BarcodeScanningResult, BarcodeType } from 'expo-camera'
import { X } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '@/libs/theme'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const BARCODE_TYPES: BarcodeType[] = [
  'qr',
  'code128',
  'ean13',
  'code39',
  'pdf417',
  'code93',
]

const DEBOUNCE_MS = 2000

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface ScannerModalProps {
  visible: boolean
  onClose: () => void
  /** Fires at most once per scan; debounced for 2s to prevent duplicate events. */
  onScanned: (value: string) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ScannerModal({ visible, onClose, onScanned }: ScannerModalProps) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const [permission, requestPermission] = useCameraPermissions()

  // Debounce: block duplicate scan events for DEBOUNCE_MS ms
  const debounceRef = useRef(false)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset debounce when the modal becomes visible so every open is a fresh scan
  useEffect(() => {
    if (visible) {
      debounceRef.current = false
      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current)
        resetTimerRef.current = null
      }
    }
  }, [visible])

  // Cleanup pending timer on unmount
  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current)
      }
    }
  }, [])

  const handleBarcodeScanned = useCallback(
    ({ data }: BarcodeScanningResult) => {
      if (debounceRef.current) return
      debounceRef.current = true
      onScanned(data)
      if (resetTimerRef.current !== null) clearTimeout(resetTimerRef.current)
      resetTimerRef.current = setTimeout(() => {
        debounceRef.current = false
        resetTimerRef.current = null
      }, DEBOUNCE_MS)
    },
    [onScanned],
  )

  // ── Render helpers ──────────────────────────────────────────────────────

  const renderPermissionDeniedPermanently = () => (
    <View style={styles.centered}>
      <Text style={[styles.infoTitle, { color: colors.text }]}>
        Acceso a la cámara denegado
      </Text>
      <Text style={[styles.infoText, { color: colors.textMuted }]}>
        El permiso fue denegado permanentemente. Habilitalo desde la configuración del sistema.
      </Text>
      <TouchableOpacity
        style={[styles.permBtn, { backgroundColor: colors.primary }]}
        onPress={() => Linking.openSettings()}
        accessibilityRole="button"
        accessibilityLabel="Abrir configuración del sistema"
        activeOpacity={0.8}
      >
        <Text style={styles.permBtnLabel}>Abrir configuración</Text>
      </TouchableOpacity>
    </View>
  )

  const renderPermissionRequest = () => (
    <View style={styles.centered}>
      <Text style={[styles.infoTitle, { color: colors.text }]}>
        Permiso de cámara requerido
      </Text>
      <Text style={[styles.infoText, { color: colors.textMuted }]}>
        Necesitamos acceso a la cámara para escanear códigos de barras de las ventas.
      </Text>
      <TouchableOpacity
        style={[styles.permBtn, { backgroundColor: colors.primary }]}
        onPress={requestPermission}
        accessibilityRole="button"
        accessibilityLabel="Permitir acceso a la cámara"
        activeOpacity={0.8}
      >
        <Text style={styles.permBtnLabel}>Permitir acceso</Text>
      </TouchableOpacity>
    </View>
  )

  const renderCamera = () => (
    <>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={handleBarcodeScanned}
        barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
      />
      {/* Scan-area overlay */}
      <View style={styles.overlay} pointerEvents="none">
        <View
          style={[
            styles.scanFrame,
            { borderColor: colors.primary },
          ]}
        >
          <Text style={[styles.scanHint, { color: colors.text }]}>
            Apuntá al código de barras de la venta
          </Text>
        </View>
      </View>
    </>
  )

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Close button — absolute, top-right, above camera */}
        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + 12 }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar escáner"
          hitSlop={12}
          activeOpacity={0.7}
        >
          <X size={22} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>

        {/* Permission states or live camera */}
        {!permission ? (
          <View style={styles.centered}>
            <Text style={[styles.infoText, { color: colors.textMuted }]}>
              Verificando permisos de cámara...
            </Text>
          </View>
        ) : !permission.granted ? (
          permission.canAskAgain
            ? renderPermissionRequest()
            : renderPermissionDeniedPermanently()
        ) : (
          renderCamera()
        )}
      </View>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 24,
    padding: 10,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 16,
  },
  infoTitle: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
    textAlign: 'center',
    lineHeight: 20,
  },
  permBtn: {
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 8,
  },
  permBtnLabel: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    color: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: 260,
    height: 180,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  scanHint: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    textAlign: 'center',
  },
})
