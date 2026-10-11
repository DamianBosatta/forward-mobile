import React, { useEffect, useRef } from 'react'
import { Linking, Modal, StyleSheet, Text, View } from 'react-native'
import { CameraView, useCameraPermissions, type BarcodeScanningResult, type BarcodeType } from 'expo-camera'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, TopBar } from '@/core/ui/fw'

const TIPOS: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'itf14']

interface EscanerCodigoProps {
  visible: boolean
  onClose: () => void
  /** Se llama una sola vez por apertura con el código leído. */
  onLeido: (codigo: string) => void
}

/** Escáner de código de barras a pantalla completa (expo-camera), con el permiso explicado si falta. */
export function EscanerCodigo({ visible, onClose, onLeido }: EscanerCodigoProps) {
  const c = useColors()
  const [permiso, pedirPermiso] = useCameraPermissions()
  // La cámara dispara el evento muchas veces por segundo: solo vale la primera lectura.
  const leido = useRef(false)

  useEffect(() => {
    if (visible) leido.current = false
  }, [visible])

  const alLeer = ({ data }: BarcodeScanningResult) => {
    const codigo = data?.trim()
    if (leido.current || !codigo) return
    leido.current = true
    onLeido(codigo)
  }

  const aviso = (titulo: string, texto: string, boton: React.ReactNode) => (
    <View style={{ flex: 1, justifyContent: 'center', padding: space[6], gap: space[4], backgroundColor: c.bg }}>
      <Text style={[typeScale.seccion, { color: c.text, textAlign: 'center' }]}>{titulo}</Text>
      <Text style={[typeScale.cuerpo, { color: c.textSecondary, textAlign: 'center' }]}>{texto}</Text>
      {boton}
    </View>
  )

  let contenido: React.ReactNode
  if (!permiso) {
    contenido = aviso('Revisando el permiso de la cámara…', '', null)
  } else if (permiso.granted) {
    contenido = (
      <View style={{ flex: 1 }}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          onBarcodeScanned={alLeer}
          barcodeScannerSettings={{ barcodeTypes: TIPOS }}
        />
        <View pointerEvents="none" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 260, height: 160, borderRadius: radii.tarjeta, borderWidth: 2, borderColor: c.brand }} />
          <Text style={[typeScale.cuerpoDestacado, { color: c.onTopBarStrong, marginTop: space[4], backgroundColor: c.topBar, paddingHorizontal: space[3], paddingVertical: space[1], borderRadius: radii.campo }]}>
            Apuntá al código de barras del producto
          </Text>
        </View>
      </View>
    )
  } else if (permiso.canAskAgain) {
    contenido = aviso(
      'Falta el permiso de la cámara',
      'Para leer el código de barras, Forward necesita usar la cámara. No se guarda ninguna foto.',
      <Button label="Permitir la cámara" onPress={() => void pedirPermiso()} />,
    )
  } else {
    contenido = aviso(
      'La cámara está bloqueada para Forward',
      'Se negó el permiso. Habilitalo en la configuración del teléfono, o buscá el producto escribiendo el código.',
      <Button label="Abrir la configuración" onPress={() => void Linking.openSettings()} />,
    )
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar title="Escanear código" leading={{ kind: 'atras', onPress: onClose }} />
        {contenido}
      </View>
    </Modal>
  )
}
