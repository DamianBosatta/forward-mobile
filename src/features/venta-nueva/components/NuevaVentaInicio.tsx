import React from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { space, typeScale, useColors } from '@/libs/theme'
import { Segmented, TopBar } from '@/core/ui/fw'
import type { TipoDocumento } from '@/features/clientes/components/SeleccionarClienteSheet'
import type { ClienteElegido } from '@/features/clientes/lib/recientes'
import { ElegirClienteVenta } from './ElegirClienteVenta'
import { PasosVenta } from './PasosVenta'

interface Props {
  /** La ficha del cliente que vino por `?clienteId=` todavía se está trayendo. */
  cargandoCliente?: boolean
  tipo: TipoDocumento
  onTipo: (t: TipoDocumento) => void
  /** Elegir el cliente arranca la venta: crea el borrador y abre el catálogo. */
  onElegir: (c: ClienteElegido) => void
  onNuevoCliente: () => void
  onVolver: () => void
}

const TIPOS = [
  { value: 'Presupuesto' as const, label: 'Presupuesto' },
  { value: 'Pedido' as const, label: 'Pedido' },
]

/**
 * Paso 1 de la venta nueva: "¿A quién le vendés?". No se ve el catálogo hasta elegir el cliente (la forma de
 * arrancar ya no existe). El tipo (Pedido o Presupuesto) se elige acá porque el borrador nace con él.
 */
export function NuevaVentaInicio({ cargandoCliente, tipo, onTipo, onElegir, onNuevoCliente, onVolver }: Props) {
  const c = useColors()
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
      <TopBar title="¿A quién le vendés?" leading={{ kind: 'atras', onPress: onVolver }} />
      <PasosVenta paso={1} />
      <View style={{ paddingHorizontal: space[4], paddingTop: space[3], gap: space[2] }}>
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Elegí el cliente para ver sus precios y el stock.</Text>
        <Segmented options={TIPOS} value={tipo} onChange={onTipo} accessibilityLabel="Tipo de venta" />
      </View>
      <ElegirClienteVenta onElegir={onElegir} onNuevoCliente={onNuevoCliente} />
    </View>
  )
}
