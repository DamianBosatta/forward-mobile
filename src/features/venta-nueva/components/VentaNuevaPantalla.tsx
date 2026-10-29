import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Trash2 } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { BottomSheet, Button, Field, Notice, TopBar, formatImporte } from '@/core/ui/fw'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { hasCapability } from '@/features/auth/lib/capabilities'
import type { TipoDocumento } from '@/features/clientes/components/SeleccionarClienteSheet'
import { direccionDeEntrega, nombreDelCliente } from '@/features/clientes/lib/cliente'
import { aElegido, type ClienteElegido } from '@/features/clientes/lib/recientes'
import { useSocio } from '@/libs/api-client/socios'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
import { useCabeceraVenta } from '../hooks/useCabeceraVenta'
import { useConfirmarVenta } from '../hooks/useConfirmarVenta'
import { useResponsive } from '@/libs/useResponsive'
import { useBorradorVenta } from '../hooks/useBorradorVenta'
import { useComisionEstimada } from '../hooks/useComisionEstimada'
import { aAlta, aAutoguardado } from '../lib/payload'
import { useVistaPreviaVenta } from '@/libs/api-client/ventas'
import { useDebouncedValue } from '@/core/hooks/useDebouncedValue'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { avisosVenta, superaElTope, totalesEstimados } from '../lib/avisos'
import { mostrarNumero } from '../lib/linea'
import type { LineaCarrito } from '../lib/carrito'
import { useLoQueLlevo } from '../hooks/useLoQueLlevo'
import { CatalogoVenta } from './CatalogoVenta'
import { CantidadSheet } from './CantidadSheet'
import { ConfirmarVentaSheet } from './ConfirmarVentaSheet'
import { DescuentoGeneralSheet } from './DescuentoGeneralSheet'
import { NuevaVentaInicio } from './NuevaVentaInicio'
import { EditarLineaSheet } from './EditarLineaSheet'
import { LineasVenta } from './LineasVenta'
import { CabeceraVenta } from './CabeceraVenta'
import { FraganciasSheet } from './FraganciasSheet'
import { useCatalogoVenta } from '../hooks/useCatalogoVenta'
import { useStockVivoVenta } from '../hooks/useStockVivoVenta'
import { conStockFresco } from '../lib/avisoStockVivo'
import { useVentaCargada } from '../hooks/useVentaCargada'
import type { VentaCargada } from '../lib/hidratar'

export type AbrirVenta =
  /** Un borrador de la pestaña Borradores: sigue autoguardándose como pedido o presupuesto. */
  | { modo: 'retomar'; ventaId: string; tipo: TipoDocumento }
  /** Una venta Pendiente o Confirmada: sin autoguardado; se guarda con PUT y la versión. */
  | { modo: 'editar'; ventaId: string }
  /** Una venta como punto de partida: borrador nuevo para el mismo cliente, con los precios de hoy. */
  | { modo: 'duplicar'; ventaId: string }

interface Props {
  abrir?: AbrirVenta
  /** `?clienteId=`: el cliente ya elegido (Vender de nuevo, Buscar, la ficha): se salta la lista y se llega al catálogo. */
  clienteId?: string
}

/** Las dos vistas de la venta: el catálogo (donde se arma) y la revisión (líneas, cabecera, total y confirmar). */
type VistaVenta = 'catalogo' | 'revision'

/**
 * Venta nueva: primero el cliente (elegirlo crea el borrador en el servidor y desde ahí se autoguarda), después el
 * catálogo, que es la vista principal; "Ver venta" lleva a revisar (líneas y cabecera), "Seguir" abre Confirmar y
 * de ahí a la pantalla de venta guardada. Una venta que se abre (retomar, editar, duplicar) arranca en la revisión.
 */
export function VentaNuevaPantalla({ abrir, clienteId }: Props = {}) {
  const c = useColors()
  const router = useRouter()
  // `cliente`: el de la venta, desde que se elige (o se abre una venta); sin cliente no hay catálogo.
  const [cliente, setCliente] = useState<ClienteElegido | null>(null)
  const [tipo, setTipo] = useState<TipoDocumento>('Pedido')
  // Una venta nueva se arma en el catálogo; las que se abren arrancan en la revisión.
  const [vista, setVista] = useState<VistaVenta>(abrir ? 'revision' : 'catalogo')
  const { lineas: lineasCarrito, vaciar, reemplazar, quitar, sumar, restar } = useCarritoVenta()
  // Las líneas guardan la fila del catálogo de cuando se cargaron: lo que se ve y se confirma lleva el stock vivo.
  const { productos: catalogoVenta } = useCatalogoVenta('')
  const lineas = useMemo(() => conStockFresco(lineasCarrito, catalogoVenta), [lineasCarrito, catalogoVenta])
  const user = useAuthStore((s) => s.user)
  // El descuento general siempre es un número válido (0 a 100): se cambia en la hoja "Descuento a toda la venta".
  const [descuentoValido, setDescuentoValido] = useState(0)
  const descuentoGeneral = descuentoValido
  const [descGeneral, setDescGeneral] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  // Preselección por `?clienteId=`: se trae la ficha una vez y se empieza la venta con ese cliente.
  const preseleccion = useSocio(abrir ? '' : clienteId ?? '')
  // Una sola vez: si después vuelve a la lista con la flecha, no se la elige de nuevo.
  const preseleccionado = useRef(false)
  const cab = useCabeceraVenta(tipo, abrir?.modo !== 'editar')
  const tope = user?.maxDescuentoPorcentaje ?? 0
  const exento = hasCapability(user?.permissions, 'CAP_EXENTO_TOPE_DESCUENTO')
  const paraGuardar = aAutoguardado(lineas, descuentoValido, cab.cabecera)
  // Pedido sobre el tope (el del perfil rige también a quien está exento): con un servidor que no guarda el tipo
  // del borrador, éste (Presupuesto allá) guarda hasta el tope y lo demás va al confirmar (ver useBorradorVenta).
  const b = useBorradorVenta(paraGuardar, tipo === 'Pedido' ? tope : 0)
  const comision = useComisionEstimada(lineas, descuentoValido, cab.cabecera.flete, cab.porcentajeCedido)
  const { isTabletLandscape } = useResponsive()
  const [pestana, setPestana] = useState<'lineas' | 'cabecera'>('lineas')
  const [motivo, setMotivo] = useState('')
  const [edicion, setEdicion] = useState<{ ventaId: string; version: number; codigo: string } | null>(null)
  const abrirEf = abrir
  const conf = useConfirmarVenta({
    clienteId: cliente?.id ?? '', cliente, esPedido: tipo === 'Pedido', lineas, descuentoGeneral: descuentoValido, cabecera: cab.cabecera,
    porcentajeCedido: cab.porcentajeCedido, borrador: b, alGuardar: vaciar, edicion,
  })
  const cuerpoVistaPrevia = useDebouncedValue(cliente && tipo === 'Pedido' && !edicion && lineas.length > 0
    ? aAlta(lineas, descuentoValido, cab.cabecera, {
      clienteId: cliente.id, depositoId: DEPOSITO_CENTRAL_ID, esPedido: true, claveIdempotencia: '',
      motivoVentaSinStock: 'Vista previa', porcentajeComisionCedido: cab.porcentajeCedido,
    })
    : null)
  const vistaPrevia = useVistaPreviaVenta(cuerpoVistaPrevia, !cab.fleteInvalido && !cab.cesionError)
  const [editando, setEditando] = useState<LineaCarrito | null>(null)
  const [detalleLinea, setDetalleLinea] = useState<LineaCarrito | null>(null)
  const [fragancias, setFragancias] = useState<string | null>(null)
  const stockVivo = useStockVivoVenta(lineas)
  const conLoVivo = (l: LineaCarrito | null) => (l ? lineas.find((x) => x.productoId === l.productoId) ?? l : null)
  const llevo = useLoQueLlevo(cliente?.id)
  const volver = { kind: 'atras' as const, onPress: () => router.back() }

  // Elegir el cliente arranca la venta: crea el borrador del tipo elegido y abre el catálogo.
  const empezar = (elegido: ClienteElegido) => {
    setCliente(elegido)
    setVista('catalogo')
    void b.crear(elegido.id, tipo)
  }
  useEffect(() => {
    if (!preseleccion.data || preseleccionado.current) return
    preseleccionado.current = true
    empezar(aElegido(preseleccion.data))
  })

  // Cada venta nueva arranca con el carrito vacío.
  useEffect(() => { vaciar() }, [vaciar])

  // Abrir una venta del servidor (retomar, editar o duplicar): lo que tiene pasa a la pantalla.
  const [abierta, setAbierta] = useState(false)
  const cargada = useVentaCargada(abrirEf?.ventaId, !abierta)
  const [aDuplicar, setADuplicar] = useState<VentaCargada | null>(null)
  const aplicar = (d: VentaCargada, cabecera = d.cabecera, proponerFecha = true, conFacturaDeLaVenta = false) => {
    useCarritoVenta.setState({ lineas: d.lineas })
    setDescuentoValido(d.descuentoGeneral)
    cab.hidratar(cabecera, proponerFecha, conFacturaDeLaVenta)
  }
  useEffect(() => {
    const d = cargada.datos
    if (!abrirEf || !d || abierta) return
    setAbierta(true)
    setCliente(d.cliente)
    if (abrirEf.modo === 'retomar') {
      aplicar(d)
      setTipo(abrirEf.tipo)
      b.retomar(abrirEf.ventaId, d.version)
    } else if (abrirEf.modo === 'editar') {
      // Una venta guardada sin fecha no recibe una que el vendedor no eligió.
      aplicar(d, d.cabecera, false, true)
      setTipo(d.tipo)
      setEdicion({ ventaId: abrirEf.ventaId, version: d.version, codigo: d.codigo })
    } else {
      // Duplicar: primero el borrador nuevo; las líneas entran cuando existe, así se autoguardan en él.
      setTipo(d.tipo)
      setADuplicar(d)
      void b.crear(d.cliente.id, d.tipo)
    }
  })
  useEffect(() => {
    if (!aDuplicar || (!b.borrador && !b.errorAlCrear)) return
    // La fecha de entrega no se copia: se propone el próximo día hábil.
    aplicar(aDuplicar, { ...aDuplicar.cabecera, fecha: null })
    setADuplicar(null)
  })

  if (abrirEf && !abierta) {
    const titulo = abrirEf.modo === 'retomar' ? 'Retomar borrador' : abrirEf.modo === 'editar' ? 'Editar venta' : 'Duplicar venta'
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar title={titulo} leading={volver} />
        <View style={{ padding: space[4] }}>
          {cargada.error ? (
            <View style={{ gap: space[3] }}>
              <Notice tone="peligro">{cargada.error}</Notice>
              <Button label="Reintentar" variant="secundario" onPress={cargada.reintentar} />
            </View>
          ) : <ActivityIndicator color={c.brand} />}
        </View>
      </View>
    )
  }

  if (!cliente) {
    return (
      <NuevaVentaInicio
        cargandoCliente={!!clienteId && !preseleccionado.current && !preseleccion.isError}
        tipo={tipo}
        onTipo={setTipo}
        onElegir={empezar}
        onNuevoCliente={() => router.push('/(tabs)/socios/nuevo' as never)}
        onVolver={() => router.back()}
      />
    )
  }

  const descartar = () => Alert.alert('¿Descartar el borrador?', 'Se borra lo cargado en esta venta.', [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: 'Descartar',
      style: 'destructive',
      onPress: () => b.descartar().then(() => { vaciar(); router.back() }, () =>
        Alert.alert('No se pudo descartar el borrador', 'Probá de nuevo; si no, se descarta solo a las 48 h sin cambios.')),
    },
  ])
  const aviso = b.errorAlCrear ? `${b.errorAlCrear} La venta se puede seguir armando, pero no se guarda sola.`
    : b.estado === 'error' || b.estado === 'conflicto' ? b.motivo : null
  // El cliente se identifica por la dirección; el nombre va aparte.
  const nombre = nombreDelCliente(cliente)
  const avisos = avisosVenta(lineas, { tipo, tope, exento, descuentoGeneral: descuentoValido })
  const { total } = totalesEstimados(lineas, descuentoValido, cab.cabecera.flete)
  // La cesión no viaja en el autoguardado (el borrador es Presupuesto); va al confirmar, y siempre a autorización.
  if (cab.porcentajeCedido) avisos.porAutorizar.push('cediste parte de tu comisión')
  // El servidor dice con las reglas del alta si el pedido queda por autorizar y por qué (los 6 motivos,
  // deuda vencida y tope de crédito incluidos) o qué rechazaría (cierre del bloque 9). Sin respuesta,
  // quedan los avisos locales. Mientras se arma no hay justificación de falta de stock: se manda una
  // provisoria para que la falta salga como motivo; la de verdad se pide al confirmar.
  if (Array.isArray(vistaPrevia.data?.motivos) && Array.isArray(vistaPrevia.data?.rechazos) && !edicion && tipo === 'Pedido') {
    avisos.porAutorizar = vistaPrevia.data!.motivos
    avisos.rechazos = vistaPrevia.data!.rechazos
  }
  const rotulo = nombre ? `${direccionDeEntrega(cliente)} · ${nombre}` : direccionDeEntrega(cliente)
  const lineasVista = (
    <LineasVenta lineas={lineas} {...avisos} tope={tope} avisosStock={stockVivo.avisos} enVivo={stockVivo.enVivo}
      nota={b.retenido && b.borrador ? `El borrador guarda los descuentos hasta tu tope (${mostrarNumero(tope)} %); el resto se guarda al confirmar el pedido.` : null} descuentoGeneral={descuentoGeneral} flete={cab.cabecera.flete}
      onDescuentoGeneral={() => setDescGeneral(true)} onSumar={sumar} onRestar={restar} onAgregar={() => setVista('catalogo')} onEditar={setEditando}
      onElegirFragancias={setFragancias} nombrePadre={(id) => catalogoVenta.find((p) => p.id === id)?.nombre} />
  )
  const cabeceraVista = <CabeceraVenta clienteId={cliente.id} rotuloCliente={rotulo} cab={cab} />
  const superaTope = superaElTope(lineas, descuentoValido, tope, exento)
  const sheetConfirmar = confirmando && !conf.pedirMotivo
  const unidades = lineas.reduce((n, l) => n + l.cantidad, 0)
  // V6: el total con flete, la comisión y "Seguir" (que abre V7 Confirmar).
  const franjaTotal = (
    <View style={{ padding: space[4], gap: space[1], borderColor: c.border, borderTopWidth: isTabletLandscape ? 0 : 1, borderBottomWidth: isTabletLandscape ? 1 : 0, backgroundColor: c.surface }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{cab.cabecera.flete > 0 ? 'Total con flete' : 'Total estimado'}</Text>
        <Text testID="venta-total" style={{ ...typeScale.titulo, ...importe, color: c.text }}>{formatImporte(total)}</Text>
      </View>
      {comision !== null ? (
        <Text style={{ ...typeScale.secundario, alignSelf: 'flex-start', paddingHorizontal: space[2], borderRadius: radii.pastilla, backgroundColor: c.brandSoft, color: c.brandInk }}>
          {`Tu comisión estimada ${formatImporte(comision)}`}
        </Text>
      ) : null}
      {conf.error && !sheetConfirmar ? <Notice tone="peligro">{conf.error}</Notice> : null}
      <Button label="Seguir" onPress={() => setConfirmando(true)} disabled={lineas.length === 0} />
    </View>
  )

  // En una venta nueva la flecha de la revisión vuelve al catálogo; en las que se abren, sale de la pantalla.
  const volverDeRevision = abrir ? volver : { kind: 'atras' as const, onPress: () => setVista('catalogo') }

  // El estado del autoguardado se ve en las dos vistas: un guardado rechazado o un borrador que no nació no pasan en silencio.
  const avisoDelBorrador = aviso ? (
    <View style={{ padding: space[4], paddingBottom: 0, gap: space[2] }}>
      <Notice tone="peligro">{aviso}</Notice>
      {b.estado === 'error' && b.reintentable ? <Button label="Reintentar" variant="secundario" onPress={b.reintentar} /> : null}
    </View>
  ) : null

  // Vista de revisión: líneas y cabecera, el total y "Seguir".
  const vistaRevision = (
    <>
      <TopBar
        title={edicion ? `Editar ${tipo.toLowerCase()} ${edicion.codigo}` : tipo === 'Pedido' ? 'Nuevo pedido' : 'Nuevo presupuesto'}
        subtitle={rotulo}
        leading={volverDeRevision}
        syncLabel={b.etiqueta}
        actions={b.borrador ? [{ icon: Trash2, accessibilityLabel: 'Descartar borrador', onPress: descartar }] : []}
        // Tablet horizontal (plan §8): Líneas y Cabecera lado a lado, sin pestañas.
        tabs={isTabletLandscape ? undefined : [
          { label: `Líneas (${lineas.length})`, selected: pestana === 'lineas', onPress: () => setPestana('lineas') },
          { label: 'Cabecera', selected: pestana === 'cabecera', onPress: () => setPestana('cabecera') },
        ]}
      />
      {avisoDelBorrador}
      {isTabletLandscape ? franjaTotal : null}
      {isTabletLandscape ? (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={{ flex: 3 }}>{lineasVista}</View>
          <View style={{ flex: 2, borderLeftWidth: 1, borderLeftColor: c.border }}>{cabeceraVista}</View>
        </View>
      ) : <View style={{ flex: 1 }}>{pestana === 'lineas' ? lineasVista : cabeceraVista}</View>}
      {isTabletLandscape ? null : franjaTotal}
    </>
  )

  // Vista de catálogo: donde se arma la venta de una venta nueva. Con la flecha se sale de la venta.
  // "Ver venta" (la barra del carrito) lleva a la revisión.
  const vistaCatalogo = (
    <>
      <TopBar
        title={direccionDeEntrega(cliente)}
        subtitle={[nombre, tipo === 'Presupuesto' ? 'Presupuesto' : null].filter(Boolean).join(' · ') || undefined}
        leading={abrir ? { kind: 'atras', onPress: () => setVista('revision') } : volver}
        syncLabel={b.etiqueta}
      />
      {avisoDelBorrador}
      <CatalogoVenta onVerVenta={() => setVista('revision')} llevo={llevo} />
    </>
  )

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {vista === 'catalogo' ? vistaCatalogo : vistaRevision}
      <ConfirmarVentaSheet
        visible={sheetConfirmar}
        onClose={() => setConfirmando(false)}
        tipo={tipo}
        edicion={!!edicion}
        cab={cab}
        lineas={lineas}
        productos={lineas.length}
        unidades={unidades}
        total={total}
        porAutorizar={avisos.porAutorizar}
        rechazos={avisos.rechazos}
        superaTope={superaTope}
        descuentoValido
        error={conf.error}
        enviando={conf.enviando}
        onConfirmar={() => void conf.confirmar()}
      />
      <DescuentoGeneralSheet
        visible={descGeneral}
        valor={descuentoValido}
        lineas={lineas}
        flete={cab.cabecera.flete}
        onClose={() => setDescGeneral(false)}
        onAplicar={(pct) => { setDescuentoValido(pct); setDescGeneral(false) }}
      />
      <BottomSheet visible={conf.pedirMotivo} onClose={conf.cerrarMotivo} accessibilityLabel="Motivo sin stock">
        <View style={{ gap: space[3] }}>
          <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>Falta stock</Text>
          <Text style={{ ...typeScale.cuerpo, color: c.text }}>Para guardar el pedido sin stock, contá por qué. Va a quedar por autorizar.</Text>
          <Field label="Motivo" value={motivo} onChangeText={setMotivo} placeholder="Ej.: el cliente espera la reposición del lunes." multiline />
          <Button label="Confirmar con este motivo" disabled={!motivo.trim() || conf.enviando} loading={conf.enviando} onPress={() => void conf.confirmar(motivo)} />
        </View>
      </BottomSheet>
      <CantidadSheet linea={editando && !editando.producto.productoPadreId ? editando : null} onClose={() => setEditando(null)}
        onConfirm={(l) => { reemplazar(l); setEditando(null) }} onQuitar={(id) => { quitar(id); setEditando(null) }}
        onDetalle={(l) => { setEditando(null); setDetalleLinea(l) }} />
      {/* Una fragancia suelta se edita en el detalle (tope por stock disponible); el resto, en el teclado rápido. */}
      <EditarLineaSheet linea={conLoVivo(editando?.producto.productoPadreId ? editando : detalleLinea)} onClose={() => { setEditando(null); setDetalleLinea(null) }} descuentoGeneral={descuentoValido}
        onConfirm={(l) => { reemplazar(l); setEditando(null); setDetalleLinea(null) }} onQuitar={(id) => { quitar(id); setEditando(null); setDetalleLinea(null) }} />
      <FraganciasSheet padreId={fragancias} onClose={() => setFragancias(null)} llevo={llevo} />
    </View>
  )
}
