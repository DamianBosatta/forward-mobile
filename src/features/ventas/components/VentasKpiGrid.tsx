import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { TrendingUp } from 'lucide-react-native'
import { useColors } from '@/libs/theme'
import { MotiView } from 'moti'
import { LinearGradient } from 'expo-linear-gradient'
import { useResponsive } from '@/libs/useResponsive'

interface VentasKpiGridProps {
  /** Total de órdenes del mes según el servidor; undefined mientras no llegó. */
  ordersCount: number | undefined
  currentMonth: string
}

export function VentasKpiGrid({ ordersCount, currentMonth }: VentasKpiGridProps) {
  const colors = useColors()
  const { isSmall } = useResponsive()

  return (
    <View style={styles.container}>
      <View style={[styles.gridWrapper, isSmall ? styles.stacked : styles.row]} testID="kpi-grid-wrapper">
        {/* Total de órdenes del servidor */}
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
              <Text style={styles.mainLabel} maxFontSizeMultiplier={1.3}>ÓRDENES {currentMonth}</Text>
            </View>
            <View>
              <Text style={styles.mainValue} maxFontSizeMultiplier={1.3}>{ordersCount === undefined ? '—' : ordersCount}</Text>
              <View style={styles.mainFooter}>
                <View style={styles.footerDot} />
                <Text style={styles.footerText} maxFontSizeMultiplier={1.3}>EN EL PERÍODO</Text>
              </View>
            </View>
          </LinearGradient>
        </MotiView>

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
