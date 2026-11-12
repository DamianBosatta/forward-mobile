import React, { useState } from 'react'
import { ActivityIndicator, FlatList, Text, View } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import { radii, space, typeScale, useColors, useSombraTarjeta } from '@/libs/theme'
import { Button, Notice, PieFijo, TotalsRow } from '@/core/ui/fw'
import { FiltroChip } from '@/core/ui/fw/FiltroChip'
import { MOTIVO_SIN_PERMISO_DE_COBRO, MotivoDeshabilitado } from '@/core/ui/fw/MotivoDeshabilitado'
import { textoSinConexion } from '@/core/ui/fw/EstadoDePantalla'
import { esFallaDeRed } from '@/core/api/errores'
import { useSocio } from '@/libs/api-client/socios'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { useCartera } from '@/features/clientes/hooks/useCartera'
import { BuscadorCartera } from '@/features/clientes/components/BuscadorCartera'
import { ClienteCard } from '@/features/clientes/components/ClienteCard'
import { useEstadoCuentaSocio } from '../api/queries'

export const SIN_ACCESO_A_LA_CUENTA = 'No tenés acceso a la cuenta corriente de este cliente.'

interface Props {
  seleccionadoId: string | null
  onElegir: (socioId: string) => void
  onContinuar: () => void
  puedeCobrar: boolean
}

/** Saldo por cuenta del cliente elegido, en solo lectura (el lugar de "Último pedido" y del crédito en la venta). */
function SaldoDelCliente({ socioId }: { socioId: string }) {
  const c = useColors()
  const sombra = useSombraTarjeta()
  const socio = useSocio(socioId)
  const verCuenta = !!socio.data?.puedeVerCuentaCorriente
  const estado = useEstadoCuentaSocio(socioId, verCuenta)
  if (socio.isLoading || (verCuenta && estado.isLoading)) return <ActivityIndicator color={c.brandInk} />
  if (!socio.data) return <Notice tone="peligro">{mensajeDelServidor(socio.error, 'No se pudo abrir el cliente.')}</Notice>
  if (!verCuenta) return <Notice tone="peligro">{SIN_ACCESO_A_LA_CUENTA}</Notice>
  if (!estado.data) return <Notice tone="peligro">{mensajeDelServidor(estado.error, 'No se pudo cargar la cuenta.')}</Notice>
  const tope = socio.data.topeCredito
  return (
    <View style={{ gap: space[2], backgroundColor: c.surface, borderRadius: radii.tarjeta, borderWidth: 1, borderColor: c.border, ...sombra, padding: space[4] }}>
      <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>Saldo</Text>
      <TotalsRow label="Saldo del cliente" importe={estado.data.saldoActual} destacado />
      <TotalsRow label="TST" importe={estado.data.saldoTst} />
      <TotalsRow label="Normal (con factura)" importe={estado.data.saldoNormal} />
      <TotalsRow label="A favor" importe={estado.data.saldoAFavor} />
      {typeof tope === 'number' ? <TotalsRow label="Tope de crédito" importe={tope} /> : null}
    </View>
  )
}

/**
 * Paso 1 del cobro (maqueta "Cobros como venta", frames 1 a 3): solo cuando se entra a Cobrar sin cliente. La
 * cartera es la de Cuentas (búsqueda y deuda vencida en el servidor) con la misma fila, el chip de antigüedad de
 * la deuda y el candado de cartera ajena. Sin "Recientes": no hay cobros recientes.
 */
export function ElegirClienteCobro({ seleccionadoId, onElegir, onContinuar, puedeCobrar }: Props) {
  const c = useColors()
  const [busqueda, setBusqueda] = useState('')
  const [soloVencidas, setSoloVencidas] = useState(false)
  const { clientes, isLoading, error, refetch, cargarMas } = useCartera(busqueda, soloVencidas ? { conDeudaVencida: true } : undefined)
  const buscando = busqueda.trim().length > 0

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        style={{ flex: 1 }}
        data={clientes}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="handled"
        onEndReached={cargarMas}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View style={{ gap: space[2], paddingBottom: space[2] }}>
            <BuscadorCartera sobre="pantalla" valor={busqueda} onCambio={setBusqueda} placeholder="Cliente, dirección o localidad" />
            <View style={{ flexDirection: 'row', paddingHorizontal: space[4] }}>
              <FiltroChip label="Con deuda vencida" activo={soloVencidas} onPress={() => setSoloVencidas(v => !v)} />
            </View>
            {error ? (
              <View style={{ gap: space[2], paddingHorizontal: space[4] }}>
                <Notice tone={esFallaDeRed(error) ? 'advertencia' : 'peligro'}>
                  {esFallaDeRed(error) ? textoSinConexion() : mensajeDelServidor(error, 'No se pudo cargar la cartera.')}
                </Notice>
                <Button label="Reintentar" variant="secundario" onPress={() => { void refetch() }} />
              </View>
            ) : null}
            <Text accessibilityRole="header" style={{ ...typeScale.secundario, fontFamily: typeScale.cuerpoDestacado.fontFamily, fontWeight: '600', color: c.textSecondary, paddingHorizontal: space[4] }}>
              {buscando ? 'Resultados' : 'Clientes'}
            </Text>
          </View>
        }
        renderItem={({ item }) => <ClienteCard cliente={item} seleccionado={item.id === seleccionadoId} conAntiguedad onPress={() => onElegir(item.id)} />}
        ListEmptyComponent={
          isLoading ? <ActivityIndicator color={c.brandInk} /> : error ? undefined : (
            <Text style={{ ...typeScale.secundario, color: c.textSecondary, paddingHorizontal: space[4] }}>
              {buscando ? 'Ningún cliente coincide con la búsqueda.' : 'Todavía no hay clientes en tu cartera.'}
            </Text>
          )
        }
        ListFooterComponent={seleccionadoId ? <View style={{ padding: space[4] }}><SaldoDelCliente socioId={seleccionadoId} /></View> : undefined}
      />
      <PieFijo>
        {!puedeCobrar ? <MotivoDeshabilitado>{MOTIVO_SIN_PERMISO_DE_COBRO}</MotivoDeshabilitado> : null}
        <Button label="Continuar a qué se cobra" iconoFinal={ChevronRight} disabled={!seleccionadoId || !puedeCobrar} onPress={onContinuar} />
      </PieFijo>
    </View>
  )
}
