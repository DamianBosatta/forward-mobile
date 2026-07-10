/**
 * BulkActionBar — Sticky bottom action bar for bulk picking operations.
 *
 * Renders ONLY when selectedCount > 0.
 * Actions:
 *   - Iniciar masiva → useIniciarPreparacion({ ventaIds })
 *   - Surtido PDF    → sharePdf (POST getSurtidoPdfUrl(), body { ventaIds })
 *   - Etiquetas masivas → sharePdf (GET getEtiquetasMasivasUrl(ventaIds))
 *
 * Exported as both a named and default export for testability.
 */

import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { Play, FileText, Tag } from 'lucide-react-native'
import { MotiView } from 'moti'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors, useIsDark } from '@/libs/theme'
import { safeHaptics } from '@/core/utils/haptics'

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface BulkActionBarProps {
  selectedCount: number
  selectedIds: string[]
  isIniciarPending: boolean
  onIniciarMasiva: (ids: string[]) => void
  onSurtidoPdf: (ids: string[]) => void
  onEtiquetasMasivas: (ids: string[]) => void
  /**
   * Layout variant.
   * 'default' — full-width absolute bottom bar (phone). Current behavior, unchanged.
   * 'floating' — centered, max-width 520dp, rounded card (tablet).
   */
  variant?: 'default' | 'floating'
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function BulkActionBar({
  selectedCount,
  selectedIds,
  isIniciarPending,
  onIniciarMasiva,
  onSurtidoPdf,
  onEtiquetasMasivas,
  variant = 'default',
}: BulkActionBarProps) {
  const colors = useColors()
  const isDark = useIsDark()
  const insets = useSafeAreaInsets()

  // Render nothing when no items are selected
  if (selectedCount === 0) return null

  const isFloating = variant === 'floating'

  const handleIniciar = () => {
    safeHaptics.impact('medium')
    onIniciarMasiva(selectedIds)
  }

  const handleSurtido = () => {
    safeHaptics.impact('light')
    onSurtidoPdf(selectedIds)
  }

  const handleEtiquetas = () => {
    safeHaptics.impact('light')
    onEtiquetasMasivas(selectedIds)
  }

  const barBg = isDark ? '#111111' : colors.surface
  const borderColor = isDark ? 'rgba(255,255,255,0.10)' : colors.border

  const positionStyle = isFloating
    ? [styles.containerFloating, { bottom: insets.bottom + 8 }]
    : [styles.containerDefault, { paddingBottom: insets.bottom + 8 }]

  return (
    <MotiView
      from={{ opacity: 0, translateY: 40 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 250 }}
      style={[
        styles.container,
        ...positionStyle,
        { backgroundColor: barBg, borderTopColor: borderColor },
      ]}
      accessibilityLabel={`${selectedCount} ventas seleccionadas. Acciones disponibles: iniciar, surtido PDF, etiquetas`}
    >
      {/* Selection count badge */}
      <View style={styles.badge}>
        <View style={[styles.badgeDot, { backgroundColor: colors.primary }]} />
        <Text style={[styles.badgeText, { color: colors.text }]}>
          {selectedCount} {selectedCount === 1 ? 'seleccionada' : 'seleccionadas'}
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {/* Iniciar masiva */}
        <TouchableOpacity
          style={[
            styles.btn,
            styles.btnPrimary,
            { backgroundColor: colors.primary },
            isIniciarPending && styles.btnDisabled,
          ]}
          onPress={handleIniciar}
          disabled={isIniciarPending}
          accessibilityLabel="Iniciar preparación de las ventas seleccionadas"
          accessibilityRole="button"
        >
          {isIniciarPending ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <>
              <Play size={15} color="#000" strokeWidth={2.5} />
              <Text style={styles.btnPrimaryLabel}>Iniciar</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Surtido PDF */}
        <TouchableOpacity
          style={[
            styles.btn,
            styles.btnSecondary,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bg,
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : colors.border,
            },
          ]}
          onPress={handleSurtido}
          accessibilityLabel="Compartir lista de surtido en PDF"
          accessibilityRole="button"
        >
          <FileText size={15} color={colors.primary} strokeWidth={2} />
          <Text style={[styles.btnSecondaryLabel, { color: colors.primary }]}>Surtido</Text>
        </TouchableOpacity>

        {/* Etiquetas masivas */}
        <TouchableOpacity
          style={[
            styles.btn,
            styles.btnSecondary,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bg,
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : colors.border,
            },
          ]}
          onPress={handleEtiquetas}
          accessibilityLabel="Compartir etiquetas masivas en PDF"
          accessibilityRole="button"
        >
          <Tag size={15} color={colors.primary} strokeWidth={2} />
          <Text style={[styles.btnSecondaryLabel, { color: colors.primary }]}>Etiquetas</Text>
        </TouchableOpacity>
      </View>
    </MotiView>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Shared visual properties — no positional props here so phone/tablet can
  // independently set position, left, right, width, and border-radius.
  container: {
    borderTopWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  // Phone default: full-width absolute bottom bar (current behavior, unchanged).
  containerDefault: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  // Tablet floating: centered card, no left/right edges.
  // width: '100%' ensures flex:1 action buttons have a concrete parent size to expand into.
  // maxWidth: 520 caps the bar so it never overflows narrower tablet windows or split-screen.
  // borderTopWidth: 0 overrides container base so the rounded card has no top rule.
  containerFloating: {
    position: 'absolute',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 520,
    borderRadius: 20,
    borderTopWidth: 0,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
    borderRadius: 14,
  },
  btnPrimary: {
    flex: 1.5,
  },
  btnSecondary: {
    borderWidth: 1,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnPrimaryLabel: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'Outfit_800ExtraBold',
    color: '#000',
  },
  btnSecondaryLabel: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
})
