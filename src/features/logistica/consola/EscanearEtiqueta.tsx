import React, { useRef, useState } from 'react'
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { CircleCheck, X, Zap, ZapOff } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, Notice } from '@/core/ui/fw'
import { safeHaptics } from '@/core/utils/haptics'
import { leerEtiqueta, tituloPieza } from './piezasParada'

interface Props {
  visible: boolean
  etiquetas: string[]
  marcadas: ReadonlySet<number>
  /** Una pieza se leyó por primera vez. */
  onLeida: (indice: number) => void
  onCerrar: () => void
}

/** Pausa entre lecturas: la cámara repite el mismo código varias veces por segundo. */
const DEBOUNCE_MS = 1500

/**
 * Lámina chofer-02-llegue--escaneo: cámara arriba y la lista de verificación abajo. Escanear es opcional:
 * la lectura tilda la pieza sola, nunca se tipea. Permiso denegado: mensaje y se vuelve a la lista manual.
 */
export function EscanearEtiqueta({ visible, etiquetas, marcadas, onLeida, onCerrar }: Props) {
  const c = useColors()
  const { top, bottom } = useSafeAreaInsets()
  const [permiso, pedirPermiso] = useCameraPermissions()
  const [flash, setFlash] = useState(false)
  const [mensaje, setMensaje] = useState<{ tono: 'exito' | 'advertencia' | 'peligro'; texto: string } | null>(null)
  const ultima = useRef(0)
  const claro = c.onTopBarStrong

  const alLeer = ({ data }: { data: string }) => {
    const ahora = Date.now()
    if (ahora - ultima.current < DEBOUNCE_MS) return
    ultima.current = ahora
    const lectura = leerEtiqueta(etiquetas, marcadas, data)
    if (lectura.tipo === 'ajena') {
      safeHaptics.notification('error')
      setMensaje({ tono: 'peligro', texto: 'Esa etiqueta no es de este cliente.' })
      return
    }
    const titulo = tituloPieza(lectura.indice, etiquetas.length, etiquetas[lectura.indice])
    if (lectura.tipo === 'repetida') {
      setMensaje({ tono: 'advertencia', texto: `${titulo} ya estaba marcada.` })
      return
    }
    safeHaptics.notification('success')
    setMensaje({ tono: 'exito', texto: titulo })
    onLeida(lectura.indice)
  }

  const sinPermiso = !permiso?.granted
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <View accessibilityLabel="Escanear etiqueta" style={{ flex: 1, backgroundColor: c.bg, paddingTop: top }}>
        <View style={{ height: 290, backgroundColor: c.topBar }}>
          {!sinPermiso ? (
            <CameraView style={StyleSheet.absoluteFill} facing="back" flash={flash ? 'on' : 'off'} barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'ean13'] }} onBarcodeScanned={alLeer} />
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', padding: space[6], gap: space[3] }}>
              <Text style={{ ...typeScale.seccion, color: claro, textAlign: 'center' }}>
                {permiso && !permiso.canAskAgain ? 'La cámara está bloqueada para Forward' : 'Falta el permiso de la cámara'}
              </Text>
              {permiso && !permiso.canAskAgain ? (
                <Button label="Abrir la configuración" onPress={() => void Linking.openSettings()} />
              ) : (
                <Button label="Permitir la cámara" onPress={() => void pedirPermiso()} />
              )}
              <Text style={{ ...typeScale.secundario, color: claro, textAlign: 'center' }}>Podés tildar las piezas a mano en la lista.</Text>
            </View>
          )}
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar el escáner" onPress={onCerrar} style={[estilos.boton, { left: space[2], top: space[2] }]}>
            <X size={24} color={claro} />
          </Pressable>
          {!sinPermiso ? (
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel={flash ? 'Apagar el flash' : 'Encender el flash'}
              accessibilityState={{ checked: flash }}
              onPress={() => setFlash((f) => !f)}
              style={[estilos.boton, { right: space[2], top: space[2] }]}
            >
              {flash ? <Zap size={22} color={claro} /> : <ZapOff size={22} color={claro} />}
            </Pressable>
          ) : null}
        </View>
        <View style={{ padding: space[4], gap: space[3], flex: 1 }}>
          {mensaje ? <Notice tone={mensaje.tono}>{mensaje.texto}</Notice> : <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>Apuntá a la etiqueta de la pieza.</Text>}
          <View style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, borderWidth: 1, borderColor: c.border }}>
            {etiquetas.map((e, i) => {
              const hecha = marcadas.has(i)
              return (
                <View key={e} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 44, padding: space[3] }}>
                  {hecha ? <CircleCheck size={24} color={c.success} /> : <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: c.textSecondary }} />}
                  <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{`${tituloPieza(i, etiquetas.length, e)}${hecha ? ' · marcada' : ''}`}</Text>
                </View>
              )
            })}
          </View>
        </View>
        <View style={{ padding: space[4], paddingBottom: space[4] + bottom, borderTopWidth: 1, borderTopColor: c.border }}>
          <Button size="xl" label="Listo" onPress={onCerrar} />
        </View>
      </View>
    </Modal>
  )
}

const estilos = StyleSheet.create({
  boton: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
})
