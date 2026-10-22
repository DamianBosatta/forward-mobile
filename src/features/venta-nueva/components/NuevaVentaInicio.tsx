import React from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { space, typeScale, useColors } from '@/libs/theme'
import { TopBar } from '@/core/ui/fw'
import { useResponsive } from '@/libs/useResponsive'
import type { Venta } from '@/libs/api-client/types'
import type { TipoDocumento } from '@/features/clientes/components/SeleccionarClienteSheet'
import type { ClienteElegido } from '@/features/clientes/lib/recientes'
import { ArranqueVenta, type ViaDeArranque } from './ArranqueVenta'
import { ElegirClienteVenta } from './ElegirClienteVenta'

interface Props {
  elegido: ClienteElegido | null
  /** La ficha del cliente que vino por `?clienteId=` todavía se está trayendo. */
  cargandoCliente?: boolean
  tipo: TipoDocumento
  onElegir: (c: ClienteElegido | null) => void
  onTipo: (t: TipoDocumento) => void
  onArrancar: (via: ViaDeArranque, ultimo?: Venta) => void
  onNuevoCliente: () => void
  onVolver: () => void
}

/**
 * Antes de la venta: V2 elegir cliente y V3 cómo arrancar. Teléfono: dos pasos (el segundo vuelve al primero con
 * la flecha). Tablet horizontal (TV2): la lista a la izquierda y, a la derecha, el cliente abierto con las formas
 * de arrancar.
 */
export function NuevaVentaInicio({ elegido, cargandoCliente, tipo, onElegir, onTipo, onArrancar, onNuevoCliente, onVolver }: Props) {
  const c = useColors()
  const { isTabletLandscape } = useResponsive()
  const arranque = elegido ? <ArranqueVenta key={elegido.id} cliente={elegido} tipo={tipo} onTipo={onTipo} onArrancar={onArrancar} /> : null

  if (cargandoCliente) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar title="Nueva venta" leading={{ kind: 'atras', onPress: onVolver }} />
        <ActivityIndicator color={c.brand} style={{ margin: space[4] }} />
      </View>
    )
  }

  if (isTabletLandscape) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar title="¿A quién le vendés?" leading={{ kind: 'atras', onPress: onVolver }} />
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={{ width: 380, borderRightWidth: 1, borderRightColor: c.border }}>
            <ElegirClienteVenta onElegir={onElegir} onNuevoCliente={onNuevoCliente} seleccionadoId={elegido?.id} />
          </View>
          <View style={{ flex: 1 }}>
            {arranque ?? <Text style={{ ...typeScale.cuerpo, color: c.textSecondary, padding: space[6] }}>Elegí un cliente para empezar la venta.</Text>}
          </View>
        </View>
      </View>
    )
  }

  if (!elegido) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar title="¿A quién le vendés?" leading={{ kind: 'atras', onPress: onVolver }} />
        <ElegirClienteVenta onElegir={onElegir} onNuevoCliente={onNuevoCliente} />
      </View>
    )
  }
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Nueva venta" leading={{ kind: 'atras', onPress: () => onElegir(null) }} />
      {arranque}
    </View>
  )
}
