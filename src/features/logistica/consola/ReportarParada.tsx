import React, { useEffect, useState } from 'react'
import { Modal, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { importe, space, typeScale, useColors } from '@/libs/theme'
import { Check, Plus } from 'lucide-react-native'
import { BottomSheet, Button, Field, Notice, OptionCard, PieFijo, TopBar, formatImporte } from '@/core/ui/fw'
import { safeHaptics } from '@/core/utils/haptics'
import { MotivoDeshabilitado } from '@/core/ui/fw/MotivoDeshabilitado'
import type { ParadaDto } from '@/libs/api-client/types'
import { useLineasParada, useMediosCobroChofer } from '@/libs/api-client/logistica'
import { mostrarFecha } from '@/features/cuentas/lib/cobro'
import { leerNumero } from '@/core/utils/numero'
import { diaArgentina } from '@/core/utils/fecha'
import { DETALLE_MOTIVO_NO_ENTREGA, MOTIVOS_NO_ENTREGA } from './hojaDeRuta'
import { etiquetaNota, importeParada } from './cobroParada'
import { armarEntrega, montoDeLinea, razonPendiente, type EntregaArmada, type FormEntrega } from './entrega'
import { razonCobro, razonDevolucionPaso, razonConfirmar, avisoDeCobro, comparacionDeCobro, faltaACuenta, posicionDePaso, sinCobroDeDinero, totalRepartido, type ContextoCobro, type Paso } from './pasosEntrega'
import { FotoEntrega } from './FotoEntrega'
import { FirmarRemito } from './FirmarRemito'
import { CobroEnEntrega } from './CobroEnEntrega'
import { DevolucionEnEntrega, DevolucionEnviada, EleccionDevolucion } from './DevolucionEnEntrega'
import { ContadorCobro } from './ContadorCobro'
import { ResumenEntrega } from './ResumenEntrega'

export type ReporteParada =
  | { entregado: true; entrega: EntregaArmada }
  | { entregado: false; motivoRechazo?: string; observaciones?: string; evidenciaUrl?: string }

interface Props {
  /** La hoja de la parada: las líneas a devolver se piden por la hoja, no por la venta. */
  hojaDeRutaId: string
  parada: ParadaDto
  numero: number
  enviando: boolean
  error: string | null
  /** El interruptor `ExigirFotoRemitoAlEntregar` del servidor (viene en la hoja). */
  exigeFotoRemito: boolean
  /** Lo decide la pantalla "Llegué": "Entregué todo" o "No pude entregar". */
  resultadoInicial?: Resultado
  onCerrar: () => void
  onConfirmar: (r: ReporteParada) => void
}

export type Resultado = 'entregado' | 'noEntregado'

const formVacio = (): FormEntrega => ({
  receptor: '', observaciones: '', remitoUrl: null, lineas: [], devolucion: {},
})

const TITULO_PASO: Record<Paso, string> = { devolucion: 'Devoluciones', cobro: 'Cobro', confirmar: 'Cerrar entrega' }

/**
 * Láminas chofer-03 a chofer-05 de la entrega: devoluciones, cobro y cerrar la entrega (llegué es el paso 1 y
 * vive afuera). Todo lo cargado vive acá: volver no pierde nada. Se cierra una sola vez, al final ("Cerrar entrega",
 * S8), con la misma operación única de siempre. "No pude entregar" se confirma desde su única pantalla. Monta una
 * vez por parada: el estado arranca limpio.
 */
export function ReportarParada({ hojaDeRutaId, parada, numero, enviando, error, exigeFotoRemito, resultadoInicial = 'entregado', onCerrar, onConfirmar }: Props) {
  const c = useColors()
  // Tablet: los pasos van en una columna centrada, no se estiran a todo el ancho.
  const { width } = useWindowDimensions()
  const columna = width >= 768 ? { maxWidth: 640, width: '100%' as const, alignSelf: 'center' as const } : null
  const [resultado] = useState<Resultado>(resultadoInicial)
  const [paso, setPaso] = useState<Paso>('devolucion')
  const [f, setF] = useState<FormEntrega>(formVacio)
  const [hayDevolucion, setHayDevolucion] = useState<boolean | null>(null)
  /** Pantalla "Devolución enviada": después de marcar lo que devuelve y antes del cobro. */
  const [devEnviada, setDevEnviada] = useState(false)
  /** Hoja "¿Cerrás la entrega?": la entrega no se manda hasta el "Sí, cerrar". */
  const [confirmando, setConfirmando] = useState(false)
  const [motivo, setMotivo] = useState<string | null>(null)
  /** Lámina ChoferNoEntrega (C5): foto del lugar, opcional, ya subida. */
  const [lugarUrl, setLugarUrl] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(0)
  /** "¿Sumar otro cobro?": la pregunta que sigue a "Continuar" en el cobro cuando ya se cargó algo. */
  const [preguntandoOtro, setPreguntandoOtro] = useState(false)
  /** Vino de "Sí": la pantalla de cobro abre directo en la elección del medio. */
  const [sumandoOtro, setSumandoOtro] = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)
  const entregado = resultado === 'entregado'
  const medios = useMediosCobroChofer(entregado)
  // Quien ve la hoja ve las líneas de sus paradas: el chofer con solo viajes también devuelve.
  const renglones = useLineasParada(hojaDeRutaId, parada.id, entregado)

  const cambiar = (cambio: Partial<FormEntrega>) => setF((p) => ({ ...p, ...cambio }))
  const alSubir = (s: boolean) => setSubiendo((n) => n + (s ? 1 : -1))
  const aCobrar = importeParada(parada)
  const disponibles = Object.fromEntries((renglones.data ?? []).map((r) => [r.ventaDetalleId ?? '', r.cantidadDisponible ?? 0]))
  // Con "No, todo bien" las cantidades que se hayan cargado antes no viajan (pero se conservan por si vuelve).
  const lineas = f.lineas
  // Sin dinero cobrado ("No paga") la firma (foto del remito firmado) es obligatoria para cerrar (S8).
  const sinCobro = sinCobroDeDinero(lineas)
  const remitoObligatorio = exigeFotoRemito || sinCobro
  const form: FormEntrega = { ...f, lineas, devolucion: hayDevolucion ? f.devolucion : {} }

  const eligiendo = entregado && paso === 'devolucion' && hayDevolucion !== true
  const enviada = entregado && paso === 'devolucion' && hayDevolucion === true && devEnviada
  const pos = posicionDePaso(paso)
  const ctxCobro: ContextoCobro = {
    lineas,
    aCobrar: aCobrar.aCobrar ? aCobrar.valor : null, hayDevolucion: hayDevolucion === true, subiendo: subiendo > 0,
  }
  let razon: string | null
  if (!entregado) razon = razonPendiente({ entregado: false, motivo, subiendo: subiendo > 0 })
  else if (paso === 'devolucion') razon = razonDevolucionPaso(hayDevolucion, f.devolucion, disponibles)
  else if (paso === 'cobro') razon = razonCobro(ctxCobro)
  else razon = razonConfirmar({ exigeFotoRemito, sinCobro, remitoUrl: f.remitoUrl, subiendo: subiendo > 0 })
  const listo = razon === null
  const ultimo = !entregado || paso === 'confirmar'

  const atras = () => {
    if (!entregado) return onCerrar()
    if (paso === 'confirmar') return setPaso('cobro')
    if (paso === 'cobro' && preguntandoOtro) return setPreguntandoOtro(false)
    if (paso === 'cobro') {
      setDevEnviada(false)
      // Con "Sí, devuelve" se vuelve a los productos; con "No, todo bien", a la pregunta.
      if (hayDevolucion === false) setHayDevolucion(null)
      return setPaso('devolucion')
    }
    if (devEnviada) return setDevEnviada(false)
    if (hayDevolucion === true) return setHayDevolucion(null)
    return onCerrar()
  }
  const seguir = () => {
    if (!listo) return
    setErrorForm(null)
    // Marcó una devolución: se le dice que quedó enviada y de ahí sigue con el cobro.
    if (paso === 'devolucion') return setDevEnviada(true)
    // Ya cargó un cobro: se pregunta si suma otro antes de pasar a cerrar.
    if (paso === 'cobro' && lineas.length > 0) return setPreguntandoOtro(true)
    setPaso('confirmar')
  }
  const elegirDevolucion = (hay: boolean) => {
    setHayDevolucion(hay)
    if (!hay) setPaso('cobro')
    setDevEnviada(false)
  }

  const sumarOtro = (si: boolean) => {
    setPreguntandoOtro(false)
    setSumandoOtro(si)
    if (!si) setPaso('confirmar')
  }

  const confirmar = () => {
    if (!listo || enviando) return
    setErrorForm(null)
    if (!entregado) {
      safeHaptics.notification('warning')
      onConfirmar({ entregado: false, motivoRechazo: motivo ?? undefined, observaciones: (motivo === 'Otro' ? f.observaciones.trim() : '') || undefined, evidenciaUrl: lugarUrl ?? undefined })
      return
    }
    const r = armarEntrega(form, { exigeFotoRemito: remitoObligatorio, disponibles })
    if ('error' in r) {
      setConfirmando(false)
      setErrorForm(r.error)
      return
    }
    onConfirmar({ entregado: true, entrega: r.entrega })
  }

  // Un error del servidor se ve en la pantalla de confirmar, no detrás de la hoja.
  useEffect(() => {
    if (error) setConfirmando(false)
  }, [error])

  const cmp = comparacionDeCobro(ctxCobro)
  const aCobrarHoy = aCobrar.aCobrar ? aCobrar.valor : null
  const cobrado = totalRepartido(lineas)
  // "No pagó · $ X a su CC" (S8): la deuda anterior más esta factura. Con devolución la cuenta la hace el servidor.
  const deudaAnterior = parada.deudaAnterior != null && parada.deudaAnterior > 0 ? parada.deudaAnterior : 0
  const aSuCuenta = aCobrarHoy != null && !hayDevolucion ? Math.round((deudaAnterior + aCobrarHoy) * 100) / 100 : null
  // "Recibió Marta · cobrado $ 1.000,00.": solo lo que hay; sin nombre y sin cobro no se agrega nada.
  const partes = [f.receptor.trim() ? `Recibió ${f.receptor.trim()}` : null, cobrado > 0 ? `cobrado ${formatImporte(cobrado)}` : null].filter(Boolean).join(' · ')
  const resumenDeConfirmacion = partes ? ` ${partes.charAt(0).toUpperCase()}${partes.slice(1)}.` : ''

  return (
    <Modal visible animationType="slide" onRequestClose={atras}>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar
          title={entregado ? parada.clienteNombre : 'No pude entregar'}
          subtitle={entregado
            ? `Paso ${pos.numero} de ${pos.total} · ${TITULO_PASO[paso]} · ${parada.direccion}`
            : `Parada ${numero} · ${parada.direccion} · ${parada.clienteNombre}`}
          leading={{ kind: 'atras', onPress: atras }}
        />
        {entregado && paso === 'cobro' && !preguntandoOtro && aCobrarHoy != null ? (
          <View style={columna ?? undefined}>
            <ContadorCobro cobrado={cobrado} falta={Math.max(0, Math.round((aCobrarHoy - cobrado) * 100) / 100)} />
          </View>
        ) : null}
        <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4], ...columna }} keyboardShouldPersistTaps="handled">
          {!entregado ? (
            <>
              <View accessibilityLabel="Motivo" style={{ gap: space[3] }}>
                <Text accessibilityRole="header" style={{ ...typeScale.titulo, fontSize: 24, lineHeight: 32, color: c.text }}>¿Por qué no pudiste entregar?</Text>
                {MOTIVOS_NO_ENTREGA.map((m) => (
                  <OptionCard key={m} label={m} detail={DETALLE_MOTIVO_NO_ENTREGA[m]} selected={motivo === m} onPress={() => setMotivo(m)} />
                ))}
                <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>Ventas reprograma la entrega. Vos seguís con la próxima parada.</Text>
              </View>
              <FotoEntrega
                que="del lugar"
                titulo="Foto del lugar"
                guia="Encuadrá el frente del lugar, con la puerta y el número a la vista"
                lugar={parada.direccion}
                url={lugarUrl}
                onUrl={setLugarUrl}
                onSubiendo={alSubir}
              />
              {motivo === 'Otro' ? (
                <Field label="Observaciones" value={f.observaciones} onChangeText={(v) => cambiar({ observaciones: v })} placeholder="Algo que la oficina tenga que saber" />
              ) : null}
            </>
          ) : null}
          {eligiendo ? <EleccionDevolucion valor={hayDevolucion} onElegir={elegirDevolucion} /> : null}
          {enviada ? <DevolucionEnviada onSeguir={() => { setDevEnviada(false); setPaso('cobro') }} /> : null}
          {entregado && paso === 'devolucion' && hayDevolucion === true && !devEnviada ? (
            <DevolucionEnEntrega
              renglones={renglones.data}
              cargando={renglones.isLoading}
              conError={renglones.isError}
              valores={f.devolucion}
              onCambio={(id, v) => cambiar({ devolucion: { ...f.devolucion, [id]: v } })}
              motivo={f.motivoDevolucion ?? null}
              onMotivo={(m) => cambiar({ motivoDevolucion: m })}
            />
          ) : null}
          {entregado && paso === 'cobro' && preguntandoOtro ? (
            <View accessibilityLabel="¿Sumar otro cobro?" style={{ gap: space[3] }}>
              <Text accessibilityRole="header" style={{ ...typeScale.titulo, fontSize: 24, lineHeight: 32, color: c.text }}>¿Sumar otro cobro?</Text>
              <OptionCard minHeight={132} icon={Plus} label="Sí" detail="Cargá otro pago" onPress={() => sumarOtro(true)} />
              <OptionCard minHeight={132} icon={Check} label="No" detail="Seguí a cerrar la entrega" onPress={() => sumarOtro(false)} />
            </View>
          ) : null}
          {entregado && paso === 'cobro' && !preguntandoOtro ? (
            <>
              <CobroEnEntrega
                elegirAlEntrar={sumandoOtro}
                medios={medios.data}
                mediosError={medios.isError}
                lineas={f.lineas}
                onLineas={(l) => cambiar({ lineas: l })}
                onSubiendo={alSubir}
                aCobrar={aCobrarHoy}
                hoy={mostrarFecha(diaArgentina(Date.now()))}
                faltaACuenta={faltaACuenta(ctxCobro)}
                aviso={avisoDeCobro(ctxCobro)}
                deudaAnterior={parada.deudaAnterior}
                onNoPaga={() => {
                  setErrorForm(null)
                  setPaso('confirmar')
                }}
              />
              {cmp && hayDevolucion ? (
                <Notice tone="info">La devolución se descuenta de lo que hay que cobrar: el servidor hace la cuenta cuando la autoriza el depósito.</Notice>
              ) : null}
            </>
          ) : null}
          {entregado && paso === 'confirmar' ? (
            <>
              {sinCobro ? (
                <View accessibilityLabel="No pagó" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[2] }}>
                  <Text style={{ ...typeScale.seccion, color: c.text }}>No pagó</Text>
                  {aSuCuenta != null ? (
                    <Text style={{ ...typeScale.cuerpoDestacado, ...importe, color: c.danger }}>{`${formatImporte(aSuCuenta)} a su CC`}</Text>
                  ) : null}
                </View>
              ) : null}
              <FirmarRemito
                obligatoria={remitoObligatorio}
                referencia={etiquetaNota(parada) ? `Remito ${etiquetaNota(parada)}` : undefined}
                lugar={parada.direccion}
                url={f.remitoUrl}
                onUrl={(url) => cambiar({ remitoUrl: url })}
                onSubiendo={alSubir}
              />
              <Field label="Quién recibió" value={f.receptor} onChangeText={(v) => cambiar({ receptor: v })} placeholder="Opcional: nombre de quien recibe" />
              <Field label="Observaciones" value={f.observaciones} onChangeText={(v) => cambiar({ observaciones: v })} placeholder="Algo que la oficina tenga que saber" />
              <ResumenEntrega
                d={{
                  receptor: f.receptor.trim(),
                  conFotoRemito: !!f.remitoUrl,
                  devueltos: (renglones.data ?? [])
                    .map((r) => ({ nombre: r.productoNombre ?? 'Producto', cantidad: leerNumero(form.devolucion[r.ventaDetalleId ?? ''] ?? '') ?? 0 }))
                    .filter((x) => x.cantidad > 0),
                  cobros: lineas.map((l) => ({ medio: l.medio?.nombre ?? '', monto: montoDeLinea(l) ?? 0, conFoto: !!l.fotoUrl })),
                }}
              />
            </>
          ) : null}
          {errorForm ? <Notice tone="peligro">{errorForm}</Notice> : null}
          {error && ultimo ? <Notice tone="peligro">{error}</Notice> : null}
        </ScrollView>
        {eligiendo || enviada || preguntandoOtro ? null : (
          <PieFijo conInsetInferior>
            <View style={{ gap: space[2], ...columna }}>
              {razon ? <MotivoDeshabilitado>{razon}</MotivoDeshabilitado> : null}
              <Button
                size="xl"
                label={!entregado ? 'Avisar a Ventas' : ultimo ? 'Cerrar entrega' : 'Continuar'}
                disabled={!listo}
                loading={ultimo && enviando}
                onPress={!ultimo ? seguir : entregado ? () => setConfirmando(true) : confirmar}
              />
            </View>
          </PieFijo>
        )}
      </View>
      <BottomSheet visible={confirmando} onClose={() => setConfirmando(false)} accessibilityLabel="Cerrar la entrega">
        <Text style={{ ...typeScale.seccion, color: c.text }}>¿Cerrás la entrega?</Text>
        <Text style={{ ...typeScale.cuerpo, color: c.textSecondary }}>{`Después no se puede deshacer.${resumenDeConfirmacion}`}</Text>
        <Button label="Sí, cerrar" loading={enviando} onPress={confirmar} />
        <Button label="Revisar" variant="secundario" onPress={() => setConfirmando(false)} />
      </BottomSheet>
    </Modal>
  )
}
