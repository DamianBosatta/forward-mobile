import React from 'react'
import { View, Text } from 'react-native'
import { BlurView } from 'expo-blur'
import { Lock } from 'lucide-react-native'
import { useColors, BRAND } from '@/libs/theme'

interface ReadOnlyNoticeProps {
  message?: string
}

/**
 * ReadOnlyNotice — banner displayed when the authenticated user is not the
 * assigned driver for the active route, or when the route is locked/finalized.
 * Matches the GlassCard/BlurView idiom used throughout consola.tsx.
 */
export function ReadOnlyNotice({ message }: ReadOnlyNoticeProps) {
  const colors = useColors()
  const label = message ?? 'Este viaje es de solo lectura. No podés reportar paradas.'

  return (
    <BlurView
      intensity={60}
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        marginHorizontal: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: BRAND.orange + '60',
      }}
    >
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        backgroundColor: BRAND.orange + '15',
      }}>
        <Lock size={20} color={BRAND.orange} />
        <Text style={{
          flex: 1,
          fontSize: 13,
          fontWeight: '700',
          color: colors.text,
          lineHeight: 18,
        }}>
          {label}
        </Text>
      </View>
    </BlurView>
  )
}
