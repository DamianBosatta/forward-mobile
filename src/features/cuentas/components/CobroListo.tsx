import React from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, FormContainer, Notice, TotalsRow, formatImporte } from '@/core/ui/fw'
import type { SocioDetailDto } from '@/libs/api-client/types'
import { direccionDeEntrega, nombreDelCliente } from '@/features/clientes/lib/cliente'
import { useEstadoCuentaSocio } from '../api/queries'
import { useCuentaDelPago, type CobroRegistrado } from '../api/cobros'

export const SIN_CUENTA_CONFIRMADA = 'No se pudo confirmar en qué cuenta quedó: fijate en los movimientos de la cuenta corriente.'
export const COBRO_YA_ESTABA = 'Este cobro ya estaba registrado: no se cargó de nuevo.'
export const COBRO_CON_LO_DE_ANTES =
  'Este cobro ya se había registrado antes con otros datos. No se cargó uno nuevo: revisá el que quedó grabado y, si hace falta, registrá otro.'

interface Props {
  cliente: SocioDetailDto
  cobro: CobroRegistrado
  monto: number
  medio: string
  onVolver: () => void
  onOtro: () => void
}

/** Cobro registrado (lámina CobroListo): en qué cuenta quedó según el servidor y el saldo nuevo. */
export function CobroListo({ cliente, cobro, monto, medio, onVolver, onOtro }: Props) {
  const c = useColors()
  const { cuenta, buscando } = useCuentaDelPago(cobro, cliente)
  const estado = useEstadoCuentaSocio(cliente.id, !!cliente.puedeVerCuentaCorriente)

  return (
    <ScrollView contentContainerStyle={{ padding: space[4] }}>
      <FormContainer style={{ gap: space[4] }}>
        <Notice tone="exito" title={cobro.conLoDeAntes ? 'Cobro ya registrado' : 'Cobro registrado'}>{`${direccionDeEntrega(cliente)} · ${nombreDelCliente(cliente)}`}</Notice>
        {cobro.yaEstaba ? <Notice tone="info">{COBRO_YA_ESTABA}</Notice> : null}
        {cobro.conLoDeAntes ? <Notice tone="advertencia">{COBRO_CON_LO_DE_ANTES}</Notice> : null}
        <View style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[4], gap: space[2] }}>
          {/* El monto y el medio del formulario no son los del cobro que quedó grabado con lo de antes. */}
          {cobro.conLoDeAntes ? null : <Text style={[typeScale.titulo, importe, { color: c.text }]}>{formatImporte(monto)}</Text>}
          {medio && !cobro.conLoDeAntes ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{medio}</Text> : null}
          {buscando ? <ActivityIndicator color={c.brandInk} /> : null}
          {cuenta ? (
            <>
              <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>
                {`Quedó en la cuenta ${cuenta === 'Tst' ? 'TST' : 'Normal'}`}
              </Text>
              <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
                La eligió el servidor: la cuenta de la deuda más vieja del cliente (sin deuda, la TST).
              </Text>
            </>
          ) : null}
          {!buscando && !cuenta ? <Notice tone="advertencia">{SIN_CUENTA_CONFIRMADA}</Notice> : null}
        </View>

        {estado.data ? (
          <View style={{ backgroundColor: c.surface, borderRadius: radii.tarjeta, padding: space[4], gap: space[2] }}>
            <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>Saldo nuevo</Text>
            <TotalsRow label="Cuenta TST" importe={estado.data.saldoTst} />
            <TotalsRow label="Cuenta Normal" importe={estado.data.saldoNormal} />
            <TotalsRow label="Saldo" importe={estado.data.saldoActual} destacado />
          </View>
        ) : null}

        <Button label="Volver a la cuenta corriente" onPress={onVolver} />
        <Button label="Registrar otro cobro" variant="secundario" onPress={onOtro} />
      </FormContainer>
    </ScrollView>
  )
}
