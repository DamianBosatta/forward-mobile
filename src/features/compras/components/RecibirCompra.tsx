import React, { useEffect, useState } from 'react'
import { ScrollView, Text, TextInput, View } from 'react-native'
import { Check } from 'lucide-react-native'
import { Button, Field, Notice, TopBar, formatImporte } from '@/core/ui/fw'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { useRecibirCompra } from '@/libs/api-client/compras'
import { useSocio } from '@/libs/api-client/socios'
import type { CompraDto } from '@/libs/api-client'
import { diaArgentina } from '@/src/utils/date'
import { mostrarNumero } from '@/src/utils/numero'
import { ddmmaaaa, fechaIso, hoyTexto } from '../lib/fecha'
import { mensajeDelServidor } from '../lib/mensaje-error'
import { numeroDeCompra } from '../lib/numero'
import {
  CONSECUENCIA, MENSAJE_LLEGADA, MENSAJE_RECEPCION, calcularVencimiento, llegadasIniciales, mensajeProblemaFecha, planDeRecepcion,
  problemaFechaFactura, problemaLlegada, textoFaltante, textoSuma, type Llegadas,
} from '../lib/recepcion'
import { armarComprobante, formDesdeComprobante, formNuevo, type FormComprobante } from '../lib/comprobante'
import { ComprobanteCampos } from './ComprobanteCampos'

interface Props {
  compra: CompraDto
  onVolver: () => void
  /** La recepción quedó hecha en el servidor. */
  onHecho: (compraFaltanteNumero?: number | null) => void
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
 * Recibir mercadería (lienzo ModRecibirCompra y TabCompraRecibir). Cada línea dice cuánto llegó, de
 * entrada lo pedido. Si llegó todo, el pedido al servidor es el de siempre (POST /Compras/{id}/recibir);
 * si llegó una parte, va a recibir-parcial y lo que falta pasa a una compra nueva confirmada (R22).
 */
export function RecibirCompra({ compra, onVolver, onHecho, onConflicto }: Props) {
  const c = useColors()
  const { isTablet } = useResponsive()
  const recibir = useRecibirCompra()
  const socio = useSocio(compra.proveedorId)
  const pideFactura = compra.condicionPago?.tipo === 'DiasDesdeFactura'
  const [fechaFactura, setFechaFactura] = useState(hoyTexto)
  const [comprobante, setComprobante] = useState<FormComprobante | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [llegadas, setLlegadas] = useState<Llegadas>(() => llegadasIniciales(compra.detalles))
  const secundario = [typeScale.secundario, { color: c.textSecondary }]

  // El CUIT del proveedor llega después de abrir el comprobante: se precarga cuando está.
  useEffect(() => {
    if (comprobante && !comprobante.cuit && socio.data?.cuit) setComprobante({ ...comprobante, cuit: socio.data.cuit })
  }, [comprobante, socio.data])

  const hoy = diaArgentina(Date.now())
  const fechaLeida = fechaIso(fechaFactura)
  // Texto ilegible cuenta como fuera de rango; vacío, como falta (solo si la condición la exige).
  const problema = pideFactura ? problemaFechaFactura(compra.condicionPago, fechaLeida ?? (fechaFactura.trim() ? 'x' : ''), hoy) : null
  const vencimiento = calcularVencimiento(compra.condicionPago, hoy, pideFactura ? fechaLeida : null)
  const plan = planDeRecepcion(compra.detalles, llegadas)
  const unidades = plan.problema === null ? plan.unidades : 0

  const confirmar = async () => {
    setError(null)
    let armado: ReturnType<typeof armarComprobante> | null = null
    if (comprobante) {
      armado = armarComprobante(comprobante)
      if ('error' in armado) return void setError(armado.error)
    }
    try {
      const r = await recibir.mutateAsync({
        id: compra.id,
        fechaFacturaProveedor: pideFactura ? fechaLeida! : undefined,
        comprobante: armado && 'comprobante' in armado ? armado.comprobante : undefined,
        lineas: plan.problema === null ? plan.lineas : null,
      })
      onHecho(r.compraFaltanteNumero)
    } catch (e) {
      setError(`No se recibió la compra: ${mensajeDelServidor(e)}`)
      if ((e as { status?: number })?.status === 409) onConflicto?.()
    }
  }

  const llego = (d: Detalle, ancho: number) => {
    const falla = problemaLlegada(llegadas[d.id] ?? '', d.cantidad)
    return (
      <View style={{ width: ancho, gap: space[1] }}>
        <TextInput
          accessibilityLabel={`Llegó de ${d.nombreProducto}`} accessibilityHint={falla ? MENSAJE_LLEGADA[falla] : undefined}
          value={llegadas[d.id]} onChangeText={(t) => setLlegadas({ ...llegadas, [d.id]: t })} keyboardType="decimal-pad" selectTextOnFocus
          style={[typeScale.cuerpoDestacado, {
            minHeight: 44, paddingHorizontal: space[2], textAlign: 'right', color: c.text, backgroundColor: c.bg,
            borderRadius: radii.tarjeta, borderWidth: 1, borderColor: falla ? c.chip.anulado.text : c.border,
          }]}
        />
        {falla ? <Text style={[typeScale.secundario, { color: c.chip.anulado.text }]}>{MENSAJE_LLEGADA[falla]}</Text> : null}
      </View>
    )
  }

  const linea = (d: Detalle, i: number) => {
    const empaque = empaqueTexto(d)
    return isTablet ? (
      <View key={d.id} accessible style={{ flexDirection: 'row', gap: space[3], padding: space[3], borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
        <Text style={[typeScale.cuerpoDestacado, { flex: 1, color: c.text }]}>{d.nombreProducto}{empaque ? <Text style={[typeScale.cuerpo, { color: c.textSecondary }]}>{` · ${empaque}`}</Text> : null}</Text>
        <Text style={[typeScale.cuerpo, { width: 90, textAlign: 'right', color: c.text }]}>{mostrarNumero(d.cantidad)}</Text>
        {llego(d, 110)}
        <Text style={[typeScale.cuerpo, { width: 120, textAlign: 'right', color: c.text }]}>{mostrarNumero(d.costoUnitarioBaseAmount)}</Text>
        <Text style={[typeScale.cuerpoDestacado, { width: 130, textAlign: 'right', color: c.text }]}>{formatImporte(d.subtotalAmount)}</Text>
      </View>
    ) : (
      <View key={d.id} accessible style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], paddingHorizontal: space[4], borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
        <View style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: c.action, alignItems: 'center', justifyContent: 'center' }}>
          <Check size={16} color={c.onAction} strokeWidth={3} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typeScale.cuerpoDestacado, { color: c.text }]}>{d.nombreProducto}</Text>
          <Text style={secundario}>{`Pedidas ${mostrarNumero(d.cantidad)}${empaque ? ` · ${empaque}` : ''}`}</Text>
        </View>
        {llego(d, 96)}
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Recibir mercadería" subtitle={`Compra ${numeroDeCompra(compra)} · ${compra.razonSocialProveedor}`} leading={{ kind: 'atras', onPress: () => { if (!recibir.isPending) onVolver() } }} />
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[3], paddingBottom: space[6] }} keyboardShouldPersistTaps="handled">
        <Notice tone="info">{CONSECUENCIA.recibir}</Notice>
        <Text accessibilityRole="header" style={[typeScale.cuerpoDestacado, { color: c.textSecondary }]}>Cuánto llegó de cada línea</Text>
        <View style={{ borderRadius: radii.tarjeta, backgroundColor: c.surface, overflow: 'hidden' }}>
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
        <Text accessibilityRole="header" style={[typeScale.cuerpoDestacado, { color: c.textSecondary }]}>Factura del proveedor</Text>
        {comprobante ? (
          <ComprobanteCampos form={comprobante} onCambio={setComprobante} />
        ) : (
          <Button label="Cargar el comprobante del proveedor" variant="secundario" onPress={() => setComprobante(
            compra.comprobante ? formDesdeComprobante(compra.comprobante) : formNuevo(socio.data ?? { razonSocial: compra.razonSocialProveedor }, hoyTexto()),
          )} />
        )}
        {error ? <Notice tone="peligro">{error}</Notice> : null}
      </ScrollView>
      <View style={{ gap: space[2], padding: space[4], backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border }}>
        <Text style={[secundario, { textAlign: 'center' }]}>{textoSuma(unidades)}</Text>
        <Button label="Confirmar recepción" loading={recibir.isPending} disabled={!!problema || plan.problema !== null} onPress={() => { void confirmar() }} />
      </View>
    </View>
  )
}
