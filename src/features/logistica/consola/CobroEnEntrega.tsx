import React, { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { PenLine, X } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { Button, formatImporte, Field, Notice, OptionCard } from '@/core/ui/fw'
import type { MedioCobroChofer } from '@/libs/api-client/logistica'
import { leerNumero } from '@/core/utils/numero'
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
  /** Lámina ChoferEntrega: lo que hay que cobrar en la parada (lo decide el servidor). */
  aCobrar?: number | null
  /** Lo que falta cobrar y queda como deuda (chofer-04--mixto), si hay algo que decir. */
  faltaACuenta?: number | null
  /** "Sobran $ X" en rojo bajo los pagos: avisa, no frena. */
  aviso?: string | null
  /** Lo que el cliente ya debía antes de este pedido: una línea roja que solo informa (S18). */
  deudaAnterior?: number | null
  /** "Firma" elegida: lo que no se paga queda como deuda y se saca la foto de la firma (S13). */
  firma: boolean
  firmaUrl: string | null
  onFirma: (firma: boolean) => void
  onFirmaUrl: (url: string) => void
}

/** Lo que se dice de cada forma de pago, en una línea (chofer-04). */
const DETALLE_MEDIO: Partial<Record<string, string>> = { Transferencia: 'Bancaria o billetera · Foto del comprobante', Cheque: 'Foto y datos' }

/**
 * Lámina chofer-04: cómo paga el cliente. Cuatro opciones grandes de 76 px y no más: Efectivo, Transferencia y
 * Cheque (del servidor) y Firma (queda como deuda, con foto). Pagos ya cargados con su X de 44 px y "Sumar
 * otro pago". El servidor imputa y valida.
 */
export function CobroEnEntrega({ medios, mediosError, lineas, onLineas, onSubiendo, hoy, aCobrar, faltaACuenta, aviso, deudaAnterior, firma, firmaUrl, onFirma, onFirmaUrl }: Props) {
  const c = useColors()
  const [agregando, setAgregando] = useState(false)
  const cambiar = (i: number, cambio: Partial<LineaCobroForm>) => onLineas(lineas.map((l, j) => (j === i ? { ...l, ...cambio } : l)))
  const cambiarCheque = (i: number, campo: keyof ChequeForm) => (v: string) =>
    cambiar(i, { cheque: { ...lineas[i].cheque, [campo]: v } })
  const agregar = (medio: MedioCobroChofer) => {
    onLineas([...lineas, { medio, monto: '', fotoUrl: null, cheque: { numero: '', banco: '', titular: '', emision: hoy, pago: hoy } }])
    setAgregando(false)
  }
  const elegirFirma = () => {
    onFirma(true)
    setAgregando(false)
  }
  const hayPagos = lineas.length > 0 || firma
  const elegirMedio = !hayPagos || agregando

  return (
    <View accessibilityLabel="Cobro" style={{ gap: space[3] }}>
      <EncabezadoCobro aCobrar={aCobrar} />
      {deudaAnterior != null && deudaAnterior > 0 ? (
        <View accessibilityLabel="Deuda anterior">
          <Text style={{ ...typeScale.cuerpoDestacado, color: c.danger }}>{`Deuda anterior ${formatImporte(deudaAnterior)}`}</Text>
        </View>
      ) : null}
      {mediosError ? <Notice tone="peligro">No se pudieron cargar los medios de cobro.</Notice> : null}
      {hayPagos ? <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>Pagos de hoy</Text> : null}
      {lineas.map((l, i) => {
        const n = i + 1
        const efectivo = l.medio?.tipo === 'Efectivo'
        const recibido = leerNumero(l.recibido ?? '')
        const monto = leerNumero(l.monto)
        const vuelto = efectivo && recibido != null && monto != null && recibido > monto ? Math.round((recibido - monto) * 100) / 100 : null
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
            {efectivo ? (
              <>
                <View style={{ flexDirection: 'row', gap: space[2] }}>
                  <BotonCorto etiqueta="Te dio" activo={l.recibido !== undefined} onPress={() => cambiar(i, { recibido: l.recibido ?? '' })} />
                  <BotonCorto etiqueta="Justo" activo={l.recibido === undefined} onPress={() => cambiar(i, { recibido: undefined })} />
                </View>
                {l.recibido !== undefined ? (
                  <Field label={`Te dio (cobro ${n})`} value={l.recibido} onChangeText={(v) => cambiar(i, { recibido: v })} keyboardType="decimal-pad" alignRight />
                ) : null}
                {vuelto != null ? (
                  <Text accessibilityLiveRegion="polite" style={{ ...typeScale.cuerpoDestacado, color: c.text, textAlign: 'right' }}>{`Su vuelto ${formatImporte(vuelto)}`}</Text>
                ) : null}
              </>
            ) : null}
            {l.medio?.tipo === 'Cheque' ? (
              <>
                <Field label={`N.º de cheque (cobro ${n})`} value={l.cheque.numero} onChangeText={cambiarCheque(i, 'numero')} />
                <Field label={`Banco (cobro ${n})`} value={l.cheque.banco} onChangeText={cambiarCheque(i, 'banco')} />
                <Field label={`Titular (cobro ${n})`} value={l.cheque.titular} onChangeText={cambiarCheque(i, 'titular')} />
                <Field label={`Fecha de emisión (cobro ${n})`} value={l.cheque.emision} onChangeText={cambiarCheque(i, 'emision')} help="dd/mm/aaaa" />
                <Field label={`Fecha de pago (cobro ${n})`} value={l.cheque.pago} onChangeText={cambiarCheque(i, 'pago')} help="dd/mm/aaaa" />
              </>
            ) : null}
            {l.medio && !efectivo ? (
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
      {firma ? (
        <View accessibilityLabel="Firma" style={{ gap: space[2], padding: space[3], borderRadius: radii.tarjeta, backgroundColor: c.surface, borderWidth: 2, borderColor: c.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typeScale.seccion, color: c.text }}>Firma</Text>
              <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Lo que no paga queda como deuda</Text>
            </View>
            <BotonQuitar etiqueta="Quitar firma" onPress={() => onFirma(false)} />
          </View>
          <FotoEntrega que="de la firma del cliente" url={firmaUrl} onUrl={onFirmaUrl} onSubiendo={onSubiendo} />
        </View>
      ) : null}
      {aviso ? <Text style={{ ...typeScale.cuerpoDestacado, color: c.danger, textAlign: 'right' }}>{aviso}</Text> : null}
      {faltaACuenta ? <Notice tone="info">{`Los ${formatImporte(faltaACuenta)} que faltan quedan en su cuenta corriente.`}</Notice> : null}
      {elegirMedio ? (
        <View accessibilityLabel={hayPagos ? 'Sumar otro pago' : '¿Cómo paga?'} style={{ gap: space[2] }}>
          <Text accessibilityRole="header" style={{ ...typeScale.titulo, fontSize: 24, lineHeight: 32, color: c.text }}>{hayPagos ? 'Sumar otro pago' : '¿Cómo paga?'}</Text>
          {mediosDelChofer(medios).map((m) => (
            <OptionCard key={m.id} label={nombreDelMedio(m)} detail={DETALLE_MEDIO[m.tipo]} onPress={() => agregar(m)} />
          ))}
          {firma ? null : <OptionCard icon={PenLine} label="Firma" detail="Queda como deuda, con foto de la firma" onPress={elegirFirma} />}
          {hayPagos ? <Button label="No sumo otro" variant="secundario" onPress={() => setAgregando(false)} /> : null}
        </View>
      ) : (
        <Button label="Sumar otro pago" variant="secundario" onPress={() => setAgregando(true)} />
      )}
    </View>
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

/** "Te dio" / "Justo": dos botones de 48 px, uno elegido (el vuelto es solo una cuenta en pantalla). */
function BotonCorto({ etiqueta, activo, onPress }: { etiqueta: string; activo: boolean; onPress: () => void }) {
  const c = useColors()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ selected: activo }}
      android_ripple={{ color: c.border }}
      style={{ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radii.campo, borderWidth: 2, borderColor: activo ? c.brand : c.border, backgroundColor: activo ? c.brandSoft : c.surface }}
    >
      <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{etiqueta}</Text>
    </Pressable>
  )
}

function EncabezadoCobro({ aCobrar }: { aCobrar?: number | null }) {
  const c = useColors()
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Text style={{ ...typeScale.seccion, color: c.text }}>Cobro</Text>
      {aCobrar != null ? (
        <Text accessibilityLabel="A cobrar hoy" style={{ ...typeScale.secundario, color: c.textSecondary }}>
          {'A cobrar hoy '}
          <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{formatImporte(aCobrar)}</Text>
        </Text>
      ) : null}
    </View>
  )
}
