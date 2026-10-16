import React, { useState } from 'react'
import { ActivityIndicator, ScrollView, View } from 'react-native'
import { useDebouncedValue } from '@/core/hooks/useDebouncedValue'
import { space, useColors } from '@/libs/theme'
import { Button, Field, FormContainer, Notice, formatImporte } from '@/core/ui/fw'
import { usePermissions } from '@/core/auth/RequirePermission'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { leerNumero } from '@/features/venta-nueva/lib/linea'
import { useCuentasPropias, type CuentaParaCobrar } from '@/features/cuentas/api/cobros'
import { useRegistrarMovimientoInterno, useSaldoRestante, useTiposMovimientoInterno, type SaldoRestante } from '../api/movimientosInternos'
import { ElegirChip } from '@/features/cuentas/components/ElegirChip'
import { ElegirCuenta } from './ElegirCuenta'

/** Valor de "Hacia" cuando la plata sale del sistema (un retiro): el servidor no recibe destino. */
export const SIN_DESTINO = 'sin-destino'

/** Espera antes de preguntar el saldo que queda, para no pedirlo con cada tecla del monto. */
const ESPERA_SALDO_MS = 400

/**
 * Movimiento entre cuentas propias (lámina Transferencia): tipo del catálogo, desde, hacia, monto
 * y observaciones. Sin destino la plata sale del sistema y hay que decir quién se la lleva.
 * Las cuentas salen de la lista liviana (`propias/para-cobrar`, sin saldos; con un servidor anterior,
 * de `propias` con su saldo) y lo que queda en la de origen lo calcula el servidor (`saldo-restante`).
 */
export function Transferencia({ onListo }: { onListo: () => void }) {
  const c = useColors()
  const tipos = useTiposMovimientoInterno()
  const { canRead, canDo } = usePermissions()
  const cuentas = useCuentasPropias(canDo('MOD_PAGOS', 'create'), canRead('MOD_CC'))
  const registrar = useRegistrarMovimientoInterno()
  const [tipoId, setTipoId] = useState<string | null>(null)
  const [origen, setOrigen] = useState<string | null>(null)
  const [destino, setDestino] = useState<string | null>(null)
  const [monto, setMonto] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [retira, setRetira] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [hecho, setHecho] = useState(false)
  const montoConsultado = useDebouncedValue(leerNumero(monto), ESPERA_SALDO_MS)
  const restante = useSaldoRestante(origen, montoConsultado, canRead('MOD_CC'))

  if (hecho) {
    return (
      <View style={{ padding: space[4], gap: space[4] }}>
        <Notice tone="exito" title="Movimiento registrado">Los saldos de las cuentas ya están actualizados.</Notice>
        <Button label="Volver" onPress={onListo} />
      </View>
    )
  }

  const enviar = () => {
    if (registrar.isPending) return
    const n = leerNumero(monto)
    const falta =
      !tipoId ? 'Elegí el tipo de movimiento.'
      : !origen ? 'Elegí la cuenta de origen.'
      : !destino ? 'Elegí la cuenta de destino (o que la plata sale).'
      : n === null || n <= 0 ? 'Ingresá el monto.'
      : destino === SIN_DESTINO && !retira.trim() ? 'Decí quién se lleva la plata.'
      : null
    setAviso(falta)
    if (falta || !tipoId || !origen || n === null) return
    const sale = destino === SIN_DESTINO
    registrar.mutate(
      {
        tipoMovimientoInternoId: tipoId,
        cuentaOrigenId: origen,
        cuentaDestinoId: sale ? null : destino,
        monto: n,
        observaciones: observaciones.trim() || null,
        retiradoPorNombre: sale ? retira.trim() : null,
      },
      { onSuccess: () => setHecho(true) },
    )
  }

  // El servidor no acepta la cartera de cheques ni la caja de efectivo en una transferencia
  // (useCuentasPropias ya las saca).
  const propias: CuentaParaCobrar[] = cuentas.data ?? []
  const nombreOrigen = propias.find(k => k.id === origen)?.nombre
  return (
    <ScrollView contentContainerStyle={{ padding: space[4] }}>
      <FormContainer style={{ gap: space[4] }}>
        {tipos.isLoading || cuentas.isLoading ? <ActivityIndicator color={c.brandInk} /> : null}
        {tipos.error ? <Notice tone="peligro">{mensajeDelServidor(tipos.error, 'No se pudieron cargar los tipos.')}</Notice> : null}
        {cuentas.error ? <Notice tone="peligro">{mensajeDelServidor(cuentas.error, 'No se pudieron cargar las cuentas.')}</Notice> : null}

        <ElegirChip
          titulo="Tipo"
          opciones={(tipos.data ?? []).filter(t => t.activo && t.id).map(t => ({ id: t.id!, label: t.nombre ?? '' }))}
          valor={tipoId}
          onCambio={setTipoId}
        />

        <ElegirCuenta titulo="Desde" cuentas={propias} valor={origen} onCambio={id => { setOrigen(id); if (id === destino) setDestino(null) }} />
        <ElegirCuenta
          titulo="Hacia"
          cuentas={propias.filter(k => k.id !== origen)}
          valor={destino}
          onCambio={setDestino}
          extra={{ valor: SIN_DESTINO, label: 'Ninguna: la plata sale (retiro)' }}
        />
        {destino === SIN_DESTINO ? <Field label="Quién se la lleva" value={retira} onChangeText={setRetira} /> : null}

        <Field label="Monto" value={monto} onChangeText={setMonto} keyboardType="decimal-pad" alignRight />
        {restante.data && nombreOrigen && restante.data.monto === leerNumero(monto) ? <SaldoQueQueda saldo={restante.data} cuenta={nombreOrigen} /> : null}
        <Field label="Observaciones (opcional)" value={observaciones} onChangeText={setObservaciones} />

        {aviso ? <Notice tone="advertencia">{aviso}</Notice> : null}
        {registrar.error ? <Notice tone="peligro">{mensajeDelServidor(registrar.error, 'No se pudo registrar el movimiento.')}</Notice> : null}
        <Button label="Registrar movimiento" loading={registrar.isPending} disabled={registrar.isPending} onPress={enviar} />
      </FormContainer>
    </ScrollView>
  )
}

/** "Te quedan $ X en la caja", o el aviso si la cuenta queda en negativo. */
function SaldoQueQueda({ saldo, cuenta }: { saldo: SaldoRestante; cuenta: string }) {
  const importe = formatImporte(saldo.saldoRestante, { moneda: saldo.moneda })
  return saldo.saldoRestante < 0
    ? <Notice tone="advertencia">{`${cuenta} queda en ${importe}.`}</Notice>
    : <Notice tone="info">{`Te quedan ${importe} en ${cuenta}.`}</Notice>
}
