import React, { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, Field, FormContainer, Notice, TotalsRow, formatImporte } from '@/core/ui/fw'
import { useSocio } from '@/libs/api-client/socios'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { direccionDeEntrega, nombreDelCliente } from '@/features/clientes/lib/cliente'
import { useEstadoCuentaSocio } from '../api/queries'
import { useMediosDeCobro, useRegistrarCobro } from '../api/cobros'
import { armarCobro, type FormCobro } from '../lib/cobro'
import { leerNumero } from '@/features/venta-nueva/lib/linea'
import { CobroListo } from './CobroListo'

export const AVISO_IMPUTACION =
  'Imputación automática: el servidor lo aplica a la deuda más vieja y te dice en qué cuenta (TST o Normal) quedó.'

const formVacio = (): FormCobro => ({ monto: '', medioPagoId: null, referencia: '' })

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

        <View accessibilityRole="radiogroup" accessibilityLabel="Medio" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          {medios.isLoading ? <ActivityIndicator color={c.brandInk} /> : null}
          {(medios.data ?? []).filter(m => m.activo && !m.esCheque).map(m => {
            const elegido = m.id === f.medioPagoId
            return (
              <Pressable
                key={m.id}
                accessibilityRole="radio"
                accessibilityLabel={m.nombre ?? ''}
                accessibilityState={{ checked: elegido, selected: elegido }}
                onPress={() => setF(p => ({ ...p, medioPagoId: m.id ?? null }))}
                style={{
                  minHeight: 44,
                  justifyContent: 'center',
                  paddingHorizontal: space[4],
                  borderRadius: radii.pastilla,
                  backgroundColor: elegido ? c.brandSoft : c.surface2,
                  borderWidth: elegido ? 2 : 0,
                  borderColor: c.brand,
                }}
              >
                <Text style={{ ...typeScale.secundario, color: elegido ? c.brandInk : c.text }}>{m.nombre}</Text>
              </Pressable>
            )
          })}
        </View>
        {medios.error ? <Notice tone="peligro">{mensajeDelServidor(medios.error, 'No se pudieron cargar los medios de pago.')}</Notice> : null}

        <Field label="Referencia (opcional)" value={f.referencia} onChangeText={v => setF(p => ({ ...p, referencia: v }))} help="Por ejemplo, el N.º de operación" />
        <Notice tone="info">{AVISO_IMPUTACION}</Notice>

        {aviso ? <Notice tone="advertencia">{aviso}</Notice> : null}
        {registrar.error ? <Notice tone="peligro">{mensajeDelServidor(registrar.error, 'No se pudo registrar el cobro.')}</Notice> : null}
        <Button label={monto && monto > 0 ? `Registrar cobro de ${formatImporte(monto)}` : 'Registrar cobro'} loading={registrar.isPending} disabled={registrar.isPending} onPress={enviar} />
      </FormContainer>
    </ScrollView>
  )
}
