import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Skeleton } from '@/core/ui'
import { useIsDark } from '@/libs/theme'

export const CompraCardSkeleton = () => {
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
          <View style={{ flex: 1 }}>
            <Skeleton width="60%" height={18} style={{ marginBottom: 6 }} />
            <Skeleton width="40%" height={12} />
          </View>
          <Skeleton width={80} height={24} borderRadius={10} />
        </View>

        <View style={styles.amountBox}>
          <Skeleton width={60} height={10} style={{ marginBottom: 6 }} />
          <Skeleton width="50%" height={32} />
        </View>

        <View style={styles.footer}>
          <Skeleton width={100} height={14} />
          <Skeleton width={60} height={14} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { marginHorizontal: 16, marginBottom: 12 },
  card: { borderRadius: 24, borderWidth: 1, padding: 16, borderBottomWidth: 4, borderBottomColor: 'rgba(255,255,255,0.1)' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  amountBox: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 14, marginBottom: 16 },
  footer: { flexDirection: 'row', justifyContent: 'space-between' }
})
