import React, { useRef, useEffect } from 'react'
import { View, Text, Pressable, Animated, LayoutAnimation, Platform, UIManager, useWindowDimensions } from 'react-native'
import * as Haptics from 'expo-haptics'
import { useColors, useIsDark } from '@/libs/theme'
import { BRAND } from '@/libs/theme'

// Habilitar LayoutAnimation en Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface OptionObject {
  label: string;
  value: any;
}

interface SegmentedControlProps {
  options: (string | OptionObject)[];
  selectedIndex?: number;
  value?: any;
  onChange: (value: any) => void;
}

/**
 * SegmentedControl — Premium V3 Version
 * Soporta tanto strings como objetos {label, value}.
 * Implementa animaciones suaves y estética OLED.
 */
export function SegmentedControl({ options, selectedIndex, value, onChange }: SegmentedControlProps) {
  const colors = useColors()
  const isDark = useIsDark()
  const { width } = useWindowDimensions()

  // Normalizar opciones a objetos {label, value}
  const normalizedOptions = options.map((opt, index) => {
    if (typeof opt === 'string') {
      return { label: opt, value: index };
    }
    return opt;
  });

  // Determinar el índice actual basado en index o value
  const currentIndex = normalizedOptions.findIndex((opt, index) => {
    if (value !== undefined) return opt.value === value;
    if (selectedIndex !== undefined) return index === selectedIndex;
    return false;
  });

  // Asegurarse de que el índice no sea -1 para evitar errores de animación
  const safeIndex = currentIndex === -1 ? 0 : currentIndex;

  const slideAnim = useRef(new Animated.Value(safeIndex)).current

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: safeIndex,
      useNativeDriver: false, // Layout animations on flex/width usually don't support native driver
      tension: 100,
      friction: 15,
    }).start()
  }, [safeIndex])

  const handlePress = (index: number, val: any) => {
    Haptics.selectionAsync();
    // Usar LayoutAnimation para un feeling más premium en el cambio de tabs
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onChange(val);
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: isDark ? '#FFFFFF08' : colors.surface2, 
        borderRadius: 16,
        padding: 4,
        borderWidth: 1,
        borderColor: colors.border,
        height: 48,
        alignItems: 'center',
      }}
    >
      {/* Background Indicator */}
      <View style={{
        position: 'absolute',
        top: 4,
        bottom: 4,
        left: 4,
        right: 4,
        flexDirection: 'row',
      }}>
        <Animated.View style={{
          flex: 1 / normalizedOptions.length,
          height: '100%',
          backgroundColor: colors.primary + '20',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.primary + '30',
          transform: [{
            translateX: slideAnim.interpolate({
              inputRange: normalizedOptions.map((_, i) => i),
              outputRange: normalizedOptions.map((_, i) => (width - 48) / normalizedOptions.length * i)
            })
          }]
        }} />
      </View>

      {/* Actual Buttons */}
      {normalizedOptions.map((option, i) => {
        const isActive = i === safeIndex
        return (
          <Pressable
            key={`seg-${i}`}
            onPress={() => handlePress(i, option.value)}
            style={{
              flex: 1,
              height: '100%',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: isActive ? '900' : '600',
                color: isActive ? colors.primary : (isDark ? '#FFFFFF40' : colors.textMuted),
                letterSpacing: 0.5,
                textTransform: 'uppercase'
              }}
              maxFontSizeMultiplier={1.3}
            >
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

