import React, { useState } from 'react'
import { ProductoIdentidad } from '@/core/ui/fw/ProductoIdentidad'
import { ScrollView, Text, TextInput, View } from 'react-native'
import { Check } from 'lucide-react-native'
import { Button, Field, Notice, PieFijo, TopBar, formatImporte } from '@/core/ui/fw'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { useAsignarFotoFacturaCompra, useRecibirCompra, type CompraFaltante } from '@/libs/api-client/compras'
import { useSocio } from '@/libs/api-client/socios'
import type { CompraDto } from '@/libs/api-client'
import { diaArgentina, hoyTexto } from '@/core/utils/fecha'
import { leerNumero, mostrarNumero } from '@/core/utils/numero'
import { ddmmaaaa } from '@/core/utils/fecha'
import { fechaIso } from '../lib/fecha'
import { mensajeDelServidor } from '../lib/mensaje-error'
import { numeroDeCompra } from '../lib/numero'
import {
  CONSECUENCIA, MENSAJE_LLEGADA, MENSAJE_RECEPCION, calcularVencimiento, llegadasIniciales, mensajeProblemaFecha, planDeRecepcion,
  problemaFechaFactura, problemaLlegada, textoFaltante, textoSuma, type Llegadas,
} from '../lib/recepcion'
import { formDesdeComprobante, formNuevo } from '../lib/comprobante'
import { ComprobanteProveedorPantalla, resumenDeCargado, type ComprobanteCargado } from './ComprobanteProveedorPantalla'

interface Props {
  compra: CompraDto
  onVolver: () => void
  /** La recepción quedó hecha en el servidor. */
  onHecho: (faltante: CompraFaltante) => void
  /** El servidor dio 409: la compra cambió; quien la muestra la recarga. */
  onConflicto?: () => void
}

type Detalle = CompraDto['detalles'][number]

const EMPAQUE: Record<string, [string, string]> = { Bulto: ['bulto', 'bultos'], BultoMadre: ['bulto madre', 'bultos madre'] }
/** "2 bultos" cuando se pidió por bulto; null cuando se pidió por unidad. */
const empaqueTexto = (d: Detalle) => {
  const e = EMPAQUE[String(d.unidadCompra)]
  return e ? `${mostrarNumero(d.cantidadIngresada)} ${d.cantidadIngresada === 1 ? e[0] : e[1]}` : null
}

/**
 * Recibir mercadería (maqueta "Compras como venta", frames 21 y 22: las líneas con la visual del carrito de venta). Cada
 * línea dice cuánto llegó, de entrada lo pedido, y se corrige solo lo que difiere. Si llegó todo, el pedido al servidor es
 * el de siempre (POST /Compras/{id}/recibir); si llegó una parte, va a recibir-parcial y lo que falta pasa a una compra
 * nueva confirmada (R22). El comprobante va en el mismo POST; la foto de la factura se adjunta después (PUT foto-factura).
 */
export function RecibirCompra({ compra, onVolver, onHecho, onConflicto }: Props) {
  const c = useColors()
  const { isTablet } = useResponsive()
  const recibir = useRecibirCompra()
  const asignarFoto = useAsignarFotoFacturaCompra()
  const socio = useSocio(compra.proveedorId)
  const pideFactura = compra.condicionPago?.tipo === 'DiasDesdeFactura'
  const [fechaFactura, setFechaFactura] = useState(hoyTexto)
  const [comprobante, setComprobante] = useState<ComprobanteCargado | null>(null)
  const [comprobanteAbierto, setComprobanteAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [llegadas, setLlegadas] = useState<Llegadas>(() => llegadasIniciales(compra.detalles))
  const secundario = { ...typeScale.secundario, color: c.textSecondary }
  const ocupado = recibir.isPending || asignarFoto.isPending

  const hoy = diaArgentina(Date.now())
  const fechaLeida = fechaIso(fechaFactura)
  // Texto ilegible cuenta como fuera de rango; vacío, como falta (solo si la condición la exige).
  const problema = pideFactura ? problemaFechaFactura(compra.condicionPago, fechaLeida ?? (fechaFactura.trim() ? 'x' : ''), hoy) : null
  const vencimiento = calcularVencimiento(compra.condicionPago, hoy, pideFactura ? fechaLeida : null)
  const plan = planDeRecepcion(compra.detalles, llegadas)
  const unidades = plan.problema === null ? plan.unidades : 0

  const confirmar = async () => {
    setError(null)
    let r: CompraFaltante
    try {
      r = await recibir.mutateAsync({
        id: compra.id,
        fechaFacturaProveedor: pideFactura ? fechaLeida! : undefined,
        comprobante: comprobante?.comprobante,
        lineas: plan.problema === null ? plan.lineas : null,
      })
    } catch (e) {
      setError(`No se recibió la compra: ${mensajeDelServidor(e)}`)
      if ((e as { status?: number })?.status === 409) onConflicto?.()
      return
    }
    // La recepción ya está hecha: si la foto no se adjunta, se avisa y se puede volver a cargar desde la compra.
    if (comprobante?.fotoUrl) {
      try { await asignarFoto.mutateAsync({ id: compra.id, fotoUrl: comprobante.fotoUrl }) } catch { /* la foto se vuelve a cargar desde el detalle */ }
    }
    onHecho(r)
  }

  const llego = (d: Detalle, ancho: number, conError = true) => {
    const falla = problemaLlegada(llegadas[d.id] ?? '', d.cantidad)
    return (
      <View style={{ width: ancho, gap: space[1] }}>
        <TextInput
          accessibilityLabel={`Llegó de ${d.nombreProducto}`} accessibilityHint={falla ? MENSAJE_LLEGADA[falla] : undefined}
          value={llegadas[d.id]} onChangeText={(t) => setLlegadas({ ...llegadas, [d.id]: t })} keyboardType="decimal-pad" selectTextOnFocus
          style={[typeScale.cuerpoDestacado, importe, {
            minHeight: 44, paddingHorizontal: space[2], textAlign: 'right', color: c.text, backgroundColor: c.surface2,
            borderRadius: radii.campo, borderWidth: falla ? 2 : 1, borderColor: falla ? c.danger : c.border,
          }]}
        />
        {falla && conError ? <Text style={[typeScale.secundario, { color: c.chip.anulado.text }]}>{MENSAJE_LLEGADA[falla]}</Text> : null}
      </View>
    )
  }

  const linea = (d: Detalle, i: number) => {
    const empaque = empaqueTexto(d)
    if (isTablet) {
      return (
        <View key={d.id} accessible style={{ flexDirection: 'row', gap: space[3], padding: space[3], borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
          <Text style={[typeScale.cuerpoDestacado, { flex: 1, color: c.text }]}>{d.nombreProducto}{empaque ? <Text style={[typeScale.cuerpo, { color: c.textSecondary }]}>{` · ${empaque}`}</Text> : null}</Text>
          <Text style={[typeScale.cuerpo, { width: 90, textAlign: 'right', color: c.text }]}>{mostrarNumero(d.cantidad)}</Text>
          {llego(d, 110)}
          <Text style={[typeScale.cuerpo, { width: 120, textAlign: 'right', color: c.text }]}>{mostrarNumero(d.costoUnitarioBaseAmount)}</Text>
          <Text style={[typeScale.cuerpoDestacado, { width: 130, textAlign: 'right', color: c.text }]}>{formatImporte(d.subtotalAmount)}</Text>
        </View>
      )
    }
    const falla = problemaLlegada(llegadas[d.id] ?? '', d.cantidad)
    const llegoAlgo = (leerNumero(llegadas[d.id] ?? '') ?? 0) > 0
    // Como la marca de la venta: tildada si llegó algo; vacía si no, y en rojo si falta corregirla.
    return (
      <View key={d.id} accessible style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3], paddingVertical: space[3], borderTopWidth: 1, borderTopColor: c.border }}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={{ width: 24, height: 24, marginTop: space[1], borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: llegoAlgo ? 0 : 2, borderColor: falla ? c.danger : c.border, backgroundColor: llegoAlgo ? c.action : 'transparent' }}>
          {llegoAlgo ? <Check size={14} color={c.onAction} strokeWidth={3} /> : null}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: space[1] }}>
          <ProductoIdentidad nombre={d.nombreProducto} marca={d.marca} codigo={d.codigoPropio} />
          <Text style={secundario}>{`Pedidas ${mostrarNumero(d.cantidad)}${empaque ? ` · ${empaque}` : ''}`}</Text>
          {falla ? <Text style={[typeScale.secundario, { color: c.chip.anulado.text }]}>{MENSAJE_LLEGADA[falla]}</Text> : null}
        </View>
        {llego(d, 96, false)}
      </View>
    )
  }

  const tarjeta = { gap: space[2], padding: space[4], borderRadius: radii.tarjeta, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Recibir mercadería" subtitle={`Compra ${numeroDeCompra(compra)} · ${compra.razonSocialProveedor}`} leading={{ kind: 'atras', onPress: () => { if (!ocupado) onVolver() } }} />
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[3], paddingBottom: space[6] }} keyboardShouldPersistTaps="handled">
        <Notice tone="info">{CONSECUENCIA.recibir}</Notice>
        <View style={{ ...tarjeta, gap: 0, paddingVertical: space[2], overflow: 'hidden' }}>
          <Text accessibilityRole="header" style={[typeScale.seccion, { color: c.text, paddingVertical: space[2] }]}>Cuánto llegó de cada línea</Text>
          {isTablet ? (
            <View style={{ flexDirection: 'row', gap: space[3], padding: space[3] }}>
              <Text style={[typeScale.secundario, { flex: 1, color: c.textSecondary }]}>Producto</Text>
              <Text style={[typeScale.secundario, { width: 90, textAlign: 'right', color: c.textSecondary }]}>Pedidas</Text>
              <Text style={[typeScale.secundario, { width: 110, textAlign: 'right', color: c.textSecondary }]}>Llegó</Text>
              <Text style={[typeScale.secundario, { width: 120, textAlign: 'right', color: c.textSecondary }]}>Costo</Text>
              <Text style={[typeScale.secundario, { width: 130, textAlign: 'right', color: c.textSecondary }]}>Subtotal</Text>
            </View>
          ) : null}
          {compra.detalles.map(linea)}
        </View>
        {plan.problema === null && plan.faltan.length ? <Notice tone="info">{textoFaltante(plan.faltan)}</Notice> : null}
        {plan.problema === 'nada' ? <Notice tone="peligro">{MENSAJE_RECEPCION.nada}</Notice> : null}
        {pideFactura ? (
          <Field
            label="Fecha de la factura" placeholder="dd/mm/aaaa" value={fechaFactura} onChangeText={setFechaFactura} keyboardType="numbers-and-punctuation"
            help="La condición de pago se cuenta desde la factura." error={problema ? mensajeProblemaFecha(problema) : undefined}
          />
        ) : null}
        {vencimiento ? <Text style={secundario}>{`Vence el ${ddmmaaaa(vencimiento)}`}</Text> : null}
        <View style={tarjeta}>
          <Text accessibilityRole="header" style={[typeScale.seccion, { color: c.text }]}>Factura del proveedor</Text>
          {comprobante ? <Text style={[typeScale.secundario, { color: c.text }]}>{resumenDeCargado(comprobante)}</Text> : null}
          {comprobante?.fotoUrl ? <Text style={secundario}>Foto de la factura cargada</Text> : null}
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <View style={{ flex: 1 }}><Button label="Sacar foto" variant="secundario" accessibilityLabel="Sacar foto de la factura" disabled={ocupado} onPress={() => setComprobanteAbierto(true)} /></View>
            <View style={{ flex: 1 }}><Button label={comprobante ? 'Cambiar datos' : 'Cargar datos'} variant="secundario" accessibilityLabel="Cargar los datos de la factura" disabled={ocupado} onPress={() => setComprobanteAbierto(true)} /></View>
          </View>
          <Text style={secundario}>Opcional. Se puede cargar después desde la compra.</Text>
        </View>
        {error ? <Notice tone="peligro">{error}</Notice> : null}
      </ScrollView>
      <PieFijo>
        <Text style={[secundario, { textAlign: 'center' }]}>{textoSuma(unidades)}</Text>
        <Button label="Confirmar recepción" loading={ocupado} disabled={!!problema || plan.problema !== null} onPress={() => { void confirmar() }} />
      </PieFijo>
      <ComprobanteProveedorPantalla visible={comprobanteAbierto}
        form={comprobante?.form ?? (compra.comprobante ? formDesdeComprobante(compra.comprobante) : formNuevo(socio.data ?? { razonSocial: compra.razonSocialProveedor }, hoyTexto()))}
        fotoUrl={comprobante?.fotoUrl ?? null}
        onVolver={() => setComprobanteAbierto(false)} onGuardar={(cargado) => { setComprobante(cargado); setComprobanteAbierto(false) }} />
    </View>
  )
}
