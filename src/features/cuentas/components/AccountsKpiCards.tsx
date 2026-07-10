import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Landmark, TrendingUp, Users, Wallet, PiggyBank, ArrowDownLeft, ArrowUpRight } from 'lucide-react-native'
import { useColors, tokens } from '@/libs/theme'
import { MotiView } from 'moti'
import { GlassCard } from '@/core/ui'
import { LinearGradient } from 'expo-linear-gradient'

interface AccountsKpiCardsProps {
  totalLiquidez: number
  crecimiento?: string
  propiasCount: number
  sociosCount: number
  totalACobrar?: number
  totalAPagar?: number
}

export function AccountsKpiCards({ totalLiquidez, crecimiento, propiasCount, sociosCount, totalACobrar = 0, totalAPagar = 0 }: AccountsKpiCardsProps) {
  const colors = useColors()

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(value)
  }

  const secondaryCardStyle = {
    padding: 20,
    borderRadius: 28,
    backgroundColor: colors.surface,
    gap: 14,
  } as const

  const iconContainerSecondaryStyle = {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: `${colors.primary}10`,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: `${colors.primary}20`,
  }

  return (
    <View style={styles.container}>
      {/* Principal Bento Piece: Liquidez Total */}
      <MotiView
        from={{ opacity: 0, scale: 0.9, translateY: 20 }}
        animate={{ opacity: 1, scale: 1, translateY: 0 }}
        transition={{ type: 'spring', damping: 15 }}
        style={{ width: '100%' }}
      >
        <LinearGradient
          colors={[colors.primary, '#004d40']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.mainCard}
        >
          <View style={styles.mainCardContent}>
            <View style={styles.iconContainerMain}>
              <Landmark size={32} color="#FFFFFF" strokeWidth={2.5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.kpiLabelMain}>LIQUIDEZ TOTAL DISPONIBLE</Text>
              <Text style={styles.kpiValueMain}>{formatCurrency(totalLiquidez)}</Text>
              {crecimiento && (
                <View style={styles.trendBadge}>
                  <TrendingUp size={12} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.trendText}>{crecimiento.toUpperCase()}</Text>
                </View>
              )}
            </View>
          </View>
        </LinearGradient>
      </MotiView>

      {/* Secondary Bento Grid */}
      <View style={styles.gridContainer}>
        {/* Propias Card */}
        <MotiView
          from={{ opacity: 0, scale: 0.9, translateY: 20 }}
          animate={{ opacity: 1, scale: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 15, delay: 100 }}
          style={{ flex: 1 }}
        >
          <GlassCard intensity={8} style={secondaryCardStyle}>
            <View style={iconContainerSecondaryStyle}>
              <PiggyBank size={22} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.kpiLabelSecondary, { color: colors.textMuted }]}>PROPIAS</Text>
              <Text style={[styles.kpiValueSecondary, { color: colors.text }]}>{propiasCount}</Text>
            </View>
          </GlassCard>
        </MotiView>

        {/* Socios Card */}
        <MotiView
          from={{ opacity: 0, scale: 0.9, translateY: 20 }}
          animate={{ opacity: 1, scale: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 15, delay: 200 }}
          style={{ flex: 1 }}
        >
          <GlassCard intensity={8} style={secondaryCardStyle}>
            <View style={iconContainerSecondaryStyle}>
              <Users size={22} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.kpiLabelSecondary, { color: colors.textMuted }]}>SOCIOS</Text>
              <Text style={[styles.kpiValueSecondary, { color: colors.text }]}>{sociosCount}</Text>
            </View>
          </GlassCard>
        </MotiView>
      </View>

      {/* Por Cobrar / Por Pagar */}
      <View style={styles.gridContainer}>
        <MotiView
          from={{ opacity: 0, scale: 0.9, translateY: 20 }}
          animate={{ opacity: 1, scale: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 15, delay: 300 }}
          style={{ flex: 1 }}
        >
          <GlassCard intensity={8} style={secondaryCardStyle}>
            <View style={[iconContainerSecondaryStyle, { backgroundColor: `${colors.danger}12`, borderColor: `${colors.danger}25` }]}>
              <ArrowDownLeft size={22} color={colors.danger} />
            </View>
            <View>
              <Text style={[styles.kpiLabelSecondary, { color: colors.textMuted }]}>POR COBRAR</Text>
              <Text style={[styles.kpiValueFinance, { color: colors.danger }]} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(totalACobrar)}</Text>
            </View>
          </GlassCard>
        </MotiView>

        <MotiView
          from={{ opacity: 0, scale: 0.9, translateY: 20 }}
          animate={{ opacity: 1, scale: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 15, delay: 400 }}
          style={{ flex: 1 }}
        >
          <GlassCard intensity={8} style={secondaryCardStyle}>
            <View style={[iconContainerSecondaryStyle, { backgroundColor: `${colors.warning}12`, borderColor: `${colors.warning}25` }]}>
              <ArrowUpRight size={22} color={colors.warning} />
            </View>
            <View>
              <Text style={[styles.kpiLabelSecondary, { color: colors.textMuted }]}>POR PAGAR</Text>
              <Text style={[styles.kpiValueFinance, { color: colors.warning }]} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(totalAPagar)}</Text>
            </View>
          </GlassCard>
        </MotiView>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 20,
  },
  mainCard: {
    padding: 24,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  mainCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  iconContainerMain: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  kpiLabelMain: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Outfit_900Black',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  kpiValueMain: {
    fontSize: 28,
    color: '#FFFFFF',
    fontFamily: 'Outfit_900Black',
    letterSpacing: -1,
    marginVertical: 4,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  trendText: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 0.5,
  },
  gridContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  kpiLabelSecondary: {
    fontSize: 9,
    fontFamily: 'Outfit_900Black',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  kpiValueSecondary: {
    fontSize: 26,
    fontFamily: 'Outfit_900Black',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  kpiValueFinance: {
    fontSize: 18,
    fontFamily: 'Outfit_900Black',
    letterSpacing: -0.5,
    marginTop: 2,
  },
})
