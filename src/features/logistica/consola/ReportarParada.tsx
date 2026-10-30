import React, { useRef, useState } from 'react'
import { Modal, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { space, typeScale, useColors } from '@/libs/theme'
import { Button, Field, Notice, OptionCard, TopBar } from '@/core/ui/fw'
import { safeHaptics } from '@/core/utils/haptics'
import { MotivoDeshabilitado } from '@/core/ui/fw/MotivoDeshabilitado'
import type { ParadaDto } from '@/libs/api-client/types'
import { useLineasParada, useMediosCobroChofer } from '@/libs/api-client/logistica'
import { mostrarFecha } from '@/features/cuentas/lib/cobro'
import { leerNumero } from '@/src/utils/numero'
import { diaArgentina } from '@/src/utils/date'
import { DETALLE_MOTIVO_NO_ENTREGA, MOTIVOS_NO_ENTREGA } from './hojaDeRuta'
import { etiquetaNota, importeParada } from './cobroParada'
import { armarEntrega, observacionesDeEntrega, razonPendiente, type EntregaArmada, type FormEntrega } from './entrega'
import { razonCobro, razonDevolucionPaso, razonConfirmar, avisoDeCobro, comparacionDeCobro, faltaACuenta, posicionDePaso, totalRepartido, type ContextoCobro, type Paso } from './pasosEntrega'
import { FotoEntrega } from './FotoEntrega'
import { CobroEnEntrega } from './CobroEnEntrega'
import { DevolucionEnEntrega, EleccionDevolucion } from './DevolucionEnEntrega'
import { ContadorCobro } from './ContadorCobro'
import { FirmaEnEntrega } from './FirmaEnEntrega'
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
  receptor: '', observaciones: '', remitoUrl: null, lineas: [], imputacion: 'PedidoActual', firmaUrl: null, devolucion: {},
})

const TITULO_PASO: Record<Paso, string> = { devolucion: 'Devoluciones', cobro: 'Cobro', confirmar: 'Confirmar' }

/**
 * Láminas chofer-03 a chofer-05 de la entrega: devoluciones, cobro y confirmar (llegué es el paso 1 y
 * vive afuera). Todo lo cargado vive acá: volver no pierde nada. Se confirma una sola vez, al final, con
 * la misma operación única de siempre. "No pude entregar" se confirma desde su única pantalla. Monta una
 * vez por parada: el estado arranca limpio.
 */
export function ReportarParada({ hojaDeRutaId, parada, numero, enviando, error, exigeFotoRemito, resultadoInicial = 'entregado', onCerrar, onConfirmar }: Props) {
  const c = useColors()
  const { bottom } = useSafeAreaInsets()
  // Tablet: los pasos van en una columna centrada, no se estiran a todo el ancho.
  const { width } = useWindowDimensions()
  const columna = width >= 768 ? { maxWidth: 640, width: '100%' as const, alignSelf: 'center' as const } : null
  const [resultado] = useState<Resultado>(resultadoInicial)
  const [paso, setPaso] = useState<Paso>('devolucion')
  const [f, setF] = useState<FormEntrega>(formVacio)
  const [hayDevolucion, setHayDevolucion] = useState<boolean | null>(null)
  const [firmar, setFirmar] = useState(false)
  const firmarRef = useRef(false)
  const [motivo, setMotivo] = useState<string | null>(null)
  /** Lámina ChoferNoEntrega (C5): foto del lugar, opcional, ya subida. */
  const [lugarUrl, setLugarUrl] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(0)
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
  // La firma solo viaja con la casilla tildada y con foto: la foto es opcional y sin ella no se manda nada.
  // Con "Cuenta corriente" las líneas cargadas no viajan (se conservan por si vuelve a cobrar).
  const lineas = f.noCobro ? [] : f.lineas
  const form: FormEntrega = { ...f, lineas, devolucion: hayDevolucion ? f.devolucion : {}, firmaUrl: firmar ? f.firmaUrl : null }

  const eligiendo = entregado && paso === 'devolucion' && hayDevolucion !== true
  const pos = posicionDePaso(paso)
  const ctxCobro: ContextoCobro = {
    lineas, imputacion: f.imputacion, noCobro: f.noCobro,
    aCobrar: aCobrar.aCobrar ? aCobrar.valor : null, hayDevolucion: hayDevolucion === true, subiendo: subiendo > 0,
  }
  let razon: string | null
  if (!entregado) razon = razonPendiente({ entregado: false, receptor: '', motivo, subiendo: subiendo > 0 })
  else if (paso === 'devolucion') razon = razonDevolucionPaso(hayDevolucion, f.devolucion, disponibles)
  else if (paso === 'cobro') razon = razonCobro(ctxCobro)
  else razon = razonConfirmar({ receptor: f.receptor, exigeFotoRemito, remitoUrl: f.remitoUrl, subiendo: subiendo > 0 })
  const listo = razon === null
  const ultimo = !entregado || paso === 'confirmar'

  const atras = () => {
    if (!entregado) return onCerrar()
    if (paso === 'confirmar') return setPaso('cobro')
    if (paso === 'cobro') {
      // Con "Sí, devuelve" se vuelve a los productos; con "No, todo bien", a la pregunta.
      if (hayDevolucion === false) setHayDevolucion(null)
      return setPaso('devolucion')
    }
    if (hayDevolucion === true) return setHayDevolucion(null)
    return onCerrar()
  }
  const seguir = () => {
    if (!listo) return
    setErrorForm(null)
    setPaso(paso === 'devolucion' ? 'cobro' : 'confirmar')
  }
  const elegirDevolucion = (hay: boolean) => {
    setHayDevolucion(hay)
    if (!hay) setPaso('cobro')
  }

  const confirmar = () => {
    if (!listo || enviando) return
    setErrorForm(null)
    if (!entregado) {
      safeHaptics.notification('warning')
      onConfirmar({ entregado: false, motivoRechazo: motivo ?? undefined, observaciones: (motivo === 'Otro' ? f.observaciones.trim() : '') || undefined, evidenciaUrl: lugarUrl ?? undefined })
      return
    }
    const r = armarEntrega(form, { exigeFotoRemito, disponibles })
    if ('error' in r) {
      setErrorForm(r.error)
      return
    }
    onConfirmar({ entregado: true, entrega: r.entrega })
  }

  const porDeudaAnterior = f.imputacion === 'DeudaAnterior' && lineas.length > 0
  const cmp = comparacionDeCobro(ctxCobro)
  const aCobrarHoy = aCobrar.aCobrar ? aCobrar.valor : null
  const cobrado = totalRepartido(lineas)

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
        {entregado && paso === 'cobro' && aCobrarHoy != null ? (
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
          {entregado && paso === 'devolucion' && hayDevolucion === true ? (
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
          {entregado && paso === 'cobro' ? (
            <>
              <CobroEnEntrega
                medios={medios.data}
                mediosError={medios.isError}
                lineas={f.lineas}
                imputacion={f.imputacion}
                onLineas={(l) => cambiar({ lineas: l })}
                onImputacion={(imputacion) => cambiar({ imputacion })}
                onSubiendo={alSubir}
                aCobrar={aCobrarHoy}
                hoy={mostrarFecha(diaArgentina(Date.now()))}
                faltaACuenta={faltaACuenta(ctxCobro)}
                aviso={avisoDeCobro(ctxCobro)}
                porDeudaAnterior={porDeudaAnterior}
                noCobro={f.noCobro}
                onNoCobro={(noCobro) => cambiar({ noCobro })}
              />
              {cmp && hayDevolucion ? (
                <Notice tone="info">La devolución se descuenta de lo que hay que cobrar: el servidor hace la cuenta cuando la autoriza el depósito.</Notice>
              ) : null}
            </>
          ) : null}
          {entregado && paso === 'confirmar' ? (
            <>
              <Field label="Quién recibió" value={f.receptor} onChangeText={(v) => cambiar({ receptor: v })} placeholder="Nombre de quien firma" />
              <FotoEntrega
                que="del remito firmado"
                titulo="Foto del remito"
                obligatoria={exigeFotoRemito}
                guia="Encuadrá el remito entero, con la firma y la aclaración a la vista"
                referencia={etiquetaNota(parada) ? `Remito ${etiquetaNota(parada)}` : undefined}
                lugar={parada.direccion}
                ayuda={exigeFotoRemito ? 'Sin la foto del remito firmado no se confirma la entrega.' : undefined}
                url={f.remitoUrl}
                onUrl={(url) => cambiar({ remitoUrl: url })}
                onSubiendo={alSubir}
              />
              <FirmaEnEntrega
                firmar={firmar}
                onFirmar={(v) => {
                  firmarRef.current = v
                  setFirmar(v)
                  if (!v) cambiar({ firmaUrl: null })
                }}
                url={f.firmaUrl}
                onUrl={(url) => firmarRef.current && cambiar({ firmaUrl: url })}
                onSubiendo={alSubir}
              />
              <Field label="Observaciones" value={f.observaciones} onChangeText={(v) => cambiar({ observaciones: v })} placeholder="Algo que la oficina tenga que saber" />
              <ResumenEntrega
                d={{
                  receptor: f.receptor.trim(),
                  conFotoRemito: !!f.remitoUrl,
                  devueltos: (renglones.data ?? [])
                    .map((r) => ({ nombre: r.productoNombre ?? 'Producto', cantidad: leerNumero(form.devolucion[r.ventaDetalleId ?? ''] ?? '') ?? 0 }))
                    .filter((x) => x.cantidad > 0),
                  cobros: lineas.map((l) => ({ medio: l.medio?.nombre ?? '', monto: leerNumero(l.monto) ?? 0, conFoto: !!l.fotoUrl })),
                  firmada: !!form.firmaUrl,
                  aDeudaAnterior: porDeudaAnterior,
                  noCobro: observacionesDeEntrega('', f.noCobro) ?? null,
                }}
              />
            </>
          ) : null}
          {errorForm ? <Notice tone="peligro">{errorForm}</Notice> : null}
          {error && ultimo ? <Notice tone="peligro">{error}</Notice> : null}
        </ScrollView>
        {eligiendo ? null : (
          <View style={{ backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border, padding: space[4], paddingBottom: space[4] + bottom, gap: space[2] }}>
            <View style={{ gap: space[2], ...columna }}>
              {razon ? <MotivoDeshabilitado>{razon}</MotivoDeshabilitado> : null}
              <Button
                size="xl"
                label={!entregado ? 'Avisar a Ventas' : ultimo ? 'Confirmar entrega' : 'Continuar'}
                disabled={!listo}
                loading={ultimo && enviando}
                onPress={ultimo ? confirmar : seguir}
              />
            </View>
          </View>
        )}
      </View>
    </Modal>
  )
}
