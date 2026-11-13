import React from 'react'
import { PreparacionScreen } from '@/features/logistica/picking/PreparacionScreen'
import { useRefrescarAlEnfocar } from '@/core/hooks/useRefrescarAlEnfocar'

/**
 * Preparación de pedidos: el tablero de picking de la web, solo ver (S15). La pantalla misma pide MOD_VIAJES leer y,
 * sin él, muestra el "sin acceso" de la web sin pedir datos.
 */
export default function PreparacionDePedidosRoute() {
  useRefrescarAlEnfocar()
  return <PreparacionScreen />
}
