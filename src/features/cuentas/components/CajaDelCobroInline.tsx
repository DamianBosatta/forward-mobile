import React from 'react'
import { ActivityIndicator, Text } from 'react-native'
import { typeScale, useColors } from '@/libs/theme'
import { Button, Notice } from '@/core/ui/fw'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import type { CajaDelCobro } from '../api/cobros'

export const SIN_CAJA_ABIERTA = 'No hay una caja abierta en este depósito. Abrí una caja para registrar cobros en efectivo.'

/**
 * Dónde entra el efectivo, como `DepositoTrabajoInline` de la web: el depósito de la sesión como texto, sin selector
 * (se cambia en Inicio). Sin su caja abierta lo avisa; si no se pudo saber, lo dice con Reintentar.
 */
export function CajaDelCobroInline({ caja: { nombre, caja } }: { caja: CajaDelCobro }) {
  const c = useColors()
  if (caja.isLoading) return <ActivityIndicator color={c.brandInk} />
  if (caja.error) {
    return (
      <>
        <Notice tone="peligro">{mensajeDelServidor(caja.error, 'No se pudo saber si la caja está abierta.')}</Notice>
        <Button label="Reintentar" variant="secundario" onPress={() => { void caja.refetch() }} />
      </>
    )
  }
  if (!caja.isSuccess) return null
  return (
    <>
      <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
        Se registra en <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{nombre ?? 'tu depósito'}</Text>
      </Text>
      {caja.data?.abierta ? null : <Notice tone="advertencia">{SIN_CAJA_ABIERTA}</Notice>}
    </>
  )
}
