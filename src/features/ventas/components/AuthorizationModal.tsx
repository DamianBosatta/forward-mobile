/**
 * AuthorizationModal — RN modal for below-floor venta authorization (PR-2e-b).
 *
 * Mirrors web AuthorizationModal.tsx:
 * - Fetches GET /api/v1/Ventas/{id}/autorizacion-preview (only when open)
 * - Renders a per-item sacrificio breakdown as View rows (no <table> in RN)
 * - Requires a mandatory Razon before the cost-role user can authorize
 * - Calls POST /api/v1/Ventas/{id}/autorizar with { version, razon }
 *   (actor identity and role are derived server-side from the JWT token)
 */

import {
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native'
import { useState } from 'react'
import { useColors } from '@/libs/theme'
import { useAutorizacionPreview, useAutorizarVenta } from '@/libs/api-client'
import { X, AlertCircle, ShieldCheck } from 'lucide-react-native'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AuthorizationModalProps {
  /** Venta id to authorize. */
  ventaId: string
  /** Optimistic-concurrency version of the venta header. */
  version: number
  /** Controls visibility. */
  isOpen: boolean
  /** Called to close the modal (cancel or after success). */
  onClose: () => void
  /** Optional callback fired after a successful authorization. */
  onAuthorized?: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** es-AR money formatting with two fixed decimals and a leading $. */
function money(value: number | null | undefined): string {
  return `$${(value ?? 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Authorization modal for a below-floor venta.
 *
 * Form state (razon) lives locally — this is a form modal. All API access stays
 * in hooks (useAutorizacionPreview / useAutorizarVenta).
 */
export function AuthorizationModal({
  ventaId,
  version,
  isOpen,
  onClose,
  onAuthorized,
}: AuthorizationModalProps) {
  const colors = useColors()
  const [razon, setRazon] = useState('')

  const { data, isLoading, isError } = useAutorizacionPreview(ventaId, isOpen)
  const { mutate: autorizar, isPending } = useAutorizarVenta()

  const items = data?.items ?? []
  const razonTrimmed = razon.trim()
  const previewReady = !isLoading && !isError && !!data

  const canSubmit = razonTrimmed.length > 0 && !isPending && previewReady

  const handleClose = () => {
    setRazon('')
    onClose()
  }

  const handleSubmit = () => {
    if (!canSubmit) return
    autorizar(
      {
        id: ventaId,
        version,
        razon: razonTrimmed,
      },
      {
        onSuccess: () => {
          onAuthorized?.()
          handleClose()
        },
        onError: (err: unknown) => {
          const message =
            (err as { message?: string })?.message ?? 'No se pudo autorizar la venta.'
          Alert.alert('Error', message)
        },
      },
    )
  }

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} />
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            {/* ── Header ─────────────────────────────────────────────────────── */}
            <View style={styles.header}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <View style={styles.titleRow}>
                  <AlertCircle size={18} color={colors.danger} />
                  <Text style={[styles.title, { color: colors.text }]}>
                    Autorizar venta por debajo del piso
                  </Text>
                </View>
                <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                  Esta venta tiene ítems por debajo del piso rentable. Revisá el sacrificio
                  y dejá una razón para registrar la autorización.
                </Text>
              </View>
              <Pressable onPress={handleClose} style={{ padding: 4 }}>
                <X size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* ── Loading state ───────────────────────────────────────────────── */}
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textMuted }]}>
                  Cargando vista previa…
                </Text>
              </View>
            )}

            {/* ── Error state ─────────────────────────────────────────────────── */}
            {isError && (
              <Text style={[styles.errorText, { color: colors.danger }]}>
                No se pudo cargar la vista previa de autorización. Intentá nuevamente.
              </Text>
            )}

            {/* ── Sacrificio breakdown ─────────────────────────────────────────── */}
            {previewReady && (
              <View style={styles.previewSection}>
                {/* Column headers */}
                <View style={[styles.tableRow, styles.tableHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.colHeader, styles.colProduct, { color: colors.textMuted }]}>Producto</Text>
                  <Text style={[styles.colHeader, styles.colNum, { color: colors.textMuted }]}>Cant.</Text>
                  <Text style={[styles.colHeader, styles.colNum, { color: colors.textMuted }]}>Precio</Text>
                  <Text style={[styles.colHeader, styles.colNum, { color: colors.textMuted }]}>Piso</Text>
                  <Text style={[styles.colHeader, styles.colNum, { color: colors.textMuted }]}>Aporte</Text>
                  <Text style={[styles.colHeader, styles.colNum, { color: colors.danger }]}>Sacrificio</Text>
                </View>

                {/* Item rows */}
                {items.map((it) => (
                  <View
                    key={it.detalleId ?? it.productoId}
                    style={[styles.tableRow, styles.itemRow, { borderBottomColor: colors.border }]}
                  >
                    <Text style={[styles.colProduct, styles.cellText, { color: colors.text }]} numberOfLines={2}>
                      {it.productoNombre}
                    </Text>
                    <Text style={[styles.colNum, styles.cellNum, { color: colors.text }]}>
                      {(it.cantidad ?? 0).toLocaleString('es-AR')}
                    </Text>
                    <Text style={[styles.colNum, styles.cellNum, { color: colors.text }]}>
                      {money(it.precioEfectivo)}
                    </Text>
                    <Text style={[styles.colNum, styles.cellNum, { color: colors.text }]}>
                      {money(it.precioMinimoRentable)}
                    </Text>
                    <Text style={[styles.colNum, styles.cellNum, { color: colors.text }]}>
                      {money(it.aporteOverhead)}
                    </Text>
                    <Text style={[styles.colNum, styles.cellNum, styles.sacrificioCell, { color: colors.danger }]}>
                      {money(it.sacrificio)}
                    </Text>
                  </View>
                ))}

                {/* Totals */}
                <View style={[styles.totalsSection, { borderTopColor: colors.border }]}>
                  <View style={styles.totalRow}>
                    <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Sacrificio total</Text>
                    <Text style={[styles.totalValue, styles.dangerValue, { color: colors.danger }]}>
                      {money(data.totalSacrificio)}
                    </Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Valor de stock liberado</Text>
                    <Text style={[styles.totalValue, { color: colors.text }]}>
                      {money(data.valorStockLiberado)}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* ── Razon (mandatory) ─────────────────────────────────────────────── */}
            <View style={styles.razonSection}>
              <Text style={[styles.razonLabel, { color: colors.text }]}>
                Razón de la autorización
              </Text>
              <View style={[
                styles.razonInputContainer,
                {
                  backgroundColor: colors.surface2,
                  borderColor: razonTrimmed.length > 0 ? colors.primary : colors.border,
                },
              ]}>
                <TextInput
                  style={[styles.razonInput, { color: colors.text }]}
                  value={razon}
                  onChangeText={setRazon}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  placeholder="Ej: Cliente estratégico, cierre de stock, acuerdo comercial…"
                  placeholderTextColor={colors.textMuted}
                  editable={!isPending}
                />
              </View>
              <Text style={[styles.razonHelp, { color: colors.textMuted }]}>
                La razón es obligatoria: queda registrada junto con la autorización.
              </Text>
            </View>

            {/* ── Action buttons ───────────────────────────────────────────────── */}
            <View style={styles.footer}>
              <TouchableOpacity
                onPress={handleClose}
                disabled={isPending}
                style={[styles.cancelBtn, { borderColor: colors.border, backgroundColor: colors.surface2 }]}
              >
                <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={!canSubmit}
                style={[
                  styles.submitBtn,
                  { backgroundColor: canSubmit ? colors.primary : colors.border },
                ]}
              >
                {isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <View style={styles.submitBtnContent}>
                    <ShieldCheck size={16} color="#fff" />
                    <Text style={styles.submitBtnText}>
                      {isPending ? 'Autorizando…' : 'Autorizar Venta'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  card: {
    margin: 16,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'Outfit_900Black',
    flex: 1,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
    lineHeight: 18,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
    paddingVertical: 16,
    textAlign: 'center',
  },
  previewSection: {
    marginBottom: 16,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  tableHeader: {
    borderBottomWidth: 1,
    paddingBottom: 8,
    marginBottom: 4,
  },
  itemRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  colHeader: {
    fontSize: 9,
    fontWeight: '900',
    fontFamily: 'Outfit_900Black',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  colProduct: {
    flex: 2.5,
    paddingRight: 4,
  },
  colNum: {
    flex: 1.2,
    textAlign: 'right',
  },
  cellText: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
  },
  cellNum: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
  },
  sacrificioCell: {
    fontWeight: '900',
  },
  totalsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'Outfit_700Bold',
  },
  dangerValue: {
    fontWeight: '900',
  },
  razonSection: {
    marginBottom: 16,
    gap: 8,
  },
  razonLabel: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Outfit_700Bold',
  },
  razonInputContainer: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    minHeight: 80,
  },
  razonInput: {
    fontSize: 14,
    fontFamily: 'Outfit_500Medium',
    lineHeight: 20,
    minHeight: 60,
  },
  razonHelp: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '900',
    fontFamily: 'Outfit_900Black',
  },
  submitBtn: {
    flex: 2,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    fontFamily: 'Outfit_900Black',
  },
})
