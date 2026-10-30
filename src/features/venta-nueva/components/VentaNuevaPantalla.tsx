import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Plus, Trash2 } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { BottomSheet, Button, Field, Notice, TopBar, formatImporte } from '@/core/ui/fw'
import type { CatalogoStockItem } from '@/libs/api-client'
import { METODO_ENTREGA } from '@/features/ventas/lib/venta-form-retiro'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { hasCapability } from '@/features/auth/lib/capabilities'
import type { TipoDocumento } from '@/features/clientes/components/SeleccionarClienteSheet'
import { direccionDeEntrega, nombreDelCliente } from '@/features/clientes/lib/cliente'
import { aElegido, type ClienteElegido } from '@/features/clientes/lib/recientes'
import { useSocio } from '@/libs/api-client/socios'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
import { useCabeceraVenta } from '../hooks/useCabeceraVenta'
import { useConfirmarVenta } from '../hooks/useConfirmarVenta'
import { useBorradorVenta } from '../hooks/useBorradorVenta'
import { useComisionEstimada } from '../hooks/useComisionEstimada'
import { aAlta, aAutoguardado } from '../lib/payload'
import { useVistaPreviaVenta } from '@/libs/api-client/ventas'
import { useDebouncedValue } from '@/core/hooks/useDebouncedValue'
import { DEPOSITO_CENTRAL_ID } from '@/core/constants/depositos'
import { avisosVenta, superaElTope, type YaReservadas } from '../lib/avisos'
import { mostrarNumero } from '../lib/linea'
import type { LineaCarrito } from '../lib/carrito'
import { useLoQueLlevo } from '../hooks/useLoQueLlevo'
import { CatalogoVenta } from './CatalogoVenta'
import { CantidadOfertaPantalla } from './CantidadOfertaPantalla'
import { CreditoDeudaVenta } from './CreditoDeudaVenta'
import { PasosVenta } from './PasosVenta'
import { RevisarVenta } from './RevisarVenta'
import { ConFactura, MOTIVO_PRESUPUESTO_SOBRE_TOPE } from './ConFactura'
import { DescuentoGeneralSheet } from './DescuentoGeneralSheet'
import { NuevaVentaInicio } from './NuevaVentaInicio'
import { EditarLineaSheet } from './EditarLineaSheet'
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
  const { lineas: lineasCarrito, vaciar, reemplazar, quitar } = useCarritoVenta()
  const verCantidades = hasCapability(useAuthStore((s) => s.user?.permissions), 'CAP_VER_CANTIDADES_STOCK')
  // Las líneas guardan la fila del catálogo de cuando se cargaron: lo que se ve y se confirma lleva el stock vivo.
  const { productos: catalogoVenta } = useCatalogoVenta('')
  const lineas = useMemo(() => conStockFresco(lineasCarrito, catalogoVenta), [lineasCarrito, catalogoVenta])
  const user = useAuthStore((s) => s.user)
  // El descuento general siempre es un número válido (0 a 100): se cambia en la hoja "Descuento a toda la venta".
  const [descuentoValido, setDescuentoValido] = useState(0)
  const [descGeneral, setDescGeneral] = useState(false)
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
  const [motivo, setMotivo] = useState('')
  const [edicion, setEdicion] = useState<{ ventaId: string; version: number; codigo: string } | null>(null)
  // Editar: lo que la venta ya tenía por producto. El servidor ya lo descontó del `disponible`; sin esto la revisión avisa de más.
  const [yaReservadas, setYaReservadas] = useState<YaReservadas | undefined>(undefined)
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
  // `editando`: una fragancia suelta, que se edita en el detalle (tope por stock); el resto va a la pantalla de oferta.
  const [editando, setEditando] = useState<LineaCarrito | null>(null)
  // `oferta`: el producto abierto en "Cantidad y oferta"; con línea en el carrito es una edición, sin ella un alta.
  const [oferta, setOferta] = useState<CatalogoStockItem | null>(null)
  const [verCabecera, setVerCabecera] = useState(false)
  const [fragancias, setFragancias] = useState<string | null>(null)
  const stockVivo = useStockVivoVenta(lineas)
  const conLoVivo = (l: LineaCarrito | null) => (l ? lineas.find((x) => x.productoId === l.productoId) ?? l : null)
  // Una fragancia suelta se edita en el detalle; cualquier otra línea o producto, en la pantalla de oferta.
  const editarLinea = (l: LineaCarrito) => (l.producto.productoPadreId ? setEditando(l) : setOferta(l.producto))
  const ofertaVivo = oferta ? catalogoVenta.find((p) => p.id === oferta.id) ?? oferta : null
  const llevo = useLoQueLlevo(cliente?.id)
  const volver = { kind: 'atras' as const, onPress: () => router.back() }

  // Elegir el cliente arranca la venta: crea el borrador del tipo elegido y abre el catálogo.
  const [arrancarDelUltimo, setArrancarDelUltimo] = useState(false)
  const empezar = (elegido: ClienteElegido, opciones?: { delUltimo?: boolean }) => {
    setArrancarDelUltimo(!!opciones?.delUltimo)
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
      setYaReservadas(Object.fromEntries(d.lineas.map((l) => [l.productoId, l.cantidad])))
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
  const avisos = avisosVenta(lineas, { tipo, tope, exento, descuentoGeneral: descuentoValido, verCantidades, yaReservadas })
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
  const superaTope = superaElTope(lineas, descuentoValido, tope, exento)
  // En una venta nueva la flecha de la revisión vuelve al catálogo; en las que se abren, sale de la pantalla.
  const volverDeRevision = abrir ? volver : { kind: 'atras' as const, onPress: () => setVista('catalogo') }

  // El estado del autoguardado se ve en las dos vistas: un guardado rechazado o un borrador que no nació no pasan en silencio.
  const avisoDelBorrador = aviso ? (
    <View style={{ padding: space[4], paddingBottom: 0, gap: space[2] }}>
      <Notice tone="peligro">{aviso}</Notice>
      {b.estado === 'error' && b.reintentable ? <Button label="Reintentar" variant="secundario" onPress={b.reintentar} /> : null}
    </View>
  ) : null

  // Revisión de toda venta (nueva, retomada, duplicada o editada; lámina Carrito): las líneas con el stock vuelto a chequear; lo que no es una línea
  // (entrega, descuento general, avisos, comisión) se ajusta desde `ajustes`: la fecha y la nota en "Datos de la
  // entrega", Con factura en su interruptor. "Confirmar venta" manda la venta (sin segunda hoja); la hoja del motivo
  // sale solo si falta stock, y el botón queda apagado con las mismas guardas de siempre.
  const fechaEntrega = cab.cabecera.fecha
  const diaEntrega = cab.tira.find((d) => d.dia === fechaEntrega)
  const textoEntrega = cab.cabecera.metodoEntrega === METODO_ENTREGA.RetiroEnLocal ? 'Retira en el local'
    : diaEntrega ? `${diaEntrega.nombre} ${diaEntrega.numero}` : fechaEntrega ? fechaEntrega.split('-').reverse().join('/') : 'Sin fecha'
  const presupuestoSobreTope = tipo === 'Presupuesto' && superaTope
  const filaAjuste = (rotuloFila: string, valor: string | null, onPress: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={rotuloFila} onPress={onPress}
      style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2], paddingHorizontal: space[3], borderRadius: radii.campo, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
      <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{rotuloFila}</Text>
      {valor ? <Text style={{ ...typeScale.cuerpoDestacado, ...importe, color: c.brandInk }}>{valor}</Text> : null}
    </Pressable>
  )
  const ajustesRevision = (
    <View style={{ gap: space[2] }}>
      <Pressable accessibilityRole="button" onPress={() => setVista('catalogo')}
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2], borderRadius: radii.campo, borderWidth: 1, borderColor: c.border, borderStyle: 'dashed' }}>
        <Plus size={20} color={c.brandInk} />
        <Text style={{ ...typeScale.cuerpoDestacado, color: c.brandInk }}>Agregar productos</Text>
      </Pressable>
      {Object.entries(stockVivo.avisos).map(([id, texto]) => <Notice key={id} tone="advertencia" testID={`aviso-stock-${id}`}>{texto}</Notice>)}
      {avisos.rechazos.map((r) => <Notice key={r} tone="peligro">{r}</Notice>)}
      {b.retenido && b.borrador ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{`El borrador guarda los descuentos hasta tu tope (${mostrarNumero(tope)} %); el resto se guarda al confirmar el pedido.`}</Text> : null}
      {filaAjuste('Descuento a toda la venta', `${mostrarNumero(descuentoValido)} %`, () => setDescGeneral(true))}
      {filaAjuste('Datos de la entrega', textoEntrega, () => setVerCabecera(true))}
      <ConFactura conFactura={cab.cabecera.conFactura} onChange={cab.setConFactura} lineas={lineas} />
      {comision !== null ? (
        <Text style={{ ...typeScale.secundario, alignSelf: 'flex-start', paddingHorizontal: space[2], borderRadius: radii.pastilla, backgroundColor: c.brandSoft, color: c.brandInk }}>
          {`Tu comisión estimada ${formatImporte(comision)}`}
        </Text>
      ) : null}
    </View>
  )
  const vistaRevision = (
    <>
      <TopBar
        title={edicion ? `Editar ${tipo.toLowerCase()} ${edicion.codigo}` : tipo === 'Pedido' ? 'Nuevo pedido' : 'Nuevo presupuesto'}
        subtitle={rotulo}
        leading={volverDeRevision}
        syncLabel={b.etiqueta}
        actions={b.borrador ? [{ icon: Trash2, accessibilityLabel: 'Descartar borrador', onPress: descartar }] : []}
      />
      <PasosVenta paso={3} />
      {avisoDelBorrador}
      <RevisarVenta
        autorizacion={avisos.porAutorizar}
        onEditarProductos={() => setVista('catalogo')}
        cliente={cliente}
        descuentoGeneral={descuentoValido}
        flete={cab.cabecera.flete}
        enviando={conf.enviando}
        error={conf.error}
        onConfirmar={() => conf.confirmar()}
        deshabilitado={cab.fleteInvalido || !!cab.cesionError || presupuestoSobreTope}
        motivoDeshabilitado={presupuestoSobreTope ? MOTIVO_PRESUPUESTO_SOBRE_TOPE : undefined}
        onEditarLinea={editarLinea}
        onElegirFragancias={setFragancias}
        ajustes={ajustesRevision}
        yaReservadas={yaReservadas}
        etiquetaConfirmar={edicion ? 'Guardar cambios' : undefined}
      />
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
      <PasosVenta paso={2} />
      <CreditoDeudaVenta clienteId={cliente.id} tipo={tipo} />
      {avisoDelBorrador}
      <CatalogoVenta onVerVenta={() => setVista('revision')} llevo={llevo} filtroInicialDelUltimo={arrancarDelUltimo} enVivo={stockVivo.enVivo} onAbrirOferta={setOferta} />
    </>
  )

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {vista === 'catalogo' ? vistaCatalogo : vistaRevision}
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
      {ofertaVivo ? (
        <CantidadOfertaPantalla visible producto={ofertaVivo} linea={lineas.find((l) => l.productoId === ofertaVivo.id) ?? null}
          enVivo={stockVivo.enVivo} yaReservada={yaReservadas?.[ofertaVivo.id]} onClose={() => setOferta(null)} onListo={() => setOferta(null)} />
      ) : null}
      {/* Una fragancia suelta se edita en el detalle (tope por stock disponible). */}
      <EditarLineaSheet linea={conLoVivo(editando)} onClose={() => setEditando(null)} descuentoGeneral={descuentoValido}
        onConfirm={(l) => { reemplazar(l); setEditando(null) }} onQuitar={(id) => { quitar(id); setEditando(null) }} />
      <BottomSheet visible={verCabecera} onClose={() => setVerCabecera(false)} accessibilityLabel="Datos de la entrega">
        <CabeceraVenta clienteId={cliente.id} rotuloCliente={rotulo} cab={cab} />
      </BottomSheet>
      <FraganciasSheet padreId={fragancias} onClose={() => setFragancias(null)} llevo={llevo} />
    </View>
  )
}
