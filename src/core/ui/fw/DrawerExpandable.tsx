import React from 'react'
import { View } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated'
import { ChevronDown, type LucideIcon } from 'lucide-react-native'
import { space, useColors } from '@/libs/theme'
import { DrawerItem } from './DrawerItem'
import { Entrada } from './Entrada'

interface Props {
  label: string
  icon: LucideIcon
  abierta: boolean
  onToggle: () => void
  oscuro?: boolean
  /** Las filas hijas (DrawerItem con `hija`), ya resueltas por el padre. */
  children: React.ReactNode
}

/** Fila con chevron que despliega a sus hijas en el lugar (Logística). El chevron gira 180 grados; las hijas entran escalonadas 70 ms. */
export function DrawerExpandable({ label, icon, abierta, onToggle, oscuro = false, children }: Props) {
  const c = useColors()
  const reducido = useReducedMotion()
  const giro = useSharedValue(abierta ? 1 : 0)
  React.useEffect(() => {
    giro.value = reducido ? (abierta ? 1 : 0) : withTiming(abierta ? 1 : 0, { duration: 250 })
  }, [abierta, reducido, giro])
  const estiloChevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${giro.value * 180}deg` }] }))
  const color = oscuro ? c.onPanelOscuroStrong : c.text
  const hijas = React.Children.toArray(children)
  return (
    <View>
      <DrawerItem
        label={label}
        icon={icon}
        oscuro={oscuro}
        onPress={onToggle}
        expandida={abierta}
        fondo={abierta && !oscuro ? c.surface : undefined}
        derecha={
          <Animated.View style={estiloChevron}>
            <ChevronDown size={20} color={color} strokeWidth={2} />
          </Animated.View>
        }
      />
      {abierta ? (
        <View style={{ marginLeft: space[5], marginVertical: 2, gap: 2 }}>
          {hijas.map((h, i) => (
            <Entrada key={i} tipo="fila" indice={i} escalon={70}>
              {h}
            </Entrada>
          ))}
        </View>
      ) : null}
    </View>
  )
}
