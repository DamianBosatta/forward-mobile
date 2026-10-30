import React, { useEffect } from 'react'
import { Modal, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CircleCheck } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, Progress, formatImporte } from '@/core/ui/fw'
import { safeHaptics } from '@/core/utils/haptics'
import type { ParadaDto } from '@/libs/api-client/types'
import { textoPiezas } from './piezasParada'

interface Props {
  parada: ParadaDto
  /** Lo que se cobró en esta parada (0 si quedó todo en la cuenta). */
  cobrado: number
  piezas: number
  hechas: number
  total: number
  /** La próxima parada pendiente; `null` si era la última. */
  siguiente: { parada: ParadaDto; numero: number } | null
  onSiguiente: () => void
  onTermine: () => void
  /** La entrega quedó guardada en el teléfono (sin señal) y sale sola cuando vuelva (chofer-07-estados). */
  sinSenal?: boolean
}

/**
 * Lámina chofer-06: la entrega quedó registrada. Muestra lo que se llevó la parada, el avance del
 * viaje y la próxima parada, con un solo botón grande. Vibra una vez al aparecer (éxito).
 */
export function EntregaLista({ parada, cobrado, piezas, hechas, total, siguiente, onSiguiente, onTermine, sinSenal = false }: Props) {
  const c = useColors()
  const { bottom } = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const columna = width >= 768 ? { maxWidth: 640, width: '100%' as const, alignSelf: 'center' as const } : null
  useEffect(() => {
    safeHaptics.notification('success')
  }, [])
  return (
    <Modal visible animationType="fade" onRequestClose={siguiente ? onSiguiente : onTermine}>
      <View accessibilityLabel="Entrega lista" style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={{ flex: 1, padding: space[4], gap: space[4], justifyContent: 'center', ...columna }}>
          <View style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[5], gap: space[2], alignItems: 'center' }}>
            <CircleCheck size={56} color={c.brandInk} strokeWidth={2.5} />
            <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text, textAlign: 'center' }}>Entrega lista</Text>
            <Text style={{ ...typeScale.cuerpo, color: c.textSecondary, textAlign: 'center' }}>{parada.clienteNombre}</Text>
            <Text style={{ ...typeScale.cuerpoDestacado, ...importe, color: c.text, textAlign: 'center' }}>
              {`${textoPiezas(piezas)} · cobrado ${formatImporte(cobrado)}`}
            </Text>
            {sinSenal ? (
              <Text style={{ ...typeScale.cuerpo, color: c.textSecondary, textAlign: 'center' }}>
                Entrega guardada en el teléfono. Se manda sola cuando haya señal.
              </Text>
            ) : null}
          </View>
          <View style={{ gap: space[2] }}>
            <Text style={{ ...typeScale.seccion, color: c.text }}>{`${hechas} de ${total} entregadas`}</Text>
            <Progress value={hechas} max={total} accessibilityLabel="Entregas hechas" />
          </View>
          {siguiente ? (
            <View accessibilityLabel="Próxima parada" style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[4], gap: space[1] }}>
              <Text style={{ ...typeScale.etiqueta, color: c.textSecondary }}>{`Sigue · Parada ${siguiente.numero}`}</Text>
              <Text style={{ ...typeScale.seccion, color: c.text }}>{siguiente.parada.clienteNombre}</Text>
              <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{siguiente.parada.direccion}</Text>
            </View>
          ) : (
            <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>Era la última parada del viaje.</Text>
          )}
        </View>
        <View style={{ backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border, padding: space[4], paddingBottom: space[4] + bottom }}>
          <View style={columna ?? undefined}>
            <Button size="xl" label={siguiente ? 'Siguiente entrega' : 'Terminé el viaje'} onPress={siguiente ? onSiguiente : onTermine} />
          </View>
        </View>
      </View>
    </Modal>
  )
}
