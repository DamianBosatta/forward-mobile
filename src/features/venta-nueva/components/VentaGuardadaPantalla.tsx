import React from 'react'
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Check } from 'lucide-react-native'
import { FONT, importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, Notice, StatusChip, TopBar, chipForEstado, formatImporte } from '@/core/ui/fw'
import { usePuedeCobrar } from '@/features/cuentas/lib/permiso'
import { urlWhatsApp } from '@/features/clientes/lib/contacto'
import { direccionDeEntrega, nombreDelCliente } from '@/features/clientes/lib/cliente'
import { useVenta } from '@/libs/api-client/ventas'
import { useSocio } from '@/libs/api-client/socios'
import { esEstadoVenta } from '@/core/constants/estados'
import { diaDeEntregaCorto } from '@/features/ventas/lib/entrega'
import { codigoDeVenta, resumenDeLineas, rotuloCliente, tipoDeVenta } from '../lib/ventaGuardada'
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
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const puedeCobrarPagos = usePuedeCobrar()
  // Recién guardada: el caché trae la versión de antes del guardado; las acciones (convertir, anular, editar) usan la vigente.
  const q = useVenta(id, { fresco: true })
  const socio = useSocio(q.data?.venta.clienteId ?? '')
  const listo = () => router.replace('/(tabs)/ventas' as never)
  const vigente = q.isFetchedAfterMount && q.isSuccess ? q.data : undefined
  const h = vigente?.venta
  const tipo = h ? tipoDeVenta(h) : 'Venta'
  const secundario = { ...typeScale.secundario, color: c.textSecondary }
  const negrita = { fontFamily: FONT.semibold, fontWeight: '600' as const }

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
  const confirmada = esEstadoVenta(h.estado, 'Confirmada')
  const entrega = h.metodoEntregaNombre === 'RetiroEnLocal' ? 'Retiro en el local' : diaDeEntregaCorto(h.fechaEntrega)
  const chip = chipForEstado('venta', h.estado)
  const whatsapp = urlWhatsApp(socio.data?.telefono)
  // Cobrar: la misma regla que la ficha del cliente (cobros del módulo Pagos y cuenta del cliente a la vista); una venta por autorizar todavía no se cobra (S5).
  const puedeCobrar = esPedido && !porAutorizar && socio.data?.puedeVerCuentaCorriente === true && puedeCobrarPagos
  const mandarPorWhatsApp = () => {
    if (!whatsapp) return
    const texto = `Hola, te paso el ${tipo.toLowerCase()} ${codigoDeVenta(h)} por ${formatImporte(h.totalAmount)}.`
    void Linking.openURL(`${whatsapp}?text=${encodeURIComponent(texto)}`)
  }

  const direccion = socio.data ? direccionDeEntrega(socio.data) : (h.clienteNombre ?? '')
  const nombre = socio.data ? nombreDelCliente(socio.data) : ''
  const fila = (k: string, v: React.ReactNode, ultima = false) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 40, borderBottomWidth: ultima ? 0 : 1, borderBottomColor: c.border }}>
      <Text style={secundario}>{k}</Text>
      {v}
    </View>
  )

  return (
    <View testID="venta-guardada" style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Venta guardada" />
      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: insets.bottom + space[6], gap: space[4] }}>
        <View testID="venta-guardada-resumen" style={{ padding: space[4], borderRadius: radii.tarjeta, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, gap: space[2] }}>
          <View style={{ alignItems: 'center', gap: space[1], paddingBottom: space[2] }}>
            <View testID="venta-guardada-marca" style={{ width: 56, height: 56, borderRadius: radii.pastilla, backgroundColor: c.action, alignItems: 'center', justifyContent: 'center' }}>
              <Check size={30} color={c.onAction} strokeWidth={2.5} />
            </View>
            <Text accessibilityRole="header" style={{ ...typeScale.titulo, ...negrita, color: c.text, textAlign: 'center', marginTop: space[2] }}>
              {`${tipo === 'Pedido' ? 'Venta' : tipo} ${codigoDeVenta(h)} ${esPedido && confirmada ? 'confirmada' : esPedido ? 'guardada' : 'guardado'}`}
            </Text>
            <Text style={{ ...typeScale.cuerpoDestacado, color: c.text, textAlign: 'center' }}>{direccion}</Text>
            {nombre ? <Text style={{ ...secundario, textAlign: 'center' }}>{nombre}</Text> : null}
            <Text style={{ ...secundario, textAlign: 'center' }}>{resumenDeLineas(vigente.detalles)}</Text>
          </View>
          {fila('Estado', chip ? <StatusChip estado={chip.estado} label={chip.label} /> : <Text style={{ ...typeScale.cuerpo, color: c.text }}>{rotulo}</Text>)}
          {entrega ? fila('Entrega', <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{entrega}</Text>) : null}
          {fila('Total', <Text style={{ ...typeScale.titulo, ...importe, ...negrita, color: c.text }}>{formatImporte(h.totalAmount)}</Text>, true)}
        </View>
        <Notice tone={porAutorizar ? 'advertencia' : 'exito'}>
          {mensaje ?? (porAutorizar ? 'Falta que la autoricen. Hasta entonces no sale a reparto. Te avisamos cuando la resuelvan.' : 'Quedó guardado.')}
        </Notice>
        {!porAutorizar ? <Text style={secundario}>La factura no se hace desde el teléfono: la emite la oficina.</Text> : null}
        <Button label="Ver la venta" onPress={() => router.push({ pathname: '/(tabs)/ventas/[id]', params: { id } } as never)} />
        {puedeCobrar ? <Button label="Cobrar ahora" onPress={() => router.push({ pathname: '/(tabs)/cuentas/cobro', params: { socioId: h.clienteId } } as never)} /> : null}
        {whatsapp ? <Button label={porAutorizar ? 'Avisar al cliente por WhatsApp' : 'Mandar por WhatsApp'} variant="secundario" onPress={mandarPorWhatsApp} /> : null}
        <AccionesVenta venta={vigente} rotulo={rotulo} />
        <Button label="Vender a otro cliente" variant="secundario" onPress={() => router.replace('/(tabs)/ventas/nueva' as never)} />
        <Pressable accessibilityRole="button" accessibilityLabel="Volver a Mi día" onPress={() => router.replace('/(tabs)' as never)} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ ...typeScale.cuerpoDestacado, color: c.brandInk }}>Volver a Mi día</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Listo" onPress={listo} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ ...typeScale.cuerpoDestacado, color: c.brandInk }}>Listo</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}
