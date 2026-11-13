import React from 'react'
import { useFiltroPersistente } from '@/core/hooks/useFiltroPersistente'
import { View } from 'react-native'
import { useLocalSearchParams, useNavigation } from 'expo-router'
import { DrawerActions } from "expo-router/react-navigation"
import { useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { TopBar } from '@/core/ui/fw'
import { RequirePermission } from '@/core/ui'
import { BusquedaBajoBarra } from '@/features/inventario/components/BusquedaBajoBarra'
import { StockPorDeposito } from '@/features/inventario/components/StockPorDeposito'
import { useRefrescarAlEnfocar } from '@/core/hooks/useRefrescarAlEnfocar'

/** Desde acá las Tarjetas van de a cuatro y la Lista se ve como tabla. */
const ANCHO_TABLET = 600

/** Stock, solo ver, con la estructura de "Inventario & Stock" de la web (S16). Se abre buscando `?busqueda=` si viene de la ficha. */
export default function StockScreen() {
  useRefrescarAlEnfocar()
  const navigation = useNavigation()
  const c = useColors()
  const { width } = useResponsive()
  const { busqueda: inicial } = useLocalSearchParams<{ busqueda?: string }>()
  const [busqueda, setBusqueda] = useFiltroPersistente('stock.busqueda', typeof inicial === 'string' ? inicial : '')

  return (
    <RequirePermission module="MOD_STOCK" action="read" mode="screen">
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar
          title="Stock"
          subtitle="Solo consulta"
          leading={{ kind: 'menu', onPress: () => navigation.dispatch(DrawerActions.openDrawer()) }}
        />
        <BusquedaBajoBarra value={busqueda} onChangeText={setBusqueda} />
        <StockPorDeposito busqueda={busqueda} tablet={width >= ANCHO_TABLET} />
      </View>
    </RequirePermission>
  )
}
