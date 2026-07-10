import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Skeleton } from '@/core/ui'
import { useIsDark } from '@/libs/theme'

export const StockCardSkeleton = () => {
  const isDark = useIsDark()

  return (
    <View style={styles.wrapper}>
      <View style={[
        styles.card,
        {
          backgroundColor: isDark ? '#080808' : '#ffffff',
          borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        }
      ]}>
        {/* LEFT: Image Skeleton */}
        <Skeleton width={88} height={88} borderRadius={16} />

        {/* RIGHT: Content */}
        <View style={styles.content}>
          {/* Name + Deposito */}
          <View style={{ gap: 6, marginBottom: 8 }}>
            <Skeleton width="80%" height={16} />
            <Skeleton width="40%" height={10} />
          </View>

          {/* Metrics Row */}
          <View style={{ flexDirection: 'row', gap: 5, marginBottom: 8 }}>
            <Skeleton width="23%" height={34} borderRadius={10} />
            <Skeleton width="23%" height={34} borderRadius={10} />
            <Skeleton width="23%" height={34} borderRadius={10} />
            <Skeleton width="23%" height={34} borderRadius={10} />
          </View>

          {/* Progress Bar */}
          <Skeleton width="100%" height={3} borderRadius={2} />

          {/* Action Row */}
          <View style={{ flexDirection: 'row', gap: 7, marginTop: 8 }}>
            <Skeleton width={34} height={34} borderRadius={11} />
            <Skeleton width="80%" height={34} borderRadius={11} />
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 12,
    marginVertical: 5,
  },
  card: {
    flexDirection: 'row',
    borderRadius: 22,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  content: {
    flex: 1,
  }
})
