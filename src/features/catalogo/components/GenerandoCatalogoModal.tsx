import React, { useEffect, useState } from 'react'
import { Modal, Text, View } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { FileText } from 'lucide-react-native'
import { maxFontScale, radii, shadowMd, space, typeScale, useColors, useIsDark } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { Button, Progress } from '@/core/ui/fw'

export interface ProgresoDeDescarga {
  /** Bytes already received. */
  written: number
  /** Total bytes when the server sent Content-Length; 0 when unknown. */
  total: number
}

interface Props {
  visible: boolean
  /** Products in the catalog; undefined when the format ignores the screen filters (Informativo). */
  totalProductos?: number
  /** null until the first bytes arrive: the server builds the whole PDF before sending anything. */
  progreso: ProgresoDeDescarga | null
  onCancel: () => void
}

/** 75 -> "01:15". */
export function tiempoTranscurrido(segundos: number): string {
  const m = Math.floor(segundos / 60)
  const s = segundos % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function useSegundos(activo: boolean): number {
  const [segundos, setSegundos] = useState(0)
  useEffect(() => {
    if (!activo) return
    setSegundos(0)
    const inicio = Date.now()
    const id = setInterval(() => setSegundos(Math.floor((Date.now() - inicio) / 1000)), 1000)
    return () => clearInterval(id)
  }, [activo])
  return segundos
}

/** Soft pulse on the icon; with Reduce Motion it stays still (the elapsed time already shows it is alive). */
function IconoQueLatE() {
  const c = useColors()
  const reducido = useReducedMotion()
  const pulso = useSharedValue(1)
  useEffect(() => {
    if (reducido) {
      pulso.value = 1
      return
    }
    pulso.value = withRepeat(withTiming(0.45, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true)
  }, [reducido, pulso])
  const estilo = useAnimatedStyle(() => ({ opacity: pulso.value }))
  return (
    <Animated.View testID="generando-icono" style={estilo}>
      <FileText size={48} color={c.accentText} />
    </Animated.View>
  )
}

/**
 * Blocks the whole app while the catalog PDF is built and downloaded. The Android back button does nothing:
 * only "Cancelar" closes it (if the server hangs, the user can leave without restarting the app).
 */
export function GenerandoCatalogoModal({ visible, totalProductos, progreso, onCancel }: Props) {
  const c = useColors()
  const sombra = shadowMd[useIsDark() ? 'dark' : 'light']
  const { isLarge } = useResponsive()
  const segundos = useSegundos(visible)

  const conTotal = !!progreso && progreso.total > 0
  const porcentaje = conTotal ? Math.min(100, Math.floor((progreso.written / progreso.total) * 100)) : 0
  const estado = !progreso ? 'Armando el catálogo…' : conTotal ? `Descargando… ${porcentaje} %` : 'Descargando…'

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => {}}>
      <View style={{ flex: 1, backgroundColor: c.veil, justifyContent: 'center', alignItems: 'center', padding: space[6] }}>
        <View
          role="dialog"
          aria-modal
          accessibilityLabel="Generando catálogo"
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: isLarge ? 480 : 400,
            backgroundColor: c.bg,
            borderRadius: radii.tarjetaGrande,
            padding: space[6],
            gap: space[4],
            alignItems: 'center',
            ...sombra,
          }}
        >
          <IconoQueLatE />
          <Text maxFontSizeMultiplier={maxFontScale} style={[typeScale.titulo, { color: c.text, textAlign: 'center' }]}>
            Generando catálogo
          </Text>
          {totalProductos !== undefined && (
            <Text style={[typeScale.cuerpo, { color: c.textSecondary, textAlign: 'center' }]}>
              {totalProductos === 1 ? '1 producto' : `${totalProductos} productos`}
            </Text>
          )}
          <View style={{ width: '100%', gap: space[2] }}>
            {conTotal && <Progress value={progreso.written} max={progreso.total} accessibilityLabel="Avance de la descarga del catálogo" />}
            <Text accessibilityLiveRegion="polite" style={[typeScale.secundario, { color: c.textSecondary, textAlign: 'center' }]}>
              {estado}
            </Text>
            <Text style={[typeScale.secundario, { color: c.textSecondary, textAlign: 'center', fontVariant: ['tabular-nums'] }]}>
              Tiempo: {tiempoTranscurrido(segundos)}
            </Text>
          </View>
          <View style={{ width: '100%' }}>
            <Button label="Cancelar" variant="secundario" onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  )
}
