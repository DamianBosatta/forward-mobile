import React from 'react'
import Svg, { Path, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg'
import { View, Text, TouchableOpacity } from 'react-native'
import { useColors, useIsDark } from '@/libs/theme'

interface ForwardLogoProps {
  size?: number
  showText?: boolean
  onPress?: () => void
}

/**
 * Forward Logo — Premium Vector Version
 * Refined paths, gradients, and professional typography.
 */
export function ForwardLogo({ size = 32, showText = true, onPress }: ForwardLogoProps) {
  const colors = useColors()
  const isDark = useIsDark()
  const svgHeight = (size * 220) / 280

  const Container = onPress ? TouchableOpacity : View

  return (
    <Container 
      onPress={onPress} 
      activeOpacity={0.7} 
      style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: showText ? 14 : 0 
      }}
    >
      <View style={{ width: size, height: svgHeight }}>
        <Svg width={size} height={svgHeight} viewBox="0 0 280 220" fill="none">
          <Defs>
            <LinearGradient id="triangleGrad" x1="0" y1="220" x2="280" y2="0">
              <Stop offset="0" stopColor={colors.primary} stopOpacity="1" />
              <Stop offset="1" stopColor={colors.primaryHover} stopOpacity="1" />
            </LinearGradient>
            <LinearGradient id="arrowGrad" x1="20" y1="160" x2="270" y2="155">
              <Stop offset="0" stopColor={colors.secondary} />
              <Stop offset="1" stopColor={colors.primary} />
            </LinearGradient>
          </Defs>

          {/* Triángulo SUAVIZADO - Centrado Matemático */}
          <Path
            d="M250 20 Q270 20 270 40 V200 Q270 220 250 220 H30 Q10 220 20 200 L240 25 Q245 15 250 20 Z"
            fill="url(#triangleGrad)"
          />

          {/* Flecha dinámica SUAVIZADA - Centrada */}
          <Path
            d="M30 160 Q90 150 250 160 L180 130 M250 160 L180 190"
            stroke={isDark ? "#FFFFFF" : colors.primary} 
            strokeWidth={16}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={1}
          />

          {/* Texto FWD - Centrado Mejorado */}
          <SvgText
            x="35" 
            y="125"
            fontWeight="900"
            fontSize="105"
            fill={isDark ? "#FFFFFF" : colors.primary}
            letterSpacing={-10}
            fontFamily="Outfit_900Black"
          >
            FWD
          </SvgText>
        </Svg>
      </View>

      {showText && (
        <View style={{ justifyContent: 'center' }}>
          <Text
            style={{
              fontSize: size * 0.62,
              fontWeight: '900',
              color: colors.text,
              letterSpacing: -0.8,
              lineHeight: size * 0.65,
              textTransform: 'uppercase',
              fontFamily: 'Outfit_900Black'
            }}
          >
            FORWARD
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
            <View style={{ height: 1, flex: 1, backgroundColor: colors.primary, opacity: 0.3, marginRight: 6 }} />
            <Text
              style={{
                fontSize: size * 0.22,
                fontWeight: '900',
                color: colors.primary,
                letterSpacing: 4,
                textTransform: 'uppercase',
                fontFamily: 'Outfit_900Black'
              }}
            >
              DISTRIBUIDORA
            </Text>
          </View>
        </View>
      )}
    </Container>
  )
}
