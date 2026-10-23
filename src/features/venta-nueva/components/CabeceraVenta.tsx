import React from 'react'
import { ScrollView, Text, View } from 'react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, Field, Notice, Segmented, type SegmentedOption } from '@/core/ui/fw'
import { useSocio } from '@/libs/api-client/socios'
import { textoCondicionPago } from '@/features/clientes/lib/cliente'
import { Fila, textoDisponible } from '@/features/clientes/components/CreditoDelCliente'
import { METODO_ENTREGA, type MetodoEntregaValue } from '@/features/ventas/lib/venta-form-retiro'
import type { CabeceraVentaEstado } from '../hooks/useCabeceraVenta'
import { TiraDeDias } from './TiraDeDias'

const ENTREGAS: SegmentedOption<'1' | '2' | '3'>[] = [
  { value: '1', label: 'Logística' },
  { value: '2', label: 'Retiro' },
  { value: '3', label: 'Expreso' },
]

interface Props { clienteId: string; rotuloCliente: string; cab: CabeceraVentaEstado }

/** Pestaña Cabecera (lámina Cabecera): cliente, entrega, fecha, flete, observaciones y cesión de comisión. */
export function CabeceraVenta({ clienteId, rotuloCliente, cab }: Props) {
  const c = useColors()
  const socio = useSocio(clienteId)
  const { metodoEntrega, fecha } = cab.cabecera
  // Crédito disponible (ficha del cliente, forward-system #882): solo si el servidor lo manda (null sin tope)
  // y deja ver importes (`puedeVerSaldo`; si no, llega redactado en 0). Cargando o con error, no se muestra
  // y el formulario sigue: el servidor valida el tope al guardar.
  const disponible = socio.data?.puedeVerSaldo === true && typeof socio.data.creditoDisponible === 'number' ? socio.data.creditoDisponible : null
  const titulo = (t: string) => <Text accessibilityRole="header" style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{t}</Text>
  const secundario = { ...typeScale.secundario, color: c.textSecondary }
  return (
    <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4] }}>
      <View style={{ gap: space[1], padding: space[3], borderRadius: radii.tarjeta, backgroundColor: c.surface }}>
        {titulo('Cliente')}
        <Text style={{ ...typeScale.cuerpo, color: c.text }}>{rotuloCliente}</Text>
        {/* Solo lectura: la condición de pago se cambia con permiso de autorizar ventas, no acá. */}
        <Text style={secundario}>{socio.data ? textoCondicionPago(socio.data.condicionPago) : 'Condición de pago…'}</Text>
        {disponible !== null ? <Fila etiqueta="Crédito disponible" valor={textoDisponible(disponible)} alerta={disponible < 0} /> : null}
      </View>
      <View style={{ gap: space[2] }}>
        {titulo('Entrega')}
        <Segmented accessibilityLabel="Entrega" options={ENTREGAS} value={String(metodoEntrega) as '1'}
          onChange={(v) => cab.setMetodoEntrega(Number(v) as MetodoEntregaValue)} />
        {metodoEntrega === METODO_ENTREGA.RetiroEnLocal ? <Text style={secundario}>Retira en el local: sin flete.</Text> : null}
      </View>
      {metodoEntrega !== METODO_ENTREGA.RetiroEnLocal ? (
        <View style={{ gap: space[2] }}>
          {titulo('Fecha de entrega')}
          {cab.calendarioError ? (
            <View style={{ gap: space[2] }}>
              <Notice tone="peligro">No se pudo traer el calendario de entregas.</Notice>
              <Button label="Reintentar" variant="secundario" onPress={cab.reintentarCalendario} />
            </View>
          ) : null}
          {fecha ? null : <Text style={secundario}>Sin fecha: elegí el día de entrega.</Text>}
          <TiraDeDias cab={cab} />
        </View>
      ) : null}
      {metodoEntrega === METODO_ENTREGA.Logistica ? (
        <Field label="Flete ($)" keyboardType="decimal-pad" alignRight value={cab.fleteTexto} onChangeText={cab.setFleteTexto}
          placeholder="0" error={cab.fleteInvalido ? 'Ingresá un importe válido.' : undefined} />
      ) : null}
      <Field label="Observaciones" multiline maxLength={500} value={cab.observaciones} onChangeText={cab.setObservaciones}
        placeholder="Ej.: entregar por la puerta de atrás antes de las 12." />
      {cab.puedeCeder ? (
        <Field label="Ceder parte de mi comisión (%)" keyboardType="decimal-pad" alignRight value={cab.cesionTexto}
          onChangeText={cab.setCesionTexto} error={cab.cesionError ?? undefined}
          help={`Opcional · el pedido queda por autorizar. Tu comisión es ${cab.comision} %.`} />
      ) : null}
    </ScrollView>
  )
}
