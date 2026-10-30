import React, { useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { space, typeScale, useColors } from '@/libs/theme'
import { Button, Segmented, TopBar } from '@/core/ui/fw'
import { useUltimoPedido } from '../hooks/useUltimoPedido'
import { direccionDeEntrega } from '@/features/clientes/lib/cliente'
import type { TipoDocumento } from '@/features/clientes/components/SeleccionarClienteSheet'
import type { ClienteElegido } from '@/features/clientes/lib/recientes'
import { ElegirClienteVenta } from './ElegirClienteVenta'
import { PasosVenta } from './PasosVenta'

interface Props {
  /** La ficha del cliente que vino por `?clienteId=` todavía se está trayendo. */
  cargandoCliente?: boolean
  tipo: TipoDocumento
  onTipo: (t: TipoDocumento) => void
  /** "Continuar a productos" arranca la venta: crea el borrador y abre el catálogo (con `delUltimo`, ya filtrado). */
  onElegir: (c: ClienteElegido, opciones?: { delUltimo?: boolean }) => void
  onNuevoCliente: () => void
  onVolver: () => void
}

const TIPOS = [
  { value: 'Pedido' as const, label: 'Pedido' },
  { value: 'Presupuesto' as const, label: 'Presupuesto' },
]

/**
 * Paso 1 de la venta nueva: "¿A quién le vendés?". No se ve el catálogo hasta elegir el cliente (la forma de
 * arrancar ya no existe). El tipo (Pedido o Presupuesto) se elige acá porque el borrador nace con él.
 */
export function NuevaVentaInicio({ cargandoCliente, tipo, onTipo, onElegir, onNuevoCliente, onVolver }: Props) {
  const c = useColors()
  const [elegido, setElegido] = useState<ClienteElegido | null>(null)
  const { ultimo } = useUltimoPedido(elegido?.id)
  if (cargandoCliente) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar title="Nueva venta" leading={{ kind: 'atras', onPress: onVolver }} />
        <ActivityIndicator color={c.brand} style={{ margin: space[4] }} />
      </View>
    )
  }
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Nueva venta" subtitle="Paso 1 de 3" leading={{ kind: 'atras', onPress: onVolver }} />
      <PasosVenta paso={1} />
      <View style={{ paddingHorizontal: space[4], paddingTop: space[3], gap: space[2] }}>
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Elegí el cliente para ver sus precios y el stock.</Text>
        <Segmented options={TIPOS} value={tipo} onChange={onTipo} accessibilityLabel="Tipo de venta" />
      </View>
      <ElegirClienteVenta onElegir={setElegido} onNuevoCliente={onNuevoCliente} seleccionadoId={elegido?.id} ultimoPedido={ultimo ? { fecha: ultimo.fecha, total: ultimo.totalAmount } : null} />
      <View style={{ padding: space[4], gap: space[2], borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface }}>
        <Button label="Continuar a productos" disabled={!elegido} onPress={() => elegido && onElegir(elegido)}
          accessibilityLabel={elegido ? `Continuar a productos con ${direccionDeEntrega(elegido)}` : 'Continuar a productos'} />
        {elegido && ultimo ? <Button variant="secundario" label="Repetir el último pedido" onPress={() => onElegir(elegido, { delUltimo: true })} /> : null}
      </View>
    </View>
  )
}
