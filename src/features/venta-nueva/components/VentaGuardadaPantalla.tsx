import React from 'react'
import { ActivityIndicator, Linking, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { CheckCircle2 } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, Notice, TopBar, TotalsRow, formatImporte } from '@/core/ui/fw'
import { usePermissions } from '@/core/auth/RequirePermission'
import { urlWhatsApp } from '@/features/clientes/lib/contacto'
import { direccionDeEntrega } from '@/features/clientes/lib/cliente'
import { useVenta } from '@/libs/api-client/ventas'
import { useSocio } from '@/libs/api-client/socios'
import { esEstadoVenta } from '@/core/constants/estados'
import { codigoDeVenta, entregaTexto, resumenDeLineas, rotuloCliente, tipoDeVenta } from '../lib/ventaGuardada'
import { AccionesVenta } from './AccionesVenta'

interface Props {
  id: string
  /** Lo que dijo el servidor al guardar (useConfirmarVenta): "quedó por autorizar porque…". */
  mensaje?: string
}

/**
 * V8 listo (CalleListo / TabCalleListo, sobre la lámina Guardada del plan 9): que se envió, para quién y cuándo se
 * entrega, el resumen, lo que dijo el servidor y qué hacer ahora (WhatsApp, PDF, cobrar, otra venta, Mi día).
 */
export function VentaGuardadaPantalla({ id, mensaje }: Props) {
  const c = useColors()
  const router = useRouter()
  const { canCreate, canRead } = usePermissions()
  // Recién guardada: el caché trae la versión de antes del guardado; las acciones (convertir, anular, editar) usan la vigente.
  const q = useVenta(id, { fresco: true })
  const socio = useSocio(q.data?.venta.clienteId ?? '')
  const listo = () => router.replace('/(tabs)/ventas' as never)
  const vigente = q.isFetchedAfterMount && q.isSuccess ? q.data : undefined
  const h = vigente?.venta
  const tipo = h ? tipoDeVenta(h) : 'Venta'
  const secundario = { ...typeScale.secundario, color: c.textSecondary }

  if (!vigente || !h) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar title="Venta guardada" />
        <View style={{ padding: space[4], gap: space[3] }}>
          {q.isError ? <Notice tone="peligro">No se pudo traer la venta. Ya quedó guardada: la ves en la lista.</Notice> : <ActivityIndicator color={c.brand} />}
          {q.isError ? <Button label="Listo" onPress={listo} /> : null}
        </View>
      </View>
    )
  }
  const rotulo = socio.data ? rotuloCliente(socio.data) : (h.clienteNombre ?? '')
  const porAutorizar = esEstadoVenta(h.estado, 'PendienteAutorizacion')
  const esPedido = tipo === 'Pedido'
  const entrega = entregaTexto(h.fechaEntrega)
  const whatsapp = urlWhatsApp(socio.data?.telefono)
  // Cobrar: la misma regla que la ficha del cliente (cobros del módulo Pagos y cuenta del cliente a la vista).
  const puedeCobrar = esPedido && socio.data?.puedeVerCuentaCorriente === true && canCreate('MOD_PAGOS') && canRead('MOD_PAGOS')
  const mandarPorWhatsApp = () => {
    if (!whatsapp) return
    const texto = `Hola, te paso el ${tipo.toLowerCase()} ${codigoDeVenta(h)} por ${formatImporte(h.totalAmount)}.`
    void Linking.openURL(`${whatsapp}?text=${encodeURIComponent(texto)}`)
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title={`${tipo} guardado`} />
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4] }}>
        <View style={{ alignItems: 'center', gap: space[1], paddingVertical: space[2] }}>
          <CheckCircle2 size={48} color={c.chip.entregado.text} />
          <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text, textAlign: 'center' }}>
            {`${tipo} ${codigoDeVenta(h)} ${esPedido ? 'enviado' : 'guardado'}`}
          </Text>
          <Text style={{ ...secundario, textAlign: 'center' }}>{[socio.data ? direccionDeEntrega(socio.data) : h.clienteNombre, entrega].filter(Boolean).join(' · ')}</Text>
          {porAutorizar ? <Text style={{ ...typeScale.cuerpoDestacado, color: c.chip.porAutorizar.text }}>Por autorizar · te avisamos</Text> : null}
          <Text style={{ ...secundario, textAlign: 'center' }}>{resumenDeLineas(vigente.detalles)}</Text>
        </View>
        <View style={{ padding: space[4], borderRadius: radii.tarjeta, backgroundColor: c.surface, gap: space[2] }}>
          <Text style={{ ...typeScale.titulo, color: c.text }}>{`${tipo} ${codigoDeVenta(h)}`}</Text>
          <Text style={secundario}>{rotulo}</Text>
          {vigente.detalles.map((d) => (
            <View key={d.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
              <Text style={{ ...typeScale.cuerpo, color: c.text, flex: 1 }}>{`${d.productoNombre} × ${d.cantidad}`}</Text>
              <Text style={{ ...typeScale.cuerpo, ...importe, color: c.text }}>{formatImporte(d.subtotal)}</Text>
            </View>
          ))}
          <TotalsRow label="Total" importe={h.totalAmount} destacado />
        </View>
        <Notice tone={porAutorizar ? 'advertencia' : 'exito'}>
          {mensaje ?? (porAutorizar ? 'Quedó por autorizar. Te avisamos cuando lo resuelvan.' : 'Quedó guardado.')}
        </Notice>
        {whatsapp ? <Button label="Mandar por WhatsApp" onPress={mandarPorWhatsApp} /> : null}
        {puedeCobrar ? <Button label="Cobrar ahora" variant="secundario" onPress={() => router.push({ pathname: '/(tabs)/cuentas/cobro', params: { socioId: h.clienteId } } as never)} /> : null}
        <AccionesVenta venta={vigente} rotulo={rotulo} />
        <Text style={secundario}>La factura no se hace desde el teléfono: va por la pestaña Facturación de la web.</Text>
        <Button label="Vender a otro cliente" variant="secundario" onPress={() => router.replace('/(tabs)/ventas/nueva-v2' as never)} />
        <Button label="Volver a Mi día" variant="secundario" onPress={() => router.replace('/(tabs)' as never)} />
        <Button label="Listo" variant="secundario" onPress={listo} />
      </ScrollView>
    </View>
  )
}
