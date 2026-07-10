import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Package, AlertTriangle, TrendingUp, Truck } from 'lucide-react-native'
import { useColors } from '@/libs/theme'
import { MotiView } from 'moti'
import { LinearGradient } from 'expo-linear-gradient'
import { KpiStatRow } from '@/core/ui'

interface InventoryKpiCardsProps {
  totalValue: number
  totalItems: number
  lowStockCount: number
  totalVirtual: number
}

export function InventoryKpiCards({ totalValue, totalItems, lowStockCount, totalVirtual }: InventoryKpiCardsProps) {
  const colors = useColors()

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(value)

  const kpis = [
    {
      label: 'VALOR TOTAL',
      value: formatCurrency(totalValue),
      sub: 'Valuación activos',
      icon: TrendingUp,
      gradient: [colors.primary, '#005d52'] as [string, string],
      textColor: '#fff',
      large: true,
    },
    {
      label: 'SKUs',
      value: String(totalItems),
      sub: 'Productos activos',
      icon: Package,
      color: colors.primary,
      large: false,
    },
    {
      label: 'EN TRÁNSITO',
      value: String(totalVirtual),
      sub: 'Stock virtual',
      icon: Truck,
      color: colors.info,
      large: false,
    },
    {
      label: 'CRÍTICO',
      value: String(lowStockCount),
      sub: 'Bajo mínimo',
      icon: AlertTriangle,
      color: lowStockCount > 0 ? colors.danger : colors.success,
      large: false,
      alert: lowStockCount > 0,
    },
  ]

  return (
    <View style={styles.container}>
      {/* Main KPI — Valor total (full width gradient) */}
      <MotiView
        from={{ opacity: 0, scale: 0.95, translateY: 16 }}
        animate={{ opacity: 1, scale: 1, translateY: 0 }}
        transition={{ type: 'spring', damping: 16 }}
      >
        <LinearGradient
          colors={[colors.primary, '#00695e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.mainCard}
        >
          <View style={styles.mainLeft}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.15)' }]}>
              <TrendingUp size={22} color="#fff" strokeWidth={2.5} />
            </View>
            <View>
              <Text style={styles.mainLabel}>VALOR TOTAL</Text>
              <Text style={styles.mainValue}>{formatCurrency(totalValue)}</Text>
              <Text style={styles.mainSub}>Valuación de inventario activo</Text>
            </View>
          </View>
        </LinearGradient>
      </MotiView>

      {/* 3 Mini KPIs — shared KpiStatRow */}
      <KpiStatRow
        stats={[
          {
            key: 'skus',
            label: 'SKUs',
            value: String(totalItems),
            sub: 'Productos',
            icon: Package,
            color: colors.primary,
          },
          {
            key: 'transito',
            label: 'EN TRÁNSITO',
            value: String(totalVirtual),
            sub: 'Virtual',
            icon: Truck,
            color: colors.info,
          },
          {
            key: 'critico',
            label: 'CRÍTICO',
            value: String(lowStockCount),
            sub: 'Bajo mínimo',
            icon: AlertTriangle,
            color: lowStockCount > 0 ? colors.danger : '#525252',
            alert: lowStockCount > 0,
          },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    gap: 10,
    marginBottom: 8,
  },
  // Main card
  mainCard: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  mainLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.65)',
    fontFamily: 'Outfit_900Black',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  mainValue: {
    fontSize: 28,
    color: '#fff',
    fontFamily: 'Outfit_900Black',
    letterSpacing: -1,
    lineHeight: 32,
  },
  mainSub: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Outfit_600SemiBold',
    marginTop: 2,
  },
})
