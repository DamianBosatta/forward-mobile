import React, { useRef, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { ChevronRight, Plus, X } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { mostrarNumero } from '@/core/utils/numero'
import { Button, Field, FormContainer, Notice, PieFijo, TopBar, formatImporte } from '@/core/ui/fw'
import { usePermissions } from '@/core/auth/RequirePermission'
import { useSocio } from '@/libs/api-client/socios'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { direccionDeEntrega, nombreDelCliente } from '@/features/clientes/lib/cliente'
import { leerNumero } from '@/features/venta-nueva/lib/linea'
import { useEstadoCuentaSocio } from '../api/queries'
import { useMediosDeCobro } from '../api/cobros'
import { armarCobro, type FormCobro } from '../lib/cobro'
import {
  aplicarBorrador, borradorDe, errorDelBorrador, esPrimeraLinea, formCobroVacio, hayCheque, lineasDelCobro, quitarLinea, totalDelCobro,
  type BorradorMedio,
} from '../lib/lineasCobro'
import { usePuedeCobrar } from '../lib/permiso'
import { useEnvioDelCobro } from '../hooks/useEnvioDelCobro'
import { AVISO_IMPUTACION } from './RegistrarCobro'
import { CobroRegistradoPantalla } from './CobroRegistradoPantalla'
import { ElegirChip } from './ElegirChip'
import { ElegirClienteCobro } from './ElegirClienteCobro'
import { ElegirComprobantes } from './ElegirComprobantes'
import { MedioYMonto } from './MedioYMonto'
import { PasosCobro, type PasoCobro } from './PasosCobro'

export const SIN_MEDIOS = 'Agregá al menos un medio.'
export const CHEQUE_VA_SOLO = 'El cheque se carga en un cobro de un solo medio.'

const IMPUTACION = [{ id: 'automatica', label: 'Automática' }, { id: 'manual', label: 'Elegir comprobantes' }]
type Objetivo = 'vencido' | 'saldo'

interface Props {
  /** El cliente ya elegido (lista de Cuentas, cuenta corriente, ficha, "Cobrar ahora", calendario): el paso 1 se salta. */
  socioId?: string
  /** Tesorería > "Cargar un cheque": el primer medio abre con Cheque elegido (una vez; se puede cambiar). */
  medioInicial?: 'cheque'
  onVolver: () => void
}

/**
 * Cobrar en cuatro pasos, como la venta nueva (maqueta "Cobros como venta"): Cliente, Qué se cobra, Medios y
 * Confirmar, más "Medio y monto" para cada medio y "Cobro registrado". Arma el mismo `FormCobro` del formulario de
 * siempre (`RegistrarCobro`, que sigue en la tablet) y lo manda con el mismo envío (`useEnvioDelCobro`): las reglas,
 * la clave de idempotencia y la API no cambian. La imputación y la cuenta (TST o Normal) las decide el servidor.
 */
export function CobroEnPasos({ socioId: socioInicial, medioInicial, onVolver }: Props) {
  const [socioId, setSocioId] = useState<string | null>(socioInicial ?? null)
  // Cambiar de cliente es otro cobro: se monta de nuevo, con otra clave (como el panel de la tablet, `key={socio}`).
  const [paso, setPaso] = useState<PasoCobro>(socioInicial ? 2 : 1)
  const puedeCobrar = usePuedeCobrar()

  if (paso === 1 || !socioId) {
    return (
      <View style={{ flex: 1 }}>
        <TopBar title="Cobrar" leading={{ kind: 'atras', onPress: onVolver }} />
        <PasosCobro paso={1} />
        <ElegirClienteCobro seleccionadoId={socioId} onElegir={setSocioId} puedeCobrar={puedeCobrar} onContinuar={() => setPaso(2)} />
      </View>
    )
  }
  return (
    <CobroDelCliente
      key={socioId}
      socioId={socioId}
      medioInicial={medioInicial}
      paso={paso}
      onPaso={setPaso}
      onVolver={socioInicial ? onVolver : () => setPaso(1)}
      onSalir={onVolver}
    />
  )
}

interface PropsDelCliente {
  socioId: string
  medioInicial?: 'cheque'
  paso: PasoCobro
  onPaso: (p: PasoCobro) => void
  /** Atrás desde el paso 2: sale (cliente ya elegido) o vuelve a elegir cliente. */
  onVolver: () => void
  onSalir: () => void
}

function CobroDelCliente({ socioId, medioInicial, paso, onPaso, onVolver, onSalir }: PropsDelCliente) {
  const c = useColors()
  const socio = useSocio(socioId)
  const estado = useEstadoCuentaSocio(socioId, !!socio.data?.puedeVerCuentaCorriente)
  const medios = useMediosDeCobro()
  const [f, setF] = useState<FormCobro>(formCobroVacio)
  // Objetivo del cobro: solo una guía visual de cuánto falta; no entra al payload (ni a la clave de idempotencia).
  const [objetivo, setObjetivo] = useState<Objetivo | null>(null)
  // "Medio y monto" abierto: la línea que se edita (null = una nueva) y su borrador.
  const [editor, setEditor] = useState<{ indice: number | null; borrador: BorradorMedio } | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const medioInicialAplicado = useRef(false)
  const { registrar, cajas, sinCajaUtil, aviso, cobro, enviar, reiniciar } = useEnvioDelCobro(socioId, f, !!editor?.borrador.requiereCaja)
  const { hasCapability, canDo } = usePermissions()
  // POST Media/upload-cheque: quien cobra (MOD_PAGOS:Create) o quien gestiona cheques (MediaController).
  const subeFotoCheque = canDo('MOD_PAGOS', 'create') || hasCapability('CAP_GESTIONAR_CHEQUES')

  if (socio.isLoading) return <ActivityIndicator style={{ marginTop: space[8] }} color={c.brandInk} />
  if (!socio.data) {
    return (
      <View style={{ flex: 1 }}>
        <TopBar title="Cobrar" leading={{ kind: 'atras', onPress: onVolver }} />
        <View style={{ padding: space[4] }}><Notice tone="peligro">{mensajeDelServidor(socio.error, 'No se pudo abrir el cliente.')}</Notice></View>
      </View>
    )
  }
  const cliente = socio.data
  const nombreMedio = (id: string | null) => medios.data?.find(m => m.id === id)?.nombre ?? ''
  const lineas = lineasDelCobro(f)
  const total = totalDelCobro(f)
  const otros = total - (leerNumero(f.monto) ?? 0)
  const deudaVencida = estado.data?.deudaVencida ?? 0
  const saldoActual = estado.data?.saldoActual ?? 0
  const meta = objetivo === 'vencido' ? deudaVencida : objetivo === 'saldo' ? saldoActual : 0
  const falta = Math.max(meta - total, 0)
  const ocupado = registrar.isPending || subiendo
  const abiertas = cajas.data ?? []
  const nombreCaja = (id: string | null) => abiertas.find(k => k.depositoId === (id ?? (abiertas.length === 1 ? abiertas[0].depositoId : null)))?.depositoNombre ?? null

  if (cobro) {
    return (
      <CobroRegistradoPantalla
        cliente={cliente}
        cobro={cobro}
        monto={total}
        medio={lineas.map(l => nombreMedio(l.medioPagoId)).filter(Boolean).join(' + ')}
        lineas={lineas.flatMap(l => {
          const m = leerNumero(l.monto)
          return m ? [{ medio: nombreMedio(l.medioPagoId), monto: m }] : []
        })}
        imputacionManual={!!f.imputaciones}
        onVolver={onSalir}
        onOtro={() => { reiniciar(); setF(formCobroVacio()); setObjetivo(null); onPaso(2) }}
      />
    )
  }

  // ── "Medio y monto" ──
  const abrirMedio = (indice: number | null) => {
    let b = borradorDe(f, indice)
    if (indice === null) {
      // El objetivo precarga el monto (lo que falta para cubrirlo), como el formulario precarga el del primer medio.
      if (falta > 0) b = { ...b, monto: mostrarNumero(falta) }
      const cheque = medioInicial === 'cheque' && !medioInicialAplicado.current && esPrimeraLinea(f, null) ? medios.data?.find(m => m.activo && m.id && m.esCheque) : undefined
      if (cheque) {
        medioInicialAplicado.current = true
        b = { ...b, medioPagoId: cheque.id!, esCheque: true, requiereCaja: !!cheque.requiereCaja }
      }
    }
    setEditor({ indice, borrador: b })
  }
  if (editor) {
    const { indice, borrador } = editor
    const conCajas = borrador.requiereCaja
    const motivoCaja = !conCajas ? null
      : cajas.isLoading || cajas.error || !cajas.data || abiertas.length === 0 ? 'Sin una caja abierta no se cobra en efectivo.'
        : abiertas.length > 1 && !f.depositoId ? 'Elegí en qué caja entra el efectivo.' : null
    const motivo = errorDelBorrador(f, indice, borrador) ?? motivoCaja ?? (subiendo ? 'Esperá a que termine de subir la foto.' : null)
    return (
      <MedioYMonto
        medios={medios.data ?? []}
        cargandoMedios={medios.isLoading}
        errorMedios={medios.error}
        borrador={borrador}
        onCambio={b => setEditor({ indice, borrador: b })}
        primera={esPrimeraLinea(f, indice)}
        cajas={cajas}
        depositoId={f.depositoId}
        onCaja={id => setF(p => ({ ...p, depositoId: id }))}
        subeFotoCheque={subeFotoCheque}
        onSubiendo={setSubiendo}
        motivo={motivo}
        editando={indice !== null}
        onGuardar={() => { if (!motivo) { setF(p => aplicarBorrador(p, indice, borrador)); setEditor(null) } }}
        onQuitar={() => { if (indice !== null) setF(p => quitarLinea(p, indice)); setEditor(null) }}
        onVolver={() => setEditor(null)}
      />
    )
  }

  const fijarObjetivo = (o: Objetivo | null) => {
    setObjetivo(o)
    if (!o || !f.medioPagoId) return
    // Con el primer medio ya cargado, el objetivo le pone el monto (la meta menos lo que llevan los otros), como siempre.
    const m = o === 'vencido' ? deudaVencida : saldoActual
    setF(p => ({ ...p, monto: mostrarNumero(Math.max(m - otros, 0)) }))
  }

  const secundario = { ...typeScale.secundario, color: c.textSecondary }
  const tarjeta = { gap: space[2], backgroundColor: c.surface, borderRadius: radii.tarjeta, borderWidth: 1, borderColor: c.border, padding: space[4] }
  const montoAccesible = (label: string, n: number, destacado = false) => (
    <View accessible accessibilityLabel={`${label}: ${formatImporte(n)}`} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space[3] }}>
      <Text style={destacado ? { ...typeScale.cuerpoDestacado, color: c.text } : secundario}>{label}</Text>
      <Text style={[destacado ? typeScale.cuerpoDestacado : typeScale.cuerpo, importe, { color: c.text }]}>{formatImporte(n)}</Text>
    </View>
  )
  const pie = (arriba: string, abajo: string, importeDelPie: number, boton: React.ReactNode, aclaracion?: React.ReactNode) => (
    <PieFijo>
      {aclaracion}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] }}>
        <View style={{ flex: 1 }}>
          {arriba ? <Text style={secundario}>{arriba}</Text> : null}
          <Text style={secundario}>{abajo}</Text>
        </View>
        <Text style={[typeScale.titulo, importe, { color: c.text }]}>{formatImporte(importeDelPie)}</Text>
      </View>
      {boton}
    </PieFijo>
  )
  const comprobantes = f.imputaciones ? Object.values(f.imputaciones) : []
  const imputado = comprobantes.reduce((s, t) => s + Math.max(leerNumero(t) ?? 0, 0), 0)
  const textoImputado = f.imputaciones
    ? `${comprobantes.length} ${comprobantes.length === 1 ? 'comprobante' : 'comprobantes'} · imputado ${formatImporte(imputado)}`
    : ''

  let cuerpo: React.ReactNode
  let pieDelPaso: React.ReactNode
  if (paso === 2) {
    const opcionesObjetivo = [
      ...(deudaVencida > 0 ? [{ id: 'vencido', label: 'Todo lo vencido' }] : []),
      ...(saldoActual > 0 ? [{ id: 'saldo', label: 'Saldo total' }] : []),
    ]
    cuerpo = (
      <>
        {estado.data ? (
          <View style={tarjeta}>
            {montoAccesible('Vencido', deudaVencida, true)}
            {montoAccesible('Saldo del cliente', saldoActual)}
          </View>
        ) : null}
        {opcionesObjetivo.length > 0 ? (
          <ElegirChip
            titulo="Cobrás"
            tituloVisible
            opciones={[...opcionesObjetivo, { id: 'otro', label: 'Otro monto' }]}
            valor={objetivo ?? 'otro'}
            onCambio={id => fijarObjetivo(id === 'otro' ? null : (id as Objetivo))}
          />
        ) : null}
        <ElegirChip
          titulo="Se aplica a"
          tituloVisible
          opciones={IMPUTACION}
          valor={f.imputaciones ? 'manual' : 'automatica'}
          onCambio={id => setF(p => ({ ...p, imputaciones: id === 'manual' ? (p.imputaciones ?? {}) : null }))}
        />
        {f.imputaciones ? (
          <ElegirComprobantes socioId={socioId} valor={f.imputaciones} onCambio={v => setF(p => ({ ...p, imputaciones: v }))} />
        ) : (
          <Notice tone="info">{AVISO_IMPUTACION}</Notice>
        )}
      </>
    )
    pieDelPaso = pie(textoImputado, 'Cobrás', total > 0 ? total : meta, <Button label="Continuar a medios" iconoFinal={ChevronRight} onPress={() => onPaso(3)} />)
  } else if (paso === 3) {
    const r = armarCobro(socioId, f)
    const error = lineas.length === 0 ? SIN_MEDIOS : 'error' in r ? r.error : null
    const conCheque = hayCheque(f)
    cuerpo = (
      <>
        {lineas.map(l => {
          const nombre = nombreMedio(l.medioPagoId)
          const monto = leerNumero(l.monto) ?? 0
          const detalle = l.requiereCaja ? nombreCaja(f.depositoId)
            : l.indice === 0 && f.esCheque ? [f.cheque.numero && `N.º ${f.cheque.numero}`, f.cheque.banco].filter(Boolean).join(' · ')
              : l.indice === 0 && f.comprobanteUrl ? 'Foto del comprobante cargada' : null
          return (
            <View key={l.indice} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], borderRadius: radii.tarjeta, borderWidth: 2, borderColor: c.brand, backgroundColor: c.surface }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Editar ${nombre}, ${formatImporte(monto)}`}
                onPress={() => abrirMedio(l.indice)}
                android_ripple={{ color: c.border }}
                style={{ flex: 1, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingLeft: space[4], paddingVertical: space[3] }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{nombre}</Text>
                  {detalle ? <Text style={secundario}>{detalle}</Text> : null}
                </View>
                <Text style={[typeScale.cuerpoDestacado, importe, { color: c.text }]}>{formatImporte(monto)}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Quitar ${nombre}`}
                disabled={ocupado}
                onPress={() => setF(p => quitarLinea(p, l.indice))}
                android_ripple={{ color: c.border, borderless: true }}
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: space[2] }}
              >
                <X size={20} color={c.textSecondary} />
              </Pressable>
            </View>
          )
        })}
        {conCheque ? <Notice tone="info">{CHEQUE_VA_SOLO}</Notice> : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={lineas.length ? 'Agregar otro medio' : 'Agregar un medio'}
            onPress={() => abrirMedio(null)}
            android_ripple={{ color: c.border }}
            style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2], borderRadius: radii.tarjeta, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border }}
          >
            <Plus size={20} color={c.brandInk} />
            <Text style={{ ...typeScale.cuerpoDestacado, color: c.brandInk }}>{lineas.length ? 'Agregar otro medio' : 'Agregar un medio'}</Text>
          </Pressable>
        )}
        <View style={tarjeta}>
          {montoAccesible('Cobrás', total)}
          {objetivo && meta > 0 ? montoAccesible('Cubierto', Math.min(total, meta), true) : null}
          {objetivo && meta > 0 ? montoAccesible('Falta', falta) : null}
        </View>
        {lineas.length > 0 && error ? <Notice tone="peligro">{error}</Notice> : null}
      </>
    )
    pieDelPaso = pie(
      `${lineas.length} ${lineas.length === 1 ? 'medio' : 'medios'}`,
      objetivo && meta > 0 ? (falta > 0 ? `Falta ${formatImporte(falta)}` : 'Cubierto') : 'Cobrás',
      total,
      <Button label="Continuar a confirmar" iconoFinal={ChevronRight} disabled={!!error} onPress={() => onPaso(4)} />,
    )
  } else {
    cuerpo = (
      <>
        <Field label="Referencia (opcional)" value={f.referencia} onChangeText={v => setF(p => ({ ...p, referencia: v }))} help="Por ejemplo, el N.º de operación" />
        <View style={tarjeta}>
          <Text accessibilityRole="header" style={{ ...typeScale.seccion, color: c.text }}>Resumen</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[3] }}>
            <Text style={secundario}>Cliente</Text>
            <Text style={{ ...typeScale.cuerpo, color: c.text, flexShrink: 1, textAlign: 'right' }}>{nombreDelCliente(cliente)}</Text>
          </View>
          {lineas.map(l => (
            <React.Fragment key={l.indice}>
              {montoAccesible([nombreMedio(l.medioPagoId), l.requiereCaja ? nombreCaja(f.depositoId) : null].filter(Boolean).join(' · '), leerNumero(l.monto) ?? 0)}
            </React.Fragment>
          ))}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[3] }}>
            <Text style={secundario}>Se aplica a</Text>
            <Text style={{ ...typeScale.cuerpo, color: c.text }}>{f.imputaciones ? textoImputado : 'Automática'}</Text>
          </View>
          {montoAccesible('Total', total, true)}
        </View>
        {f.imputaciones ? null : <Notice tone="info">{AVISO_IMPUTACION}</Notice>}
        {aviso ? <Notice tone="advertencia">{aviso}</Notice> : null}
        {registrar.error ? <Notice tone="peligro">{mensajeDelServidor(registrar.error, 'No se pudo registrar el cobro.')}</Notice> : null}
      </>
    )
    pieDelPaso = (
      <PieFijo>
        <Text style={secundario}>Queda registrado en la cuenta corriente del cliente</Text>
        <Button
          label={total > 0 ? `Registrar cobro de ${formatImporte(total)}` : 'Registrar cobro'}
          loading={registrar.isPending}
          disabled={ocupado || sinCajaUtil}
          onPress={() => enviar(subiendo)}
        />
      </PieFijo>
    )
  }

  const atras = () => (paso === 2 ? onVolver() : onPaso((paso - 1) as PasoCobro))
  return (
    <View style={{ flex: 1 }}>
      <TopBar
        lineasMultiples
        title={direccionDeEntrega(cliente)}
        subtitle={paso === 2 && estado.data ? `${nombreDelCliente(cliente)} · Saldo ${formatImporte(saldoActual)}` : nombreDelCliente(cliente)}
        leading={{ kind: 'atras', onPress: atras }}
      />
      <PasosCobro paso={paso} />
      <ScrollView contentContainerStyle={{ padding: space[4] }} keyboardShouldPersistTaps="handled">
        <FormContainer style={{ gap: space[4] }}>{cuerpo}</FormContainer>
      </ScrollView>
      {pieDelPaso}
    </View>
  )
}
