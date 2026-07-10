import React from 'react'
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ViewStyle, 
  TextStyle, 
  ActivityIndicator,
  View
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { MotiView } from 'moti'
import { useColors, tokens } from '@/libs/theme'
import { safeHaptics } from '@/core/utils/haptics'

interface PremiumButtonProps {
  title: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
  loading?: boolean
  disabled?: boolean
  style?: ViewStyle
  textStyle?: TextStyle
  gradient?: string[]
}

export const PremiumButton = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  style,
  textStyle,
  gradient
}: PremiumButtonProps) => {
  const colors = useColors()

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          bg: gradient || [colors.primary, colors.primaryHover],
          text: '#FFFFFF',
          border: 'transparent'
        }
      case 'secondary':
        return {
          bg: [colors.surface2, colors.surface3],
          text: colors.text,
          border: colors.border
        }
      case 'outline':
        return {
          bg: ['transparent', 'transparent'],
          text: colors.primary,
          border: colors.primary
        }
      case 'danger':
        return {
          bg: ['#ef4444', '#dc2626'],
          text: '#FFFFFF',
          border: 'transparent'
        }
      default:
        return {
          bg: ['transparent', 'transparent'],
          text: colors.text,
          border: 'transparent'
        }
    }
  }

  const v = getVariantStyles()

  const handlePress = () => {
    if (disabled || loading) return
    safeHaptics.impact('medium')
    onPress()
  }

  const height = size === 'sm' ? 40 : size === 'lg' ? 64 : 54
  const fontSize = size === 'sm' ? 14 : size === 'lg' ? 17 : 15

  return (
    <MotiView
      animate={{
        scale: disabled ? 0.98 : 1,
        opacity: disabled ? 0.6 : 1
      }}
      transition={{ type: 'spring', damping: 15 }}
      style={[{ width: '100%' }, style]}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handlePress}
        disabled={disabled || loading}
        style={[
          styles.buttonBase,
          { height, borderColor: v.border, borderWidth: variant === 'outline' ? 1.5 : 0 }
        ]}
      >
        <LinearGradient
          colors={v.bg as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 16 }]}
        />
        
        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator color={v.text} size="small" />
          ) : (
            <>
              {icon && <View style={styles.icon}>{icon}</View>}
              <Text style={[
                styles.text, 
                { color: v.text, fontSize, fontFamily: 'Outfit_800ExtraBold' }, 
                textStyle
              ]}>
                {title}
              </Text>
            </>
          )}
        </View>
      </TouchableOpacity>
    </MotiView>
  )
}

const styles = StyleSheet.create({
  buttonBase: {
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    zIndex: 1
  },
  text: {
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  icon: {
    marginRight: 10
  }
})
