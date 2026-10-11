import React, { useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { space, typeScale, useColors } from '@/libs/theme'
import { Button, Field, FormContainer, Notice, TotalsRow, formatImporte } from '@/core/ui/fw'
import { useSocio } from '@/libs/api-client/socios'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { direccionDeEntrega, nombreDelCliente } from '@/features/clientes/lib/cliente'
import { diaArgentina } from '@/src/utils/date'
import { useEstadoCuentaSocio } from '../api/queries'
import { useMediosDeCobro, useRegistrarCobro } from '../api/cobros'
import { armarCobro, mostrarFecha, type FormCobro } from '../lib/cobro'
import { leerNumero } from '@/features/venta-nueva/lib/linea'
import { CobroListo } from './CobroListo'
import { ElegirChip } from './ElegirChip'

export const AVISO_IMPUTACION =
  'Imputación automática: el servidor lo aplica a la deuda más vieja y te dice en qué cuenta (TST o Normal) quedó.'

const hoy = () => mostrarFecha(diaArgentina(Date.now()))
const formVacio = (): FormCobro => ({
  monto: '',
  medioPagoId: null,
  esCheque: false,
  referencia: '',
  cheque: { numero: '', banco: '', titular: '', emision: hoy(), pago: hoy() },
})

/** Registrar un cobro (láminas Cobro y CobroListo). La cuenta TST / Normal la elige el servidor. */
export function RegistrarCobro({ socioId, onVolver }: { socioId: string; onVolver: () => void }) {
  const c = useColors()
  const socio = useSocio(socioId)
  const estado = useEstadoCuentaSocio(socioId, !!socio.data?.puedeVerCuentaCorriente)
  const medios = useMediosDeCobro()
  const registrar = useRegistrarCobro()
  const [f, setF] = useState<FormCobro>(formVacio)
  const [aviso, setAviso] = useState<string | null>(null)
  const [pagoId, setPagoId] = useState<string | null>(null)
  const cheque = (campo: keyof FormCobro['cheque']) => (v: string) => setF(p => ({ ...p, cheque: { ...p.cheque, [campo]: v } }))

  if (socio.isLoading) return <ActivityIndicator style={{ marginTop: space[8] }} color={c.brandInk} />
  if (!socio.data) return <Notice tone="peligro">{mensajeDelServidor(socio.error, 'No se pudo abrir el cliente.')}</Notice>
  const cliente = socio.data
  const medio = medios.data?.find(m => m.id === f.medioPagoId)
  const monto = leerNumero(f.monto)

  if (pagoId) {
    return (
      <CobroListo
        cliente={cliente}
        pagoId={pagoId}
        monto={monto ?? 0}
        medio={medio?.nombre ?? ''}
        onVolver={onVolver}
        onOtro={() => { setPagoId(null); setF(formVacio()); registrar.reset() }}
      />
    )
  }

  const enviar = () => {
    if (registrar.isPending) return
    const r = armarCobro(socioId, f)
    if ('error' in r) return setAviso(r.error)
    setAviso(null)
    registrar.mutate(r.payload, { onSuccess: id => setPagoId(id) })
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space[4] }}>
      <FormContainer style={{ gap: space[4] }}>
        <View style={{ gap: space[1] }}>
          <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>{direccionDeEntrega(cliente)}</Text>
          <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>{nombreDelCliente(cliente)}</Text>
        </View>
        {estado.data ? <TotalsRow label="Saldo del cliente" importe={estado.data.saldoActual} /> : null}

        <Field label="Monto" value={f.monto} onChangeText={v => setF(p => ({ ...p, monto: v }))} keyboardType="decimal-pad" alignRight />

        {medios.isLoading ? <ActivityIndicator color={c.brandInk} /> : null}
        <ElegirChip
          titulo="Medio"
          opciones={(medios.data ?? []).filter(m => m.activo && m.id).map(m => ({ id: m.id!, label: m.nombre ?? '' }))}
          valor={f.medioPagoId}
          onCambio={id => setF(p => ({ ...p, medioPagoId: id, esCheque: !!medios.data?.find(m => m.id === id)?.esCheque }))}
        />
        {medios.error ? <Notice tone="peligro">{mensajeDelServidor(medios.error, 'No se pudieron cargar los medios de pago.')}</Notice> : null}

        {f.esCheque ? (
          <>
            <Field label="N.º de cheque" value={f.cheque.numero} onChangeText={cheque('numero')} />
            <Field label="Banco" value={f.cheque.banco} onChangeText={cheque('banco')} />
            <Field label="Titular" value={f.cheque.titular} onChangeText={cheque('titular')} />
            <Field label="Fecha de emisión" value={f.cheque.emision} onChangeText={cheque('emision')} help="dd/mm/aaaa" />
            <Field label="Fecha de pago" value={f.cheque.pago} onChangeText={cheque('pago')} help="dd/mm/aaaa" />
          </>
        ) : null}

        <Field label="Referencia (opcional)" value={f.referencia} onChangeText={v => setF(p => ({ ...p, referencia: v }))} help="Por ejemplo, el N.º de operación" />
        <Notice tone="info">{AVISO_IMPUTACION}</Notice>

        {aviso ? <Notice tone="advertencia">{aviso}</Notice> : null}
        {registrar.error ? <Notice tone="peligro">{mensajeDelServidor(registrar.error, 'No se pudo registrar el cobro.')}</Notice> : null}
        <Button label={monto && monto > 0 ? `Registrar cobro de ${formatImporte(monto)}` : 'Registrar cobro'} loading={registrar.isPending} disabled={registrar.isPending} onPress={enviar} />
      </FormContainer>
    </ScrollView>
  )
}
