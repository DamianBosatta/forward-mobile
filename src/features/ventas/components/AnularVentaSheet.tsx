import React from 'react'
import { Text } from 'react-native'
import { typeScale, useColors } from '@/libs/theme'
import { BottomSheet, Button, Notice } from '@/core/ui/fw'

interface Props {
  visible: boolean
  cargando: boolean
  error: string | null
  onClose: () => void
  onConfirmar: () => void
}

/** Anular igual que la web: su confirmación (mismo texto y botones), sin pedir motivo. */
export function AnularVentaSheet({ visible, cargando, error, onClose, onConfirmar }: Props) {
  const c = useColors()
  return (
    <BottomSheet visible={visible} onClose={onClose} accessibilityLabel="Anular venta">
      <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>¿Deseas anular esta venta? Se liberará el stock reservado.</Text>
      {error ? <Notice tone="peligro">{error}</Notice> : null}
      <Button label={cargando ? 'Anulando...' : 'Anular Venta'} variant="peligro" disabled={cargando} onPress={onConfirmar} />
      <Button label="Cancelar" variant="secundario" onPress={onClose} />
    </BottomSheet>
  )
}
