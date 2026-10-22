import React, { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { BottomSheet, Button, Field, Notice } from '@/core/ui/fw'
import { MOTIVO_ANULACION_OTRO, MOTIVOS_DE_ANULACION, motivoDeAnulacion } from '../lib/accionesVenta'

interface Props {
  visible: boolean
  /** Un presupuesto no reserva stock: el aviso del stock es solo del pedido. */
  esPresupuesto: boolean
  cargando: boolean
  error: string | null
  onClose: () => void
  onConfirmar: (motivo: string) => void
}

/** Anular con motivo obligatorio (lámina ResAnular, S6): el motivo lo guarda el servidor con la anulación. */
export function AnularVentaSheet({ visible, esPresupuesto, cargando, error, onClose, onConfirmar }: Props) {
  const c = useColors()
  const [elegido, setElegido] = useState<string | null>(null)
  const [otro, setOtro] = useState('')
  const tipo = esPresupuesto ? 'presupuesto' : 'pedido'
  const motivo = motivoDeAnulacion(elegido, otro)
  const opciones = [...MOTIVOS_DE_ANULACION, MOTIVO_ANULACION_OTRO]
  const aviso = { ...typeScale.secundario, color: c.textSecondary }

  return (
    <BottomSheet visible={visible} onClose={onClose} accessibilityLabel={`Anular ${tipo}`}>
      <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>{`¿Anular el ${tipo}?`}</Text>
      {esPresupuesto ? null : <Text style={aviso}>Se libera el stock que tenía reservado.</Text>}
      <Text style={aviso}>Si ya tenía factura, gestión la cancela o emite la nota de crédito.</Text>
      <Text style={aviso}>{`No se puede deshacer. Un pedido en ruta no se puede anular.`}</Text>
      <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>¿Por qué? (obligatorio)</Text>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        {opciones.map((o) => {
          const sel = o === elegido
          return (
            <Pressable
              key={o}
              accessibilityRole="radio"
              accessibilityLabel={o}
              accessibilityState={{ selected: sel }}
              onPress={() => setElegido(o)}
              style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: space[4], borderRadius: radii.pastilla, borderWidth: 1, borderColor: sel ? c.brand : c.border, backgroundColor: sel ? c.brandSoft : c.surface }}
            >
              <Text style={{ ...typeScale.secundario, color: sel ? c.brandInk : c.text }}>{o}</Text>
            </Pressable>
          )
        })}
      </View>
      {elegido === MOTIVO_ANULACION_OTRO ? <Field label="Contanos el motivo" value={otro} onChangeText={setOtro} multiline /> : null}
      {error ? <Notice tone="peligro">{error}</Notice> : null}
      <Button label={`Anular ${tipo}`} variant="peligro" disabled={!motivo} loading={cargando} onPress={() => motivo && onConfirmar(motivo)} />
      <Button label="No, volver" variant="secundario" onPress={onClose} />
    </BottomSheet>
  )
}
