import React, { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { X } from 'lucide-react-native'
import { importe, maxFontScale, radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, formatImporte, Field, Notice, OptionCard } from '@/core/ui/fw'
import type { MedioCobroChofer } from '@/libs/api-client/logistica'
import { FotoEntrega } from './FotoEntrega'
import { mediosDelChofer, nombreDelMedio, type ChequeForm, type LineaCobroForm } from './entrega'

interface Props {
  medios: MedioCobroChofer[] | undefined
  mediosError: boolean
  lineas: LineaCobroForm[]
  onLineas: (lineas: LineaCobroForm[]) => void
  onSubiendo: (subiendo: boolean) => void
  /** dd/mm/aaaa de hoy, para precargar las fechas del cheque. */
  hoy: string
  /** Lámina ChoferEntrega: lo que hay que cobrar en la parada (lo decide el servidor): el importe de la factura. */
  aCobrar?: number | null
  /** "Factura A00012": el número de la nota de pedido, si el servidor lo manda. Sin él dice solo "Factura". */
  codigoFactura?: string | null
  /** Lo que falta cobrar y queda como deuda (chofer-04--mixto), si hay algo que decir. */
  faltaACuenta?: number | null
  /** "Sobran $ X" en rojo bajo los pagos: avisa, no frena. */
  aviso?: string | null
  /** Lo que el cliente ya debía antes de este pedido: solo informa (S18), en la cuenta del cliente (S8). */
  deudaAnterior?: number | null
  /**
   * "No paga" (S8): sin líneas, todo queda en su cuenta corriente y se sigue a cerrar la entrega. Sin esta función la
   * opción no se ofrece (la parada de solo cobro tiene su propio "No cobré").
   */
  onNoPaga?: () => void
  /** Entra directo a elegir el medio del próximo pago ("¿Sumar otro cobro? Sí"). */
  elegirAlEntrar?: boolean
}

/** Lo que se dice de cada forma de pago, en una línea (chofer-04). */
const DETALLE_MEDIO: Partial<Record<string, string>> = { Transferencia: 'Bancaria o billetera · Foto del comprobante', Cheque: 'Foto y datos' }

const redondear = (n: number) => Math.round(n * 100) / 100

/**
 * Lámina chofer-04 con la maqueta cobro-chofer (S8): arriba la cuenta del cliente (deuda anterior, factura y total) y
 * cómo paga: Efectivo, Transferencia y Cheque (del servidor) y "No paga" (todo a su cuenta corriente). Cada pago
 * lleva un solo monto, sin "Te dio" ni vuelto. Pagos ya cargados con su X de 44 px y "Sumar otro pago". El servidor
 * imputa y valida.
 */
export function CobroEnEntrega({ medios, mediosError, lineas, onLineas, onSubiendo, hoy, aCobrar, codigoFactura, faltaACuenta, aviso, deudaAnterior, onNoPaga, elegirAlEntrar = false }: Props) {
  const c = useColors()
  const [agregando, setAgregando] = useState(elegirAlEntrar)
  const cambiar = (i: number, cambio: Partial<LineaCobroForm>) => onLineas(lineas.map((l, j) => (j === i ? { ...l, ...cambio } : l)))
  const cambiarCheque = (i: number, campo: keyof ChequeForm) => (v: string) =>
    cambiar(i, { cheque: { ...lineas[i].cheque, [campo]: v } })
  const agregar = (medio: MedioCobroChofer) => {
    onLineas([...lineas, { medio, monto: '', fotoUrl: null, cheque: { numero: '', banco: '', titular: '', emision: hoy, pago: hoy } }])
    setAgregando(false)
  }
  const hayPagos = lineas.length > 0
  const elegirMedio = !hayPagos || agregando

  return (
    <View accessibilityLabel="Cobro" style={{ gap: space[3] }}>
      <CuentaDelCliente deudaAnterior={deudaAnterior} factura={aCobrar} codigoFactura={codigoFactura} />
      {mediosError ? <Notice tone="peligro">No se pudieron cargar los medios de cobro.</Notice> : null}
      {hayPagos ? <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>Pagos de hoy</Text> : null}
      {lineas.map((l, i) => {
        const n = i + 1
        return (
          <View key={i} accessibilityLabel={`Cobro ${n}`} style={{ gap: space[2], padding: space[3], borderRadius: radii.tarjeta, backgroundColor: c.surface, borderWidth: 2, borderColor: c.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <View accessibilityLabel={`Medio del cobro ${n}`} style={{ flex: 1 }}>
                <Text style={{ ...typeScale.seccion, color: c.text }}>{l.medio ? nombreDelMedio(l.medio) : 'Sin medio'}</Text>
                <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{`Pago ${n}`}</Text>
              </View>
              <BotonQuitar etiqueta={`Quitar cobro ${n}`} onPress={() => onLineas(lineas.filter((_, j) => j !== i))} />
            </View>
            <Field label={`Monto del cobro ${n}`} value={l.monto} onChangeText={(v) => cambiar(i, { monto: v })} keyboardType="decimal-pad" alignRight />
            {l.medio?.tipo === 'Cheque' ? (
              <>
                <Field label={`N.º de cheque (cobro ${n})`} value={l.cheque.numero} onChangeText={cambiarCheque(i, 'numero')} />
                <Field label={`Banco (cobro ${n})`} value={l.cheque.banco} onChangeText={cambiarCheque(i, 'banco')} />
                <Field label={`Titular (cobro ${n})`} value={l.cheque.titular} onChangeText={cambiarCheque(i, 'titular')} />
                <Field label={`Fecha de emisión (cobro ${n})`} value={l.cheque.emision} onChangeText={cambiarCheque(i, 'emision')} help="dd/mm/aaaa" />
                <Field label={`Fecha de pago (cobro ${n})`} value={l.cheque.pago} onChangeText={cambiarCheque(i, 'pago')} help="dd/mm/aaaa" />
              </>
            ) : null}
            {l.medio && l.medio.tipo !== 'Efectivo' ? (
              <FotoEntrega
                que={`${l.medio.tipo === 'Cheque' ? 'del cheque' : 'del comprobante'} del cobro ${n}`}
                ayuda={l.medio.tipo === 'Transferencia' ? 'La transferencia necesita la captura del comprobante.' : undefined}
                url={l.fotoUrl}
                onUrl={(url) => cambiar(i, { fotoUrl: url })}
                onSubiendo={onSubiendo}
              />
            ) : null}
          </View>
        )
      })}
      {aviso ? <Text style={{ ...typeScale.cuerpoDestacado, color: c.danger, textAlign: 'right' }}>{aviso}</Text> : null}
      {faltaACuenta ? <Notice tone="info">{`Los ${formatImporte(faltaACuenta)} que faltan quedan en su cuenta corriente.`}</Notice> : null}
      {elegirMedio ? (
        <View accessibilityLabel={hayPagos ? 'Sumar otro pago' : '¿Cómo paga?'} style={{ gap: space[2] }}>
          <Text accessibilityRole="header" style={{ ...typeScale.titulo, fontSize: 24, lineHeight: 32, color: c.text }}>{hayPagos ? 'Sumar otro pago' : '¿Cómo paga?'}</Text>
          {mediosDelChofer(medios).map((m) => (
            <OptionCard key={m.id} label={nombreDelMedio(m)} detail={DETALLE_MEDIO[m.tipo]} onPress={() => agregar(m)} />
          ))}
          {onNoPaga && !hayPagos ? <OpcionNoPaga onPress={onNoPaga} /> : null}
          {hayPagos ? <Button label="No sumo otro" variant="secundario" onPress={() => setAgregando(false)} /> : null}
        </View>
      ) : (
        <Button label="Sumar otro pago" variant="secundario" onPress={() => setAgregando(true)} />
      )}
    </View>
  )
}

/**
 * La cuenta del cliente arriba de cómo paga (S8): "Deuda anterior (CC)" en rojo, "Factura <nota de pedido>" con lo de
 * esta entrega y el total de las dos. Solo lo que manda el servidor: sin deuda no hay total (sería la factura repetida).
 */
function CuentaDelCliente({ deudaAnterior, factura, codigoFactura }: { deudaAnterior?: number | null; factura?: number | null; codigoFactura?: string | null }) {
  const c = useColors()
  const deuda = deudaAnterior != null && deudaAnterior > 0 ? deudaAnterior : null
  if (deuda == null && factura == null) return null
  const dato = { flexGrow: 1, flexBasis: 128, borderRadius: radii.campo, paddingHorizontal: space[3], paddingVertical: space[2], backgroundColor: c.surface, borderWidth: 2, borderColor: c.border }
  const rotulo = { ...typeScale.secundario, color: c.textSecondary }
  return (
    <View accessibilityLabel="Cuenta del cliente" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
      {deuda != null ? (
        <View accessibilityLabel="Deuda anterior" style={{ ...dato, borderColor: c.danger }}>
          <Text style={rotulo}>Deuda anterior (CC)</Text>
          <Text style={{ ...typeScale.cuerpoDestacado, ...importe, color: c.danger }}>{formatImporte(deuda)}</Text>
        </View>
      ) : null}
      {factura != null ? (
        <View accessibilityLabel="Factura" style={dato}>
          <Text style={rotulo}>{codigoFactura ? `Factura ${codigoFactura}` : 'Factura'}</Text>
          <Text style={{ ...typeScale.cuerpoDestacado, ...importe, color: c.text }}>{formatImporte(factura)}</Text>
        </View>
      ) : null}
      {deuda != null && factura != null ? (
        <View accessibilityLabel="Total" style={{ ...dato, flexBasis: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', backgroundColor: c.brandSoft, borderColor: c.brandInk }}>
          <Text style={rotulo}>Total</Text>
          <Text style={{ ...typeScale.seccion, ...importe, color: c.text }}>{formatImporte(redondear(deuda + factura))}</Text>
        </View>
      ) : null}
    </View>
  )
}

/** "No paga": el mismo tamaño que las otras opciones, en rojo (borde y nombre) porque todo queda como deuda. */
function OpcionNoPaga({ onPress }: { onPress: () => void }) {
  const c = useColors()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel="No paga"
      accessibilityState={{ checked: false }}
      android_ripple={{ color: c.border }}
      style={{ minHeight: 76, justifyContent: 'center', paddingHorizontal: space[4], paddingVertical: space[3], borderRadius: radii.tarjeta, borderWidth: 2, borderColor: c.danger, backgroundColor: c.surface }}
    >
      <Text maxFontSizeMultiplier={maxFontScale} style={{ ...typeScale.seccion, fontSize: 19, lineHeight: 26, color: c.danger }}>No paga</Text>
      <Text maxFontSizeMultiplier={maxFontScale} style={{ ...typeScale.secundario, color: c.textSecondary }}>Todo queda en su cuenta corriente</Text>
    </Pressable>
  )
}

function BotonQuitar({ etiqueta, onPress }: { etiqueta: string; onPress: () => void }) {
  const c = useColors()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      android_ripple={{ color: c.border }}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.campo, borderWidth: 2, borderColor: c.textSecondary }}
    >
      <X size={22} color={c.text} strokeWidth={3} />
    </Pressable>
  )
}
