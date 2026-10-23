import React, { useState } from 'react'
import { Pressable, ScrollView, Text } from 'react-native'
import { FONT, space, typeScale, useColors } from '@/libs/theme'
import { BottomSheet } from '@/core/ui/fw'
import { FiltroChip } from '@/core/ui/fw/FiltroChip'
import { useCategorias } from '@/libs/api-client/categorias'
import { opcionesLineaFamilia } from '../lib/categorias'

interface Props {
  /** Línea o Familia elegida; `undefined` = todas. */
  categoriaId: string | undefined
  onChange: (categoriaId: string | undefined) => void
}

/** Chip "Línea / Familia" que abre una hoja con las Líneas y sus Familias (GET /Categorias). */
export function SelectorLineaFamilia({ categoriaId, onChange }: Props) {
  const c = useColors()
  const [abierto, setAbierto] = useState(false)
  const { data } = useCategorias()
  const opciones = opcionesLineaFamilia(data)
  const elegida = opciones.find((o) => o.id === categoriaId)
  const elegir = (id: string | undefined) => { onChange(id); setAbierto(false) }

  const fila = (id: string | undefined, nombre: string, nivel: 1 | 2) => (
    <Pressable
      key={id ?? 'todas'}
      accessibilityRole="button"
      accessibilityLabel={nombre}
      accessibilityState={{ selected: id === categoriaId }}
      onPress={() => elegir(id)}
      style={{ minHeight: 44, justifyContent: 'center', paddingLeft: nivel === 2 ? space[6] : 0 }}
    >
      <Text style={[typeScale.cuerpo, { color: id === categoriaId ? c.brandInk : c.text, fontFamily: nivel === 1 ? FONT.semibold : undefined }]}>
        {nombre}
      </Text>
    </Pressable>
  )

  return (
    <>
      <FiltroChip
        label={elegida ? `Línea / Familia: ${elegida.nombre}` : 'Línea / Familia'}
        activo={elegida !== undefined}
        onPress={() => setAbierto(true)}
      />
      <BottomSheet visible={abierto} onClose={() => setAbierto(false)} accessibilityLabel="Elegir línea o familia">
        <ScrollView style={{ maxHeight: 420 }}>
          {fila(undefined, 'Todas', 1)}
          {opciones.map((o) => fila(o.id, o.nombre, o.nivel))}
        </ScrollView>
      </BottomSheet>
    </>
  )
}
