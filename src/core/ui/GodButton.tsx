import React from 'react'
import { 
  Text, 
  Pressable, 
  StyleSheet, 
  ActivityIndicator, 
  View,
  ViewStyle,
  TextStyle
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { MotiView } from 'moti'
import { safeHaptics } from '@/core/utils/haptics'
interface GodButtonProps {
  label: string
  onPress: () => void
  isLoading?: boolean
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'danger'
  icon?: React.ReactNode
  style?: ViewStyle
  textStyle?: TextStyle
}

/**
 * GodButton - Botón Premium con gradientes dinámicos y respuesta táctil.
 */
export const GodButton = ({
  label,
  onPress,
  isLoading = false,
  disabled = false,
  variant = 'primary',
  icon,
  style,
  textStyle
}: GodButtonProps) => {
  
  const getGradientColors = (): [string, string] => {
    if (disabled) return ['#45464d', '#213145']
    switch (variant) {
      case 'danger': return ['#ef4444', '#991b1b']
      case 'secondary': return ['rgba(0,193,158,0.1)', 'rgba(0,193,158,0.05)']
      default: return ['#00c19e', '#98d14d']
    }
  }

  const handlePress = () => {
    if (!disabled && !isLoading) {
      safeHaptics.impact('medium')
      onPress()
    }
  }

  return (
    <MotiView
      animate={{
        scale: disabled ? 0.98 : 1,
        opacity: disabled ? 0.6 : 1,
      }}
      style={[styles.container, style]}
    >
      <Pressable
        onPress={handlePress}
        disabled={disabled || isLoading}
        style={({ pressed }) => [
          styles.pressable,
          pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
        ]}
      >
        <LinearGradient
          colors={getGradientColors()}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <View style={styles.content}>
              <Text style={[styles.text, textStyle, variant === 'secondary' && { color: '#b4c5ff' }]} maxFontSizeMultiplier={1.3}>
                {label?.toUpperCase() || ''}
              </Text>
              {icon && <View style={styles.iconContainer}>{icon}</View>}
            </View>
          )}
        </LinearGradient>
      </Pressable>
    </MotiView>
  )
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#00c19e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  pressable: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  iconContainer: {
    marginLeft: 4,
  }
})
