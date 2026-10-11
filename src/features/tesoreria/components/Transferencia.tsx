import React, { useState } from 'react'
import { ActivityIndicator, ScrollView, View } from 'react-native'
import { space, useColors } from '@/libs/theme'
import { Button, Field, FormContainer, Notice } from '@/core/ui/fw'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { leerNumero } from '@/features/venta-nueva/lib/linea'
import { useCuentasPropias } from '@/features/cuentas/api/queries'
import { useRegistrarMovimientoInterno, useTiposMovimientoInterno } from '../api/movimientosInternos'
import { ElegirChip } from '@/features/cuentas/components/ElegirChip'
import { ElegirCuenta } from './ElegirCuenta'

/** Valor de "Hacia" cuando la plata sale del sistema (un retiro): el servidor no recibe destino. */
export const SIN_DESTINO = 'sin-destino'

/**
 * Movimiento entre cuentas propias (lámina Transferencia): tipo del catálogo, desde, hacia, monto
 * y observaciones. Sin destino la plata sale del sistema y hay que decir quién se la lleva.
 */
export function Transferencia({ onListo }: { onListo: () => void }) {
  const c = useColors()
  const tipos = useTiposMovimientoInterno()
  const cuentas = useCuentasPropias()
  const registrar = useRegistrarMovimientoInterno()
  const [tipoId, setTipoId] = useState<string | null>(null)
  const [origen, setOrigen] = useState<string | null>(null)
  const [destino, setDestino] = useState<string | null>(null)
  const [monto, setMonto] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [retira, setRetira] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [hecho, setHecho] = useState(false)

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

  const propias = cuentas.data ?? []
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
        <Field label="Observaciones (opcional)" value={observaciones} onChangeText={setObservaciones} />

        {aviso ? <Notice tone="advertencia">{aviso}</Notice> : null}
        {registrar.error ? <Notice tone="peligro">{mensajeDelServidor(registrar.error, 'No se pudo registrar el movimiento.')}</Notice> : null}
        <Button label="Registrar movimiento" loading={registrar.isPending} disabled={registrar.isPending} onPress={enviar} />
      </FormContainer>
    </ScrollView>
  )
}
