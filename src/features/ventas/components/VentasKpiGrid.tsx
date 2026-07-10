import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { TrendingUp, CheckCircle2, Clock } from 'lucide-react-native'
import { useColors, BRAND } from '@/libs/theme'
import { MotiView } from 'moti'
import { GlassCard } from '@/core/ui'
import { LinearGradient } from 'expo-linear-gradient'
import { useResponsive } from '@/libs/useResponsive'

interface VentasKpiGridProps {
  ordersCount: number
  pendCount: number
  totalMonto: number
  currentMonth: string
}

function formatMoney(val: number) {
  return `$ ${val.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function VentasKpiGrid({ ordersCount, pendCount, totalMonto, currentMonth }: VentasKpiGridProps) {
  const colors = useColors()
  const { isSmall } = useResponsive()

  return (
    <View style={styles.container}>
      <View style={[styles.gridWrapper, isSmall ? styles.stacked : styles.row]} testID="kpi-grid-wrapper">
        {/* Main Bento Piece: Facturación (Big) */}
        <MotiView
          from={{ opacity: 0, scale: 0.9, translateY: 20 }}
          animate={{ opacity: 1, scale: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 15 }}
          style={isSmall ? styles.fullWidth : styles.bigFlex}
          testID="kpi-main-wrapper"
        >
          <LinearGradient
            colors={[colors.primary, '#005d52']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.mainCard}
          >
            <View style={styles.mainHeader}>
              <View style={styles.iconCircleMain}>
                <TrendingUp size={20} color="#fff" strokeWidth={2.5} />
              </View>
              <Text style={styles.mainLabel} maxFontSizeMultiplier={1.3}>TOTAL {currentMonth}</Text>
            </View>
            <View>
              <Text style={styles.mainValue} maxFontSizeMultiplier={1.3}>{formatMoney(totalMonto)}</Text>
              <View style={styles.mainFooter}>
                <View style={styles.footerDot} />
                <Text style={styles.footerText} maxFontSizeMultiplier={1.3}>FACTURACIÓN BRUTA</Text>
              </View>
            </View>
          </LinearGradient>
        </MotiView>

        {/* Vertical Stack for smaller metrics */}
        <View style={[styles.sideStack, isSmall ? {} : { flex: 1 }]} testID="kpi-side-stack">
          <MotiView
            from={{ opacity: 0, scale: 0.9, translateX: 20 }}
            animate={{ opacity: 1, scale: 1, translateX: 0 }}
            transition={{ type: 'spring', damping: 15, delay: 100 }}
            style={isSmall ? { minHeight: 88 } : { flex: 1 }}
            testID="kpi-card-confirmed"
          >
            <GlassCard intensity={8} style={[styles.smallCard, { borderColor: colors.border }]}>
              <View style={[styles.iconCircleSmall, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }]}>
                <CheckCircle2 size={16} color={colors.primary} strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.smallValue, { color: colors.text }]} maxFontSizeMultiplier={1.3}>{ordersCount}</Text>
                <Text style={[styles.smallLabel, { color: colors.textMuted }]} maxFontSizeMultiplier={1.3}>CONFIRMADOS</Text>
              </View>
            </GlassCard>
          </MotiView>

          <MotiView
            from={{ opacity: 0, scale: 0.9, translateX: 20 }}
            animate={{ opacity: 1, scale: 1, translateX: 0 }}
            transition={{ type: 'spring', damping: 15, delay: 200 }}
            style={isSmall ? { minHeight: 88 } : { flex: 1 }}
            testID="kpi-card-pending"
          >
            <GlassCard intensity={6} style={[styles.smallCard, { backgroundColor: 'rgba(255,165,0,0.02)', borderColor: colors.border }]}>
              <View style={[styles.iconCircleSmall, { backgroundColor: `${BRAND.orange}15`, borderColor: `${BRAND.orange}30` }]}>
                <Clock size={16} color={BRAND.orange} strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.smallValue, { color: colors.text }]} maxFontSizeMultiplier={1.3}>{pendCount}</Text>
                <Text style={[styles.smallLabel, { color: colors.textMuted }]} maxFontSizeMultiplier={1.3}>PENDIENTES</Text>
              </View>
            </GlassCard>
          </MotiView>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginTop: 10,
  },
  gridWrapper: {
    gap: 12,
  },
  // Band-specific layout variants (applied conditionally in JSX)
  stacked: {
    flexDirection: 'column',   // isSmall (<360dp): single column, intrinsic height
  },
  row: {
    flexDirection: 'row',
    minHeight: 180,            // medium/large: floor instead of fixed ceiling
  },
  // Big card size variants
  fullWidth: {
    width: '100%',             // isSmall: big card spans full width
  },
  bigFlex: {
    flex: 1.4,                 // medium/large: asymmetric proportion (unchanged)
  },
  mainCard: { 
    flex: 1,
    padding: 24, 
    borderRadius: 32, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'space-between',
  },
  mainHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircleMain: { 
    width: 40, height: 40, borderRadius: 14, 
    backgroundColor: 'rgba(0,0,0,0.15)', 
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
  },
  mainLabel: { 
    fontSize: 10, color: 'rgba(255,255,255,0.7)', 
    fontFamily: 'Outfit_900Black', letterSpacing: 1.5 
  },
  mainValue: { 
    fontSize: 28, color: '#fff', 
    fontFamily: 'Outfit_900Black', letterSpacing: -1 
  },
  mainFooter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.5)' },
  footerText: { 
    fontSize: 9, color: 'rgba(255,255,255,0.6)', 
    fontFamily: 'Outfit_800ExtraBold', letterSpacing: 0.5 
  },
  sideStack: {
    gap: 12,
    // flex: 1 applied conditionally in JSX (medium/large only)
  },
  smallCard: { 
    flex: 1,
    padding: 16, 
    borderRadius: 24, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12,
  },
  iconCircleSmall: { 
    width: 32, height: 32, borderRadius: 10, 
    alignItems: 'center', justifyContent: 'center', borderWidth: 1
  },
  smallValue: { 
    fontSize: 18, color: '#fff', 
    fontFamily: 'Outfit_900Black', letterSpacing: -0.5 
  },
  smallLabel: { 
    fontSize: 8, color: '#737373', 
    fontFamily: 'Outfit_900Black', letterSpacing: 1 
  },
})
