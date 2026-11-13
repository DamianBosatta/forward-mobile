import React from 'react'
import { View } from 'react-native'
import { space } from '@/libs/theme'
import { formatImporte } from '@/core/ui/fw'
import { HeroDeInicio } from './PiezasDeInicio'
import { DeudoresDeInicio } from './DeudoresDeInicio'
import { MosaicoDeInicio } from './MosaicoDeInicio'

interface PulsoProps {
  /** `null` en todos: el servidor todavía no lo da y se muestra "—", nunca 0. */
  ventasDelDia: number | null
  cantidadVentas: number | null
  pedidosPendientes: number | null
  rutasActivas: number | null
  meDeben: number | null
  debo: number | null
  /** Con destino, Rutas activas abre la lista de hojas de ruta; sin él (sin permiso de Viajes) es solo la cifra. */
  onRutas?: () => void
  /** Lo que va entre el hero y Deudores: en tablet, "Nueva venta" (sin barra inferior no hay botón central). */
  children?: React.ReactNode
}

const cantidad = (n: number | null) => (n == null ? '—' : String(n))

/**
 * El pulso del negocio (inicio de administración, dirección A): "Ventas del día" en el hero, la tarjeta
 * Deudores que destaca, lo que me deben y lo que debo, y Pedidos pendientes y Rutas activas.
 * "Nueva venta" ya no vive acá: va al centro de la barra inferior.
 */
export function PulsoDelNegocio({ ventasDelDia, cantidadVentas, pedidosPendientes, rutasActivas, meDeben, debo, onRutas, children }: PulsoProps) {
  const ventas = cantidadVentas == null ? null : `${cantidadVentas} ${cantidadVentas === 1 ? 'venta' : 'ventas'}`
  return (
    <View style={{ gap: space[4], paddingHorizontal: space[4] }}>
      <HeroDeInicio testID="pulso-hero" etiqueta="Ventas del día" cifra={formatImporte(ventasDelDia)} meta={ventas} />
      {children}
      <DeudoresDeInicio />
      <View style={{ flexDirection: 'row', gap: space[3] }}>
        <MosaicoDeInicio etiqueta="Me deben los clientes" valor={formatImporte(meDeben)} />
        <MosaicoDeInicio etiqueta="Debo a proveedores" valor={formatImporte(debo)} />
      </View>
      <View style={{ flexDirection: 'row', gap: space[3] }}>
        <MosaicoDeInicio etiqueta="Pedidos pendientes" valor={cantidad(pedidosPendientes)} />
        <MosaicoDeInicio etiqueta="Rutas activas" valor={cantidad(rutasActivas)} onPress={onRutas} />
      </View>
    </View>
  )
}
