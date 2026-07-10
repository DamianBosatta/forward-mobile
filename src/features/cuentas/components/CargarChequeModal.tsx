import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native'
import { MotiView } from 'moti'
import { X, Camera, UploadCloud } from 'lucide-react-native'
import { useColors } from '@/libs/theme'
import { useFinanzasStore } from '@/libs/store/useFinanzasStore'
import * as Haptics from 'expo-haptics'
import { safeHaptics } from '@/core/utils/haptics'

export function CargarChequeModal() {
  const colors = useColors()
  const { isChequeModalVisible, setChequeModalVisible } = useFinanzasStore()
  const [amount, setAmount] = useState('')
  const [observacion, setObservacion] = useState('')
  const [days, setDays] = useState('0') // 0 = Al día

  const handleClose = () => {
    setChequeModalVisible(false)
    setAmount('')
    setObservacion('')
    setDays('0')
  }

  const handleSave = () => {
    safeHaptics.notification('success')
    // Add upload logic here
    handleClose()
  }

  if (!isChequeModalVisible) return null

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ width: '100%', alignItems: 'center' }}
            >
              <MotiView
                from={{ translateY: 100, opacity: 0 }}
                animate={{ translateY: 0, opacity: 1 }}
                exit={{ translateY: 100, opacity: 0 }}
                transition={{ type: 'spring', damping: 15 }}
                style={[styles.modalContent, { backgroundColor: colors.surface }]}
              >
                <View style={styles.header}>
                  <Text style={[styles.title, { color: colors.text }]}>Cargar Cheque</Text>
                  <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                    <X size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <View style={styles.body}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>Monto del Cheque</Text>
                  <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.bg }]}>
                    <Text style={[styles.currency, { color: colors.textMuted }]}>$</Text>
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      placeholder="0.00"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad"
                      value={amount}
                      onChangeText={setAmount}
                    />
                  </View>

                  <Text style={[styles.label, { color: colors.textMuted, marginTop: 20 }]}>Plazo de Cobro</Text>
                  <View style={styles.daysRow}>
                    {[
                      { label: 'Al día', value: '0' },
                      { label: '30 d', value: '30' },
                      { label: '60 d', value: '60' },
                      { label: '90 d', value: '90' },
                    ].map((item) => (
                      <TouchableOpacity
                        key={item.value}
                        onPress={() => {
                          safeHaptics.impact('light')
                          setDays(item.value)
                        }}
                        style={[
                          styles.dayBtn,
                          { 
                            backgroundColor: days === item.value ? colors.primary : colors.bg,
                            borderColor: days === item.value ? colors.primary : colors.border
                          }
                        ]}
                      >
                        <Text style={[
                          styles.dayBtnText, 
                          { color: days === item.value ? '#FFF' : colors.text }
                        ]}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.label, { color: colors.textMuted, marginTop: 20 }]}>Observaciones (Opcional)</Text>
                  <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.bg, height: 80, alignItems: 'flex-start', paddingVertical: 12 }]}>
                    <TextInput
                      style={[styles.input, { color: colors.text, fontSize: 15, fontWeight: '500', textAlignVertical: 'top' }]}
                      placeholder="Ej: Cheque por pedido de mercadería..."
                      placeholderTextColor={colors.textMuted}
                      multiline
                      numberOfLines={3}
                      value={observacion}
                      onChangeText={setObservacion}
                    />
                  </View>

                  <Text style={[styles.label, { color: colors.textMuted, marginTop: 20 }]}>Imagen del Cheque</Text>
                  <TouchableOpacity
                    style={[styles.uploadBox, { borderColor: colors.border, backgroundColor: colors.surface2 }]}
                    activeOpacity={0.7}
                    onPress={() => Haptics.selectionAsync()}
                  >
                    <UploadCloud size={32} color={colors.primary} />
                    <Text style={[styles.uploadText, { color: colors.text }]}>Subir Foto o Archivo</Text>
                    <Text style={[styles.uploadSubtext, { color: colors.textMuted }]}>Formatos soportados: JPG, PNG, PDF</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                    onPress={handleSave}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.saveBtnText}>Guardar Cheque</Text>
                  </TouchableOpacity>
                </View>
              </MotiView>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  currency: {
    fontSize: 20,
    fontWeight: '600',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
  },
  uploadBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  uploadSubtext: {
    fontSize: 12,
    marginTop: 4,
  },
  footer: {
    width: '100%',
  },
  saveBtn: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  dayBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
})
