import React, { useEffect } from 'react'
import { Modal, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CircleCheck } from 'lucide-react-native'
import { space, typeScale, useColors } from '@/libs/theme'
import { Button } from '@/core/ui/fw'
import { safeHaptics } from '@/core/utils/haptics'

/**
 * Cierre de "No pude entregar" (S19): Ventas ya sabe y reprograma; el chofer sigue con la próxima parada.
 * Un solo botón grande. Vibra una vez al aparecer (confirmación).
 */
export function AvisadoVentas({ guardado, onVolver }: { guardado: boolean; onVolver: () => void }) {
  const c = useColors()
  const { bottom } = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const columna = width >= 768 ? { maxWidth: 640, width: '100%' as const, alignSelf: 'center' as const } : null
  useEffect(() => {
    safeHaptics.notification('success')
  }, [])
  return (
    <Modal visible animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onVolver}>
      <View accessibilityLabel="Avisamos a Ventas" style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={{ flex: 1, padding: space[4], gap: space[3], justifyContent: 'center', alignItems: 'center', ...columna }}>
          <CircleCheck size={56} color={c.brandInk} strokeWidth={2.5} />
          <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text, textAlign: 'center' }}>Listo, avisamos a Ventas</Text>
          <Text style={{ ...typeScale.cuerpo, color: c.textSecondary, textAlign: 'center' }}>Lo reprograman. Seguís con la próxima parada.</Text>
          {guardado ? (
            <Text style={{ ...typeScale.cuerpo, color: c.textSecondary, textAlign: 'center' }}>Quedó guardado en el teléfono. Se manda solo cuando haya señal.</Text>
          ) : null}
        </View>
        <View style={{ backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border, padding: space[4], paddingBottom: space[4] + bottom }}>
          <View style={columna ?? undefined}>
            <Button size="xl" label="Volver al viaje" onPress={onVolver} />
          </View>
        </View>
      </View>
    </Modal>
  )
}
