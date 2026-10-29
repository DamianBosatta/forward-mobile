import { forwardRef, useState } from 'react'
import { Pressable as RNPressable, type GestureResponderEvent, type PressableProps, type View } from 'react-native'

/**
 * `Pressable` whose style can be a function of `pressed`, also on the device.
 *
 * NativeWind (react-native-css-interop 0.2.x) wraps React Native's `Pressable` and reads `style` as an object, so a
 * style function is dropped on Android: the button loses its size, background and layout (the "Nueva venta" Fab was
 * invisible). This one keeps `pressed` itself and hands React Native an already resolved style. Use it instead of
 * importing `Pressable` from 'react-native' whenever the style depends on `pressed`.
 */
export const Pressable = forwardRef<View, PressableProps>(function Pressable({ style, onPressIn, onPressOut, ...props }, ref) {
  const [pressed, setPressed] = useState(false)
  const resolved = typeof style === 'function' ? style({ pressed, hovered: false }) : style
  return (
    <RNPressable
      ref={ref}
      {...props}
      onPressIn={(e: GestureResponderEvent) => { setPressed(true); onPressIn?.(e) }}
      onPressOut={(e: GestureResponderEvent) => { setPressed(false); onPressOut?.(e) }}
      style={resolved}
    />
  )
})
