import React from 'react'
import { View, Text } from 'react-native'
import { GlassCard } from './GlassCard'
import { MotiView } from 'moti'
import { useColors } from '@/libs/theme'

interface KpiCardMobileProps {
  label: string
  value: string
  sub?: string
  accent?: string
  icon?: React.ReactNode
  index?: number
}

export function KpiCardMobile({ 
  label, 
  value, 
  sub, 
  accent = '#00CBA9', 
  icon,
  index = 0
}: KpiCardMobileProps) {
  const colors = useColors()

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.9, translateY: 20 }}
      animate={{ opacity: 1, scale: 1, translateY: 0 }}
      transition={{ 
        type: 'spring', 
        delay: index * 100,
        damping: 15
      }}
      style={{ flex: 1 }}
    >
      <GlassCard 
        intensity={15}
        style={{ flex: 1 }}
        borderColor={[accent + '30', accent + '05']}
      >
        <View style={{ position: 'relative', overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text 
              style={{ 
                color: colors.textMuted, 
                fontSize: 10, 
                textTransform: 'uppercase', 
                fontFamily: 'Outfit_900Black',
                letterSpacing: 1.5,
              }}
              numberOfLines={1}
            >
              {label}
            </Text>
            {icon && (
              <View 
                style={{ 
                  width: 36, height: 36, borderRadius: 12, 
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: accent + '10'
                }}
              >
                {icon}
              </View>
            )}
          </View>

          <Text 
            style={{ 
              fontSize: 26, 
              color: colors.text, 
              marginBottom: 4,
              fontFamily: 'Outfit_900Black',
              letterSpacing: -1,
            }}
          >
            {value}
          </Text>

          {sub && (
            <Text style={{ 
              fontSize: 11, 
              color: colors.textMuted, 
              opacity: 0.8, 
              textTransform: 'uppercase', 
              letterSpacing: 0.5,
              fontFamily: 'Outfit_700Bold'
            }}>
              {sub}
            </Text>
          )}

          {/* Minimalist modern indicator */}
          <View 
            style={{ 
              height: 3, 
              width: 24, 
              borderRadius: 2, 
              marginTop: 16,
              backgroundColor: accent,
              shadowColor: accent,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.6,
              shadowRadius: 6,
              elevation: 4
            }} 
          />
        </View>
      </GlassCard>
    </MotiView>
  )
}
