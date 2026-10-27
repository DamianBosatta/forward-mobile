import React from 'react'
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Check } from 'lucide-react-native'
import { FONT, importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, Notice, TopBar, formatImporte } from '@/core/ui/fw'
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
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { canCreate, canRead } = usePermissions()
  // Recién guardada: el caché trae la versión de antes del guardado; las acciones (convertir, anular, editar) usan la vigente.
  const q = useVenta(id, { fresco: true })
  const socio = useSocio(q.data?.venta.clienteId ?? '')
  const listo = () => router.replace('/(tabs)/ventas' as never)
  const vigente = q.isFetchedAfterMount && q.isSuccess ? q.data : undefined
  const h = vigente?.venta
  const tipo = h ? tipoDeVenta(h) : 'Venta'
  const secundario = { ...typeScale.secundario, color: c.onTopBar }
  const blanco = { color: c.onTopBarStrong }
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
    <View testID="venta-guardada" style={{ flex: 1, backgroundColor: c.topBar }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space[8], paddingHorizontal: space[5], paddingBottom: space[6], gap: space[4] }}>
        <View style={{ alignItems: 'center', gap: space[2] }}>
          <View testID="venta-guardada-marca" style={{ width: 88, height: 88, borderRadius: radii.pastilla, backgroundColor: c.action, alignItems: 'center', justifyContent: 'center' }}>
            <Check size={44} color={c.onAction} strokeWidth={2.5} />
          </View>
          <Text accessibilityRole="header" style={{ ...typeScale.titulo, ...negrita, ...blanco, fontSize: 26, lineHeight: 32, textAlign: 'center', marginTop: space[2] }}>
            {`${tipo} ${codigoDeVenta(h)} ${esPedido ? 'enviado' : 'guardado'}`}
          </Text>
          <Text style={{ ...secundario, textAlign: 'center' }}>{[socio.data ? direccionDeEntrega(socio.data) : h.clienteNombre, entrega].filter(Boolean).join(' · ')}</Text>
          {porAutorizar ? (
            <View style={{ paddingHorizontal: space[3], paddingVertical: space[1], borderRadius: radii.pastilla, backgroundColor: c.chip.porAutorizar.bg }}>
              <Text style={{ ...typeScale.etiqueta, color: c.chip.porAutorizar.text }}>Por autorizar · te avisamos</Text>
            </View>
          ) : null}
        </View>
        <View testID="venta-guardada-resumen" style={{ padding: space[4], borderRadius: radii.tarjeta, backgroundColor: 'rgba(255,255,255,0.08)', gap: space[2] }}>
          <Text style={{ ...typeScale.cuerpoDestacado, ...blanco }}>{`${tipo} ${codigoDeVenta(h)}`}</Text>
          <Text style={secundario}>{resumenDeLineas(vigente.detalles)}</Text>
          <Text style={secundario}>{rotulo}</Text>
          {vigente.detalles.map((d) => (
            <View key={d.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
              <Text style={{ ...typeScale.cuerpo, ...blanco, flex: 1 }}>{`${d.productoNombre} × ${d.cantidad}`}</Text>
              <Text style={{ ...typeScale.cuerpo, ...importe, ...blanco }}>{formatImporte(d.subtotal)}</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={secundario}>Total</Text>
            <Text style={{ ...typeScale.titulo, ...importe, ...negrita, ...blanco }}>{formatImporte(h.totalAmount)}</Text>
          </View>
        </View>
        <Notice tone={porAutorizar ? 'advertencia' : 'exito'}>
          {mensaje ?? (porAutorizar ? 'Quedó por autorizar. Te avisamos cuando lo resuelvan.' : 'Quedó guardado.')}
        </Notice>
        {whatsapp ? <Button label="Mandar por WhatsApp" onPress={mandarPorWhatsApp} /> : null}
        {puedeCobrar ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cobrar ahora"
            onPress={() => router.push({ pathname: '/(tabs)/cuentas/cobro', params: { socioId: h.clienteId } } as never)}
            style={{ height: 48, borderRadius: radii.campo, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ ...typeScale.cuerpoDestacado, ...blanco }}>Cobrar ahora</Text>
          </Pressable>
        ) : null}
        <AccionesVenta venta={vigente} rotulo={rotulo} />
        <Text style={secundario}>La factura no se hace desde el teléfono: va por la pestaña Facturación de la web.</Text>
        <Button label="Vender a otro cliente" variant="secundario" onPress={() => router.replace('/(tabs)/ventas/nueva' as never)} />
        <Pressable accessibilityRole="button" accessibilityLabel="Volver a Mi día" onPress={() => router.replace('/(tabs)' as never)} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ ...typeScale.cuerpoDestacado, color: c.onTopBar }}>Volver a Mi día</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Listo" onPress={listo} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ ...typeScale.cuerpoDestacado, color: c.onTopBar }}>Listo</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}
