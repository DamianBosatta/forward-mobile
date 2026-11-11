import React from 'react'
import { View } from 'react-native'
import { radii, space } from '@/libs/theme'
import { formatImporte } from '@/core/ui/fw'
import { HeroSaldo } from '@/features/clientes/components/SaldoDelCliente'
import { Esqueletos } from '@/features/clientes/components/Esqueletos'

interface Props {
  /** Suma de todo el filtro que da el servidor (solo en la página 1); sin ella no hay resumen: no se suma en el teléfono. */
  saldoTotal?: number
  /** Clientes con deuda (`GET /deudas/resumen`, MOD_PAGOS:Read); sin el dato (sin permiso o cargando) no se muestra la línea. */
  clientesConDeuda?: number
  /** Mientras carga la cartera, el lugar del hero lo ocupa un esqueleto (frame 4). */
  cargando?: boolean
}

/** Alto del esqueleto del hero "Te deben" (frame 4). */
const ALTO_HERO = 116

/**
 * Hero "Te deben" de Cuentas (propuesta "Finanzas como venta", frame 1): la cifra grande sobre fondo oscuro y
 * "N clientes con deuda" debajo. La transferencia entre cuentas propias vive en la barra superior.
 * TODO API: total vencido agregado de la cartera (chip "Vencido $ X"); hoy el servidor no lo informa y no se suma en el teléfono.
 */
export function ResumenDeCuentas({ saldoTotal, clientesConDeuda, cargando = false }: Props) {
  if (saldoTotal === undefined) {
    return cargando ? (
      <View style={{ marginHorizontal: space[4], marginTop: space[3] }}>
        <Esqueletos bloques={[{ alto: ALTO_HERO, radio: radii.hoja, testID: 'esqueleto-hero' }]} />
      </View>
    ) : null
  }
  const clientes = clientesConDeuda === undefined ? undefined : `${clientesConDeuda} ${clientesConDeuda === 1 ? 'cliente con deuda' : 'clientes con deuda'}`
  return (
    <View style={{ marginHorizontal: space[4], marginTop: space[3] }}>
      <HeroSaldo
        titulo="Te deben"
        saldo={saldoTotal}
        meta={clientes}
        vencido={null}
        tope={null}
        disponible={null}
        accessibilityLabel={`Te deben: ${formatImporte(saldoTotal)}${clientes ? `, ${clientes}` : ''}`}
      />
    </View>
  )
}
