import React from 'react'
import { RequirePermission } from '@/core/ui'
import { HojasDeRutaScreen } from '@/features/logistica/components/HojasDeRutaScreen'
import { useRefrescarAlEnfocar } from '@/core/hooks/useRefrescarAlEnfocar'

/** Hojas de ruta de toda la empresa (destino del cuadro "Rutas activas" de Inicio). Mismo permiso que la consola: MOD_VIAJES leer. */
export default function HojasDeRutaRoute() {
  useRefrescarAlEnfocar()
  return (
    <RequirePermission module="MOD_VIAJES" action="read" mode="screen">
      <HojasDeRutaScreen />
    </RequirePermission>
  )
}
