import React, { useEffect } from 'react'
import { Modal, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Check } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, Progress, formatImporte, useColumnaDeFormulario } from '@/core/ui/fw'
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
  const columna = useColumnaDeFormulario()
  useEffect(() => {
    safeHaptics.notification('success')
  }, [])
  return (
    <Modal visible animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={siguiente ? onSiguiente : onTermine}>
      <View accessibilityLabel="Entrega lista" style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={{ flex: 1, padding: space[4], gap: space[4], justifyContent: 'center', ...columna }}>
          {/* Tarjeta teal ("hecho"): disco ink con tilde lime, todo el texto en ink. */}
          <View style={{ backgroundColor: c.teal, borderRadius: radii.tarjetaGrande, padding: space[6], gap: space[2], alignItems: 'center' }}>
            <View style={{ width: 96, height: 96, borderRadius: radii.pastilla, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}>
              <Check size={52} color={c.lime} strokeWidth={3} />
            </View>
            <Text accessibilityRole="header" style={{ ...typeScale.tituloPantalla, color: c.ink, textAlign: 'center' }}>Entrega lista</Text>
            <Text style={{ ...typeScale.cuerpoDestacado, color: c.ink, textAlign: 'center' }}>{parada.clienteNombre}</Text>
            <Text style={{ ...typeScale.cuerpoDestacado, ...importe, color: c.ink, textAlign: 'center' }}>
              {`${textoPiezas(piezas)} · cobrado ${formatImporte(cobrado)}`}
            </Text>
            {sinSenal ? (
              <Text style={{ ...typeScale.cuerpo, color: c.ink, textAlign: 'center' }}>
                Entrega guardada en el teléfono. Se manda sola cuando haya señal.
              </Text>
            ) : null}
          </View>
          <View style={{ backgroundColor: c.surface, borderRadius: radii.tarjetaGrande, padding: space[5], gap: space[3] }}>
            <Text style={{ ...typeScale.titulo, color: c.text }}>{`${hechas} de ${total} entregadas`}</Text>
            <PuntosDeAvance hechas={hechas} total={total} />
            {siguiente ? (
              <View accessibilityLabel="Próxima parada" style={{ gap: space[1] }}>
                <Text style={{ ...typeScale.etiqueta, color: c.textSecondary, textTransform: 'uppercase' }}>{`Sigue · Parada ${siguiente.numero}`}</Text>
                <Text style={{ ...typeScale.seccion, color: c.text }}>{siguiente.parada.clienteNombre}</Text>
                <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{siguiente.parada.direccion}</Text>
              </View>
            ) : (
              <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>Era la última parada del viaje.</Text>
            )}
          </View>
        </View>
        <View style={{ backgroundColor: c.bg, padding: space[4], paddingBottom: space[4] + bottom }}>
          <View style={columna ?? undefined}>
            <Button size="xl" label={siguiente ? 'Siguiente entrega' : 'Terminé el viaje'} onPress={siguiente ? onSiguiente : onTermine} />
          </View>
        </View>
      </View>
    </Modal>
  )
}

const PUNTO = 16
const MAXIMO_DE_PUNTOS = 16

/**
 * Una entrega por punto: hechas en teal, la que sigue en lime con borde ink y las demás solo con borde ink. Con más
 * de 16 paradas los puntos no entran y queda la barra. La lectura de pantalla sale del rol y el valor, no de los puntos.
 */
function PuntosDeAvance({ hechas, total }: { hechas: number; total: number }) {
  const c = useColors()
  if (total > MAXIMO_DE_PUNTOS) return <Progress value={hechas} max={total} accessibilityLabel="Entregas hechas" />
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Entregas hechas"
      accessibilityValue={{ min: 0, max: total, now: hechas }}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            width: PUNTO,
            height: PUNTO,
            borderRadius: radii.pastilla,
            borderWidth: i < hechas ? 0 : 2,
            borderColor: c.ink,
            backgroundColor: i < hechas ? c.teal : i === hechas ? c.lime : 'transparent',
          }}
        />
      ))}
    </View>
  )
}
