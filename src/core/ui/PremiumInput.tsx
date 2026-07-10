import React, { useState } from 'react'
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  Platform, 
  TextInputProps,
  ViewStyle
} from 'react-native'
import { MotiView } from 'moti'
import { useColors, tokens, useIsDark } from '@/libs/theme'

interface PremiumInputProps extends TextInputProps {
  label: string
  icon?: React.ReactNode
  rightElement?: React.ReactNode
  containerStyle?: ViewStyle
  hideLabel?: boolean
  variant?: 'form' | 'search'
}

/**
 * PremiumInput - Input premium con estados de foco animados y soporte OLED.
 */
export const PremiumInput = ({
  label,
  icon,
  rightElement,
  containerStyle,
  hideLabel = false,
  variant = 'form',
  ...props
}: PremiumInputProps) => {
  const [isFocused, setIsFocused] = useState(false)
  const colors = useColors()
  const isDark = useIsDark()

  const height = variant === 'search' ? 54 : 62

  return (
    <View style={[styles.container, hideLabel && { marginBottom: 0 }, containerStyle]}>
      {/* Etiqueta Técnica */}
      {!hideLabel && (
        <Text style={[
          styles.label, 
          { color: isFocused ? colors.primary : colors.textMuted, fontFamily: 'Outfit_700Bold' }
        ]}>
          {label.toUpperCase()}
        </Text>
      )}

      <MotiView
        animate={{
          borderColor: isFocused ? colors.primary : (variant === 'search' ? 'rgba(255,255,255,0.05)' : colors.glassBorder),
          backgroundColor: isFocused ? (isDark ? 'rgba(0, 209, 193, 0.05)' : 'rgba(0, 180, 162, 0.05)') : colors.inputBg,
          shadowOpacity: isFocused && isDark ? 0.3 : 0,
          scale: isFocused ? 1.01 : 1,
        }}
        transition={{ type: 'spring', damping: 15 }}
        style={[
          styles.inputWrapper, 
          { height, borderColor: colors.glassBorder },
          variant === 'search' && { borderRadius: 18, paddingHorizontal: 18 }
        ]}
      >
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        
        <TextInput
          style={[styles.input, { color: colors.text, fontFamily: 'Outfit_600SemiBold', fontSize: variant === 'search' ? 15 : 16 }]}
          placeholderTextColor={colors.textMuted}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          selectionColor={colors.primary}
          {...props}
        />

        {rightElement && (
          <View style={styles.rightElementContainer}>
            {rightElement}
          </View>
        )}
        
        {/* Línea inferior de acento técnica */}
        {isFocused && (
          <MotiView
            from={{ width: '0%', opacity: 0 }}
            animate={{ width: '100%', opacity: 1 }}
            style={[styles.focusLine, { backgroundColor: colors.primary }]}
          />
        )}
      </MotiView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    shadowColor: '#000',
  },
  input: {
    flex: 1,
    paddingLeft: 4,
    height: '100%',
  },
  iconContainer: {
    marginRight: 12,
  },
  rightElementContainer: {
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  focusLine: {
    position: 'absolute',
    bottom: -1.5,
    left: 20,
    right: 20,
    height: 2,
    borderRadius: 1,
  }
})
