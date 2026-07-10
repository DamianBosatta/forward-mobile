import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Skeleton } from '@/core/ui'
import { useIsDark } from '@/libs/theme'

export const SocioCardSkeleton = () => {
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
          <View style={styles.leftRow}>
            <Skeleton width={32} height={32} borderRadius={10} />
            <View style={{ gap: 4 }}>
              <Skeleton width={140} height={18} />
              <Skeleton width={80} height={12} />
            </View>
          </View>
          <Skeleton width={60} height={20} borderRadius={10} />
        </View>

        <View style={styles.details}>
          <View style={styles.detailItem}>
            <Skeleton width={14} height={14} borderRadius={4} />
            <Skeleton width={180} height={12} />
          </View>
          <View style={styles.detailItem}>
            <Skeleton width={14} height={14} borderRadius={4} />
            <Skeleton width={120} height={12} />
          </View>
        </View>

        <View style={styles.footer}>
          <View>
            <Skeleton width={60} height={10} style={{ marginBottom: 4 }} />
            <Skeleton width={100} height={22} />
          </View>
          <View style={styles.actions}>
            <Skeleton width={36} height={36} borderRadius={12} />
            <Skeleton width={36} height={36} borderRadius={12} />
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  details: {
    gap: 8,
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  }
})
