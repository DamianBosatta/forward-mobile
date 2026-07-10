/**
 * PickingDateFilter — Desde/Hasta date range control for the tablet picking board header.
 *
 * Follows the ventas/nueva.tsx DateTimePicker pattern:
 *   - Android: DateTimePicker rendered inline (dismissed automatically on change)
 *   - iOS: DateTimePicker inside a slide-up Modal with Confirm/Cancel actions
 *
 * Props carry Date | null; the parent (picking.tsx) converts to ISO YYYY-MM-DD strings
 * before feeding them into the VentasPreparacionParams query.
 *
 * Only rendered on tablet (isLarge) — gated in picking.tsx. Phone path is UNAFFECTED.
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { Calendar, X } from 'lucide-react-native'
import { useColors } from '@/libs/theme'

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface PickingDateFilterProps {
  /** Currently selected "Desde" date, or null when not set. */
  fechaDesde: Date | null
  /** Currently selected "Hasta" date, or null when not set. */
  fechaHasta: Date | null
  /** Called when the user picks a new "Desde" date, or null to clear. */
  onFechaDesdeChange: (date: Date | null) => void
  /** Called when the user picks a new "Hasta" date, or null to clear. */
  onFechaHastaChange: (date: Date | null) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDisplay(d: Date): string {
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function PickingDateFilter({
  fechaDesde,
  fechaHasta,
  onFechaDesdeChange,
  onFechaHastaChange,
}: PickingDateFilterProps) {
  const colors = useColors()

  // Which picker is open ('desde' | 'hasta' | null)
  const [activePicker, setActivePicker] = useState<'desde' | 'hasta' | null>(null)
  // Staging value for iOS spinner (committed on Confirm)
  const [tempDate, setTempDate] = useState<Date>(new Date())

  const hasFilter = fechaDesde !== null || fechaHasta !== null

  function openPicker(which: 'desde' | 'hasta') {
    const current = which === 'desde' ? fechaDesde : fechaHasta
    setTempDate(current ?? new Date())
    setActivePicker(which)
  }

  function closePicker() {
    setActivePicker(null)
  }

  function commitDate(date: Date) {
    if (activePicker === 'desde') {
      onFechaDesdeChange(date)
    } else if (activePicker === 'hasta') {
      onFechaHastaChange(date)
    }
    closePicker()
  }

  /** Android: picker dismisses immediately and emits the selected date. */
  function handleAndroidChange(_event: unknown, selectedDate?: Date) {
    closePicker()
    if (selectedDate) commitDate(selectedDate)
  }

  function handleClear() {
    onFechaDesdeChange(null)
    onFechaHastaChange(null)
  }

  return (
    <View style={styles.container}>
      {/* Desde button */}
      <TouchableOpacity
        style={[
          styles.dateBtn,
          {
            backgroundColor: fechaDesde ? colors.primary + '18' : colors.surface,
            borderColor: fechaDesde ? colors.primary + '60' : colors.border,
          },
        ]}
        onPress={() => openPicker('desde')}
        activeOpacity={0.7}
        accessibilityLabel="Fecha desde"
      >
        <Calendar size={14} color={fechaDesde ? colors.primary : colors.textMuted} />
        <Text
          style={[
            styles.dateBtnText,
            { color: fechaDesde ? colors.primary : colors.textMuted },
          ]}
        >
          {fechaDesde ? formatDisplay(fechaDesde) : 'Desde'}
        </Text>
      </TouchableOpacity>

      {/* Range separator */}
      <View style={[styles.rangeDash, { backgroundColor: colors.border }]} />

      {/* Hasta button */}
      <TouchableOpacity
        style={[
          styles.dateBtn,
          {
            backgroundColor: fechaHasta ? colors.primary + '18' : colors.surface,
            borderColor: fechaHasta ? colors.primary + '60' : colors.border,
          },
        ]}
        onPress={() => openPicker('hasta')}
        activeOpacity={0.7}
        accessibilityLabel="Fecha hasta"
      >
        <Calendar size={14} color={fechaHasta ? colors.primary : colors.textMuted} />
        <Text
          style={[
            styles.dateBtnText,
            { color: fechaHasta ? colors.primary : colors.textMuted },
          ]}
        >
          {fechaHasta ? formatDisplay(fechaHasta) : 'Hasta'}
        </Text>
      </TouchableOpacity>

      {/* Clear button — only visible when at least one date is set */}
      {hasFilter && (
        <TouchableOpacity
          style={[styles.clearBtn, { backgroundColor: colors.danger + '18' }]}
          onPress={handleClear}
          activeOpacity={0.7}
          accessibilityLabel="Limpiar filtro de fechas"
          testID="date-filter-clear"
        >
          <X size={14} color={colors.danger} />
        </TouchableOpacity>
      )}

      {/* Android: inline picker, shown when picker is open */}
      {activePicker !== null && Platform.OS !== 'ios' && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display="default"
          onChange={handleAndroidChange}
        />
      )}

      {/* iOS: DateTimePicker inside a slide-up modal (spinner-in-modal pattern) */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={activePicker !== null}
          transparent
          animationType="slide"
          onRequestClose={closePicker}
        >
          <View style={styles.modalOverlay}>
            {/* Tap outside to dismiss */}
            <Pressable style={styles.modalBackdrop} onPress={closePicker} />

            <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
              {/* Modal header */}
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={closePicker} style={styles.modalHeaderBtn}>
                  <Text style={[styles.modalHeaderAction, { color: colors.textMuted }]}>
                    Cancelar
                  </Text>
                </TouchableOpacity>

                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {activePicker === 'desde' ? 'Fecha Desde' : 'Fecha Hasta'}
                </Text>

                <TouchableOpacity
                  onPress={() => commitDate(tempDate)}
                  style={styles.modalHeaderBtn}
                >
                  <Text style={[styles.modalHeaderAction, { color: colors.primary }]}>
                    Confirmar
                  </Text>
                </TouchableOpacity>
              </View>

              {/* iOS spinner */}
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={(_event, selectedDate) => {
                  if (selectedDate) setTempDate(selectedDate)
                }}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
    gap: 8,
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  dateBtnText: {
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
  },
  rangeDash: {
    width: 8,
    height: 1,
    marginHorizontal: 2,
  },
  clearBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  // ── iOS modal ──────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalHeaderBtn: {
    padding: 8,
  },
  modalHeaderAction: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: 'Outfit_700Bold',
  },
})
