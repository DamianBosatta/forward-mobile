import React from 'react'
import { Text, View } from 'react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { formatImporte } from '@/core/ui/fw'
import { mostrarNumero } from '@/core/utils/numero'
import type { StockResumen } from '../hooks/useStockPorDeposito'
import { useValorDelStockACosto } from '../hooks/useConsultasDeStock'

export type VistaDeStock = 'tarjetas' | 'lista'

function Total({ label, valor }: { label: string; valor: string }) {
  const c = useColors()
  return (
    <View accessible accessibilityLabel={`${label}: ${valor}`} style={{ flex: 1, minWidth: 0, backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[3], gap: space[1] }}>
      <Text numberOfLines={1} style={[typeScale.secundario, { color: c.textSecondary }]}>{label}</Text>
      <Text style={[typeScale.titulo, importe, { color: c.text }]}>{valor}</Text>
    </View>
  )
}

/** "Valor del stock a costo" del depósito que se mira (web KpiValorCosto): cargando "…", con error "—". */
function ValorACosto({ depositoId }: { depositoId: string }) {
  const { data, isError } = useValorDelStockACosto(depositoId, true)
  const total = data?.total?.valorCosto
  return <Total label="Valor del stock a costo" valor={isError ? '—' : total == null ? '…' : formatImporte(total, { centavos: false })} />
}

interface Props {
  resumen: StockResumen | undefined
  conError: boolean
  vista: VistaDeStock
  /** Con CAP_VER_COSTOS (lo decide el contenedor por capacidad): el valor a costo del depósito elegido. */
  valorCosto: { depositoId: string } | null
}

/**
 * Totales del servidor (web StockResumenKpis), con los mismos filtros que la lista: cuentan la base entera, no la
 * página. Tarjetas: Artículos y En alerta. Lista: Artículos, Con stock, Sin stock y En alerta, más "Valor del stock a
 * costo" solo con el permiso de ver costos. Un conteo que el servidor manda null no se dibuja (un 0 diría "no hay
 * ninguno"); si el resumen falla se avisa, porque mostrar ceros sería un dato falso.
 */
export function TotalesDeStock({ resumen, conError, vista, valorCosto }: Props) {
  const c = useColors()
  if (conError) {
    return (
      <Text accessibilityRole="alert" style={[typeScale.secundario, { color: c.chip.anulado.text, paddingHorizontal: space[4], paddingTop: space[3] }]}>
        No se pudieron cargar los totales del inventario.
      </Text>
    )
  }
  if (!resumen) return <View testID="totales-cargando" style={{ height: 72, marginHorizontal: space[4], marginTop: space[3], borderRadius: radii.tarjeta, backgroundColor: c.surface2 }} />

  const { articulos, conStock, sinStock, enAlerta } = resumen.totales
  const lista = vista === 'lista'
  const totales: { label: string; valor: number }[] = [{ label: 'Artículos', valor: articulos }]
  if (lista && conStock != null) totales.push({ label: 'Con stock', valor: conStock })
  if (lista && sinStock != null) totales.push({ label: 'Sin stock', valor: sinStock })
  if (enAlerta != null) totales.push({ label: 'En alerta', valor: enAlerta })
  const filas: (typeof totales)[] = []
  for (let i = 0; i < totales.length; i += 2) filas.push(totales.slice(i, i + 2))

  return (
    <View style={{ gap: space[2], paddingHorizontal: space[4], paddingTop: space[3] }}>
      {filas.map((fila) => (
        <View key={fila[0].label} style={{ flexDirection: 'row', gap: space[2] }}>
          {fila.map((t) => <Total key={t.label} label={t.label} valor={mostrarNumero(t.valor)} />)}
        </View>
      ))}
      {lista && valorCosto ? <ValorACosto depositoId={valorCosto.depositoId} /> : null}
    </View>
  )
}
