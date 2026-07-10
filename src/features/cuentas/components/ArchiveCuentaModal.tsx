import React from 'react'
import { View, Text, Pressable, Alert, ActivityIndicator, Modal, StyleSheet } from 'react-native'
import { Archive, RotateCcw } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { useColors } from '@/libs/theme'
import { useDesactivarCuenta, useActivarCuenta } from '@/features/cuentas/api/queries'
import { safeHaptics } from '@/core/utils/haptics'
interface ArchiveCuentaModalProps {
  visible: boolean
  cuentaId: string
  isActive: boolean
  onClose: () => void
}

export function ArchiveCuentaModal({ visible, cuentaId, isActive, onClose }: ArchiveCuentaModalProps) {
  const colors = useColors()
  const router = useRouter()
  const { mutateAsync: desactivarCuenta, isPending: isDesactivating } = useDesactivarCuenta()
  const { mutateAsync: activarCuenta, isPending: isActivating } = useActivarCuenta()

  const isPending = isDesactivating || isActivating

  const handleConfirm = async () => {
    try {
      if (isActive) {
        await desactivarCuenta(cuentaId)
        safeHaptics.notification('success')
        onClose()
        router.replace('/(tabs)/cuentas')
      } else {
        await activarCuenta(cuentaId)
        safeHaptics.notification('success')
        onClose()
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo procesar la solicitud.')
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />

          <View style={styles.content}>
            {/* Header Icon */}
            <View style={[styles.iconWrapper, { backgroundColor: (isActive ? colors.danger : colors.primary) + '20' }]}>
              {isActive ? (
                <Archive size={28} color={colors.danger} />
              ) : (
                <RotateCcw size={28} color={colors.primary} />
              )}
            </View>

            <Text style={[styles.title, { color: colors.text }]}>
              {isActive ? 'Archivar Cuenta' : 'Reactivar Cuenta'}
            </Text>
            
            <Text style={[styles.description, { color: colors.textMuted }]}>
              {isActive 
                ? '¿Estás seguro de que querés archivar esta cuenta? Esto no eliminará el historial, pero ya no podrás operar con ella.'
                : '¿Estás seguro de que querés reactivar esta cuenta? Volverá a aparecer en tu listado principal y podrás cargar movimientos.'
              }
            </Text>

            {/* Actions */}
            <View style={styles.actionsRow}>
              <Pressable onPress={onClose} style={[styles.btn, { backgroundColor: colors.surface2 }]}>
                <Text style={[styles.btnText, { color: colors.textMuted }]}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirm}
                disabled={isPending}
                style={[
                  styles.btn,
                  { backgroundColor: isActive ? colors.danger : colors.primary, opacity: isPending ? 0.5 : 1 }
                ]}
              >
                {isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={[styles.btnText, { color: '#fff' }]}>
                    {isActive ? 'Archivar' : 'Reactivar'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: 300,
    paddingBottom: 40,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  iconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontWeight: '700',
    fontSize: 15,
  },
})
