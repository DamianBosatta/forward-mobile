import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Skeleton } from '@/core/ui'
import { useIsDark, tokens } from '@/libs/theme'

export const RouteCardSkeleton = () => {
  const isDark = useIsDark()

  return (
    <View style={styles.wrapper}>
      <View style={[
        styles.card,
        {
          backgroundColor: isDark ? '#0D0D0D' : '#ffffff',
          borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
        }
      ]}>
        <View style={styles.header}>
          <Skeleton width={100} height={18} borderRadius={4} />
          <Skeleton width={80} height={20} borderRadius={8} />
        </View>

        <View style={styles.body}>
          <View style={styles.row}>
            <Skeleton width={14} height={14} borderRadius={4} />
            <Skeleton width="60%" height={12} />
          </View>
          <View style={styles.row}>
            <Skeleton width={14} height={14} borderRadius={4} />
            <Skeleton width="50%" height={12} />
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.row}>
            <Skeleton width={14} height={14} borderRadius={4} />
            <Skeleton width={60} height={10} />
          </View>
          <View style={styles.row}>
            <Skeleton width={14} height={14} borderRadius={4} />
            <Skeleton width={50} height={10} />
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 14,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  body: {
    gap: 8,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  }
})
