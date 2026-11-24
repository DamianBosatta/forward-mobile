import React from 'react'
import { useFiltroPersistente } from '@/core/hooks/useFiltroPersistente'
import { View } from 'react-native'
import { textoDeRuta, useParametrosDeRuta } from '@/core/navigation/parametrosDeRuta'
import { useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { TopBar, useMenuLeading } from '@/core/ui/fw'
import { RequirePermission } from '@/core/ui'
import { BusquedaBajoBarra } from '@/features/inventario/components/BusquedaBajoBarra'
import { StockPorDeposito } from '@/features/inventario/components/StockPorDeposito'
import { useRefrescarAlEnfocar } from '@/core/hooks/useRefrescarAlEnfocar'

/** Desde acá las Tarjetas van de a cuatro y la Lista se ve como tabla. */
const ANCHO_TABLET = 600

/** Stock, solo ver, con la estructura de "Inventario & Stock" de la web (S16). Se abre buscando `?busqueda=` si viene de la ficha. */
export default function StockScreen() {
  useRefrescarAlEnfocar()
  const menu = useMenuLeading()
  const c = useColors()
  const { width } = useResponsive()
  const { busqueda: inicial } = useParametrosDeRuta({ busqueda: textoDeRuta(100) })
  const [busqueda, setBusqueda] = useFiltroPersistente('stock.busqueda', inicial ?? '')

  return (
    <RequirePermission module="MOD_STOCK" action="read" mode="screen">
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar
          title="Stock"
          subtitle="Solo consulta"
          leading={menu}
        />
        <BusquedaBajoBarra value={busqueda} onChangeText={setBusqueda} />
        <StockPorDeposito busqueda={busqueda} tablet={width >= ANCHO_TABLET} />
      </View>
    </RequirePermission>
  )
}
