import React from 'react'
import { View } from 'react-native'
import { space, useColors } from '@/libs/theme'
import { CampoBusqueda } from '@/features/catalogo/components/CampoBusqueda'

type Props = React.ComponentProps<typeof CampoBusqueda>

/** El buscador con aire sobre él: sin esto queda pegado al borde de la barra (con el tema oscuro parece cortado). */
export function BusquedaBajoBarra(props: Props) {
  const c = useColors()
  return (
    <View testID="busqueda-bajo-barra" style={{ backgroundColor: c.topBar, paddingTop: space[3] }}>
      <CampoBusqueda {...props} />
    </View>
  )
}
