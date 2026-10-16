import React from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { Field, Notice } from '@/core/ui/fw'
import type { LineaParada } from '@/libs/api-client/logistica'

interface Props {
  renglones: LineaParada[] | undefined
  cargando: boolean
  conError: boolean
  /** Cantidad devuelta por renglón (`ventaDetalleId` → texto del campo). */
  valores: Record<string, string>
  onCambio: (ventaDetalleId: string, valor: string) => void
}

/** Lo que el cliente devuelve en el momento. Queda Solicitada: el depósito la autoriza después. */
export function DevolucionEnEntrega({ renglones, cargando, conError, valores, onCambio }: Props) {
  const c = useColors()
  const disponibles = (renglones ?? []).filter((r) => (r.cantidadDisponible ?? 0) > 0)
  return (
    <View accessibilityLabel="Devolución" style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[4], gap: space[3] }}>
      <Text style={{ ...typeScale.seccion, color: c.text }}>Devuelve mercadería</Text>
      <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Dejalo vacío si no devuelve nada. La devolución la autoriza el depósito.</Text>
      {cargando ? <ActivityIndicator color={c.brand} accessibilityLabel="Cargando los productos del pedido" /> : null}
      {conError ? <Notice tone="peligro">No se pudieron cargar los productos del pedido.</Notice> : null}
      {disponibles.map((r) => (
        <Field
          key={r.ventaDetalleId}
          label={`Devuelve: ${r.productoNombre ?? 'Producto'}`}
          help={`Hasta ${r.cantidadDisponible}`}
          value={valores[r.ventaDetalleId ?? ''] ?? ''}
          onChangeText={(v) => onCambio(r.ventaDetalleId ?? '', v)}
          keyboardType="decimal-pad"
          alignRight
        />
      ))}
    </View>
  )
}
