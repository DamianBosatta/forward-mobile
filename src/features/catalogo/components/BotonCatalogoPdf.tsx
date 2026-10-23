import React, { useState } from 'react'
import { View } from 'react-native'
import { space } from '@/libs/theme'
import { Button, Notice } from '@/core/ui/fw'
import { getCatalogoPdfUrl } from '@/libs/api-client/productos'
import { sharePdf } from '@/features/pedidos/lib/sharePdf'

interface Props {
  busqueda: string
  soloConStock: boolean
  conOferta?: boolean
  categoriaId?: string
}

/** Genera el PDF del catálogo con los filtros que se ven en pantalla y abre el panel de compartir. */
export function BotonCatalogoPdf({ busqueda, soloConStock, conOferta, categoriaId }: Props) {
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const compartir = async () => {
    setGenerando(true)
    setError(null)
    const url = getCatalogoPdfUrl({ search: busqueda, soloDisponibles: soloConStock, conOferta, categoriaId })
    const r = await sharePdf(url, `catalogo-${new Date().toISOString().slice(0, 10)}.pdf`)
    setGenerando(false)
    if (!r.ok) setError(r.message)
  }

  return (
    <View style={{ gap: space[2] }}>
      <Button label="Compartir catálogo en PDF" variant="secundario" loading={generando} onPress={() => { void compartir() }} />
      {error ? <Notice tone="peligro">{error}</Notice> : null}
    </View>
  )
}
