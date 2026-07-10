import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput,
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback, ActivityIndicator, Alert,
} from 'react-native'
import { MotiView } from 'moti'
import { X, ArrowDownLeft, ArrowUpRight } from 'lucide-react-native'
import { useColors } from '@/libs/theme'
import { safeHaptics } from '@/core/utils/haptics'
import { useAuthStore } from '@/libs/store/auth.store'
import { useRegistrarPago } from '../api/queries'

const MEDIOS = ['Efectivo', 'Transferencia', 'Cheque', 'Tarjeta'] as const

interface Props {
  visible: boolean
  onClose: () => void
  socioComercialId: string | null
  tipoSocio?: string | null
  razonSocial?: string | null
}

export function RegistrarPagoModal({ visible, onClose, socioComercialId, tipoSocio, razonSocial }: Props) {
  const colors = useColors()
  const userId = useAuthStore(s => s.user?.id)
  const { mutateAsync: registrarPago, isPending } = useRegistrarPago()

  const [monto, setMonto] = useState('')
  const [medioPago, setMedioPago] = useState<string>('Efectivo')
  const [referencia, setReferencia] = useState('')

  const isProveedor = (tipoSocio ?? '').toLowerCase().includes('proveedor')
  const accent = isProveedor ? colors.warning : colors.success
  const title = isProveedor ? 'Registrar Pago' : 'Registrar Cobro'
  const Icon = isProveedor ? ArrowUpRight : ArrowDownLeft

  const reset = () => { setMonto(''); setMedioPago('Efectivo'); setReferencia('') }
  const handleClose = () => { reset(); onClose() }

  const handleSave = async () => {
    const amount = Number(monto.replace(',', '.'))
    if (!amount || amount <= 0) { safeHaptics.notification('error'); Alert.alert('Monto inválido', 'Ingresá un monto mayor a cero.'); return }
    if (!socioComercialId) { Alert.alert('Sin socio', 'Esta cuenta no tiene un socio asociado.'); return }
    if (!userId) { Alert.alert('Sesión inválida', 'Volvé a ingresar al sistema.'); return }

    try {
      const res = await registrarPago({
        socioComercialId,
        monto: amount,
        medioPago,
        referencia: referencia.trim() || 'Movimiento manual',
        usuarioId: userId,
      })
      if (res && (res as any).succeeded === false) {
        safeHaptics.notification('error')
        Alert.alert('No se pudo registrar', (res as any).message || 'Verificá que tengas una caja abierta.')
        return
      }
      safeHaptics.notification('success')
      handleClose()
    } catch (e: any) {
      safeHaptics.notification('error')
      Alert.alert('No se pudo registrar', e?.message || 'Verificá que tengas una caja abierta.')
    }
  }

  if (!visible) return null

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%', alignItems: 'center' }}>
              <MotiView
                from={{ translateY: 100, opacity: 0 }}
                animate={{ translateY: 0, opacity: 1 }}
                transition={{ type: 'spring', damping: 15 }}
                style={[styles.modalContent, { backgroundColor: colors.surface }]}
              >
                <View style={styles.header}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: `${accent}18`, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={20} color={accent} />
                    </View>
                    <View>
                      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                      {!!razonSocial && <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>{razonSocial}</Text>}
                    </View>
                  </View>
                  <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                    <X size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <View style={styles.body}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>Monto</Text>
                  <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.bg }]}>
                    <Text style={[styles.currency, { color: colors.textMuted }]}>$</Text>
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      placeholder="0,00"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad"
                      value={monto}
                      onChangeText={setMonto}
                      autoFocus
                    />
                  </View>

                  <Text style={[styles.label, { color: colors.textMuted, marginTop: 20 }]}>Medio de pago</Text>
                  <View style={styles.chipsRow}>
                    {MEDIOS.map(m => (
                      <TouchableOpacity
                        key={m}
                        onPress={() => { safeHaptics.impact('light'); setMedioPago(m) }}
                        style={[styles.chip, { backgroundColor: medioPago === m ? colors.primary : colors.bg, borderColor: medioPago === m ? colors.primary : colors.border }]}
                      >
                        <Text style={[styles.chipText, { color: medioPago === m ? '#FFF' : colors.text }]}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.label, { color: colors.textMuted, marginTop: 20 }]}>Referencia (opcional)</Text>
                  <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.bg }]}>
                    <TextInput
                      style={[styles.input, { color: colors.text, fontSize: 15, fontWeight: '500' }]}
                      placeholder="Ej. Pago factura, seña, ajuste..."
                      placeholderTextColor={colors.textMuted}
                      value={referencia}
                      onChangeText={setReferencia}
                    />
                  </View>

                  <Text style={{ color: colors.textDisabled, fontSize: 11, marginTop: 14, lineHeight: 16 }}>
                    Impacta la cuenta corriente y tu caja abierta. Necesitás una caja abierta para registrar el movimiento.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: accent, opacity: isPending ? 0.7 : 1 }]}
                  onPress={handleSave}
                  activeOpacity={0.8}
                  disabled={isPending}
                >
                  {isPending ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>{title}</Text>}
                </TouchableOpacity>
              </MotiView>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', alignItems: 'center' },
  modalContent: {
    width: '100%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 20, fontWeight: '700' },
  closeBtn: { padding: 4 },
  body: { marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, height: 56 },
  currency: { fontSize: 20, fontWeight: '600', marginRight: 8 },
  input: { flex: 1, fontSize: 20, fontWeight: '600' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 13, fontWeight: '700' },
  saveBtn: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
})
