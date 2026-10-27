import React, { useState } from 'react'
import { View } from 'react-native'
import { useLocalSearchParams, useNavigation } from 'expo-router'
import { DrawerActions } from '@react-navigation/native'
import { useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { TopBar } from '@/core/ui/fw'
import { RequirePermission } from '@/core/ui'
import { CampoBusqueda } from '@/features/catalogo/components/CampoBusqueda'
import { StockPorDeposito } from '@/features/inventario/components/StockPorDeposito'

/** Desde acá el stock se ve como tabla (lámina TabStock). */
const ANCHO_TABLET = 600

/** Stock por depósito, solo consulta (láminas ModStock y TabStock). Se abre buscando `?busqueda=` si viene de la ficha. */
export default function StockScreen() {
  const navigation = useNavigation()
  const c = useColors()
  const { width } = useResponsive()
  const { busqueda: inicial } = useLocalSearchParams<{ busqueda?: string }>()
  const [busqueda, setBusqueda] = useState(typeof inicial === 'string' ? inicial : '')

  return (
    <RequirePermission module="MOD_STOCK" action="read" mode="screen">
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar
          title="Stock"
          subtitle="Solo consulta"
          leading={{ kind: 'menu', onPress: () => navigation.dispatch(DrawerActions.openDrawer()) }}
        />
        <CampoBusqueda value={busqueda} onChangeText={setBusqueda} />
        <StockPorDeposito busqueda={busqueda} tablet={width >= ANCHO_TABLET} />
      </View>
    </RequirePermission>
  )
}
