import React from 'react'
import { View, StyleSheet } from 'react-native'
import { GlassCard, Skeleton } from '@/core/ui'
import { useIsDark } from '@/libs/theme'

export const VentaCardSkeleton = () => {
  const isDark = useIsDark()

  return (
    <View style={styles.wrapper}>
      <GlassCard
        intensity={8}
        style={{
          borderRadius: 32,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
          overflow: 'hidden',
          padding: 20
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Skeleton width="70%" height={22} borderRadius={6} style={{ marginBottom: 8 }} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Skeleton width={60} height={16} borderRadius={4} />
              <Skeleton width={80} height={16} borderRadius={4} />
            </View>
          </View>
          <Skeleton width={80} height={28} borderRadius={14} />
        </View>

        <View style={[styles.cardAmountBox, {
          backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
          borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
        }]}>
          <View>
            <Skeleton width={80} height={10} style={{ marginBottom: 6 }} />
            <Skeleton width={120} height={30} />
          </View>
          <Skeleton width={44} height={44} borderRadius={15} />
        </View>

        <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', marginVertical: 14 }} />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Skeleton width={140} height={14} />
          <Skeleton width={60} height={14} />
        </View>
      </GlassCard>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  cardAmountBox: {
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
  }
})
