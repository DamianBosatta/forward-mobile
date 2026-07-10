import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native'
import { MotiView } from 'moti'
import { X, Calendar, DollarSign, ListOrdered, Bookmark } from 'lucide-react-native'
import { useColors } from '@/libs/theme'
import { useFinanzasStore } from '@/libs/store/useFinanzasStore'
import * as Haptics from 'expo-haptics'
import { formatToLocalTime } from '@/src/utils/date'

function formatMoney(amount: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatDateFull(iso: string) {
  return formatToLocalTime(iso, "EEEE d 'de' MMMM, yyyy - HH:mm");
}

export function MovimientoDetailModal() {
  const colors = useColors()
  const {
    isMovimientoDetailModalVisible,
    setMovimientoDetailModalVisible,
    selectedMovimiento,
    setSelectedMovimiento,
  } = useFinanzasStore()

  const handleClose = () => {
    setMovimientoDetailModalVisible(false)
    setTimeout(() => setSelectedMovimiento(null), 300)
  }

  if (!isMovimientoDetailModalVisible || !selectedMovimiento) return null

  const isDebe = (selectedMovimiento.debe ?? 0) > 0
  const amount = isDebe ? (selectedMovimiento.debe ?? 0) : (selectedMovimiento.haber ?? 0)
  const amountColor = isDebe ? colors.text : colors.success // matching grid heuristic
  const prefix = isDebe ? '-$' : '+$'

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <MotiView
              from={{ translateY: 100, opacity: 0 }}
              animate={{ translateY: 0, opacity: 1 }}
              exit={{ translateY: 100, opacity: 0 }}
              transition={{ type: 'spring', damping: 15 }}
              style={[styles.modalContent, { backgroundColor: colors.surface }]}
            >
              <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>Detalle del Movimiento</Text>
                <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                  <X size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.body}>
                <View style={styles.amountBox}>
                  <Text style={[styles.amountValue, { color: amountColor }]}>
                    {prefix}{amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </Text>
                  <Text style={[styles.amountLabel, { color: colors.textMuted }]}>
                    {isDebe ? 'Egreso' : 'Ingreso'}
                  </Text>
                </View>

                <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                  <View style={styles.iconBox}>
                    <Bookmark size={18} color={colors.primary} />
                  </View>
                  <View style={styles.detailTextContainer}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Referencia</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{selectedMovimiento.referencia ?? '—'}</Text>
                  </View>
                </View>

                <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                  <View style={styles.iconBox}>
                    <Calendar size={18} color={colors.primary} />
                  </View>
                  <View style={styles.detailTextContainer}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Fecha y Hora</Text>
                    <Text style={[styles.detailValue, { color: colors.text, textTransform: 'capitalize' }]}>
                      {selectedMovimiento.fecha ? formatDateFull(selectedMovimiento.fecha) : '—'}
                    </Text>
                  </View>
                </View>

                <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                  <View style={styles.iconBox}>
                    <DollarSign size={18} color={colors.primary} />
                  </View>
                  <View style={styles.detailTextContainer}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Saldo Histórico Resultante</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {formatMoney(selectedMovimiento.saldoHistorico ?? 0)}
                    </Text>
                  </View>
                </View>
                
                <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                  <View style={styles.iconBox}>
                    <ListOrdered size={18} color={colors.primary} />
                  </View>
                  <View style={styles.detailTextContainer}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>ID de Transacción</Text>
                    <Text style={[styles.detailValue, { color: colors.text, fontSize: 13 }]} selectable>
                      {selectedMovimiento.id}
                    </Text>
                  </View>
                </View>
              </View>
            </MotiView>
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
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
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
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
  },
  body: {
    gap: 16,
  },
  amountBox: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 10,
  },
  amountValue: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
  },
  amountLabel: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  detailTextContainer: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '500',
  },
})
