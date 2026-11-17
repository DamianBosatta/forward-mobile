import React from 'react'
import { View } from 'react-native'
import { idDeRuta, useParametrosDeRuta } from '@/core/navigation/parametrosDeRuta'
import { useColors } from '@/libs/theme'
import { FichaCliente } from '@/features/clientes/components/FichaCliente'

/** Ficha de cliente en teléfono; en tablet la misma ficha va en el panel de Clientes. */
export default function FichaClienteScreen() {
  const c = useColors()
  const { id } = useParametrosDeRuta({ id: idDeRuta })

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {id ? <FichaCliente id={id} conBarra /> : null}
    </View>
  )
}
