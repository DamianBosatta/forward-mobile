import React from 'react'
import { Modal, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { radii, shadowMd, space, useColors, useIsDark } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'

interface BottomSheetProps {
  visible: boolean
  onClose: () => void
  /** Nombre de la hoja para el lector de pantalla, p. ej. "Elegir cliente". */
  accessibilityLabel: string
  children: React.ReactNode
}

/**
 * Hoja inferior de la lámina F4 (radio 24 arriba, manija, velo texto-secundario).
 * En tablet (≥ 600 px, plan §8) la misma hoja se muestra como diálogo centrado.
 * Es un Modal y no @gorhom/bottom-sheet: el repo monta su proveedor pero ninguna
 * pantalla lo usa, y el Modal resuelve teléfono y tablet con un solo componente.
 */
export function BottomSheet({ visible, onClose, accessibilityLabel, children }: BottomSheetProps) {
  const c = useColors()
  const sombra = shadowMd[useIsDark() ? 'dark' : 'light']
  const { isLarge } = useResponsive()
  const { bottom } = useSafeAreaInsets()

  const panel = isLarge
    ? { width: '100%' as const, maxWidth: 600, borderRadius: radii.hoja, padding: space[6], ...sombra }
    : {
        borderTopLeftRadius: radii.hoja,
        borderTopRightRadius: radii.hoja,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        paddingTop: space[2],
        paddingHorizontal: space[4],
        paddingBottom: space[6] + bottom,
      }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.fill, isLarge ? styles.centro : styles.abajo, isLarge && { padding: space[6] }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: c.textSecondary }]}
        />
        <View
          role="dialog"
          aria-modal
          accessibilityLabel={accessibilityLabel}
          onAccessibilityEscape={onClose}
          style={[{ backgroundColor: c.surface, gap: space[4] }, panel]}
        >
          {!isLarge && (
            <View
              testID="hoja-manija"
              style={{ width: 40, height: 4, borderRadius: radii.pastilla, backgroundColor: c.border, alignSelf: 'center' }}
            />
          )}
          {children}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  abajo: { justifyContent: 'flex-end' },
  centro: { justifyContent: 'center', alignItems: 'center' },
})
