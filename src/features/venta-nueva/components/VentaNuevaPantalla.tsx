import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Modal, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Trash2 } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { BottomSheet, Button, Field, Notice, TopBar, formatImporte } from '@/core/ui/fw'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { hasCapability } from '@/features/auth/lib/capabilities'
import { SeleccionarClienteSheet, type TipoDocumento } from '@/features/clientes/components/SeleccionarClienteSheet'
import { direccionDeEntrega, nombreDelCliente } from '@/features/clientes/lib/cliente'
import type { ClienteElegido } from '@/features/clientes/lib/recientes'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
import { useCabeceraVenta } from '../hooks/useCabeceraVenta'
import { useConfirmarVenta } from '../hooks/useConfirmarVenta'
import { useResponsive } from '@/libs/useResponsive'
import { useBorradorVenta } from '../hooks/useBorradorVenta'
import { useComisionEstimada } from '../hooks/useComisionEstimada'
import { aAutoguardado, hastaElTope, superaElTope } from '../lib/payload'
import { avisosVenta, totalesEstimados } from '../lib/avisos'
import { leerNumero, mostrarNumero } from '../lib/linea'
import type { LineaCarrito } from '../lib/carrito'
import { CatalogoVenta } from './CatalogoVenta'
import { EditarLineaSheet } from './EditarLineaSheet'
import { LineasVenta } from './LineasVenta'
import { CabeceraVenta } from './CabeceraVenta'
import { FraganciasSheet } from './FraganciasSheet'
import { useCatalogoVenta } from '../hooks/useCatalogoVenta'
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
}

/** Venta nueva (plan 9, fase 2): elegir cliente crea el borrador en el servidor y desde ahí se autoguarda. */
export function VentaNuevaPantalla({ abrir }: Props = {}) {
  const c = useColors()
  const router = useRouter()
  const [cliente, setCliente] = useState<ClienteElegido | null>(null)
  const [tipo, setTipo] = useState<TipoDocumento>('Pedido')
  const { lineas, vaciar, reemplazar, quitar } = useCarritoVenta()
  const user = useAuthStore((s) => s.user)
  const [descuentoTexto, setDescuentoTexto] = useState('0')
  const leido = leerNumero(descuentoTexto)
  const descuentoGeneral = leido !== null && leido >= 0 && leido <= 100 ? leido : null
  // Un descuento a medio tipear o inválido no viaja: se guarda el último válido.
  const [descuentoValido, setDescuentoValido] = useState(0)
  useEffect(() => { if (descuentoGeneral !== null) setDescuentoValido(descuentoGeneral) }, [descuentoGeneral])
  const cab = useCabeceraVenta(tipo)
  const tope = user?.maxDescuentoPorcentaje ?? 0
  const exento = hasCapability(user?.permissions, 'CAP_EXENTO_TOPE_DESCUENTO')
  const paraGuardar = aAutoguardado(lineas, descuentoValido, cab.cabecera)
  // Pedido sobre el tope (el del perfil rige también a quien está exento): el borrador (Presupuesto en el servidor) guarda hasta el tope; lo demás va al confirmar.
  const retenido = tipo === 'Pedido' && superaElTope(paraGuardar, tope)
  const b = useBorradorVenta(retenido ? hastaElTope(paraGuardar, tope) : paraGuardar)
  const comision = useComisionEstimada(lineas, descuentoValido, cab.cabecera.flete, cab.porcentajeCedido)
  const { isTabletLandscape } = useResponsive()
  const [pestana, setPestana] = useState<'lineas' | 'cabecera'>('lineas')
  const [motivo, setMotivo] = useState('')
  const [edicion, setEdicion] = useState<{ ventaId: string; version: number; codigo: string } | null>(null)
  const conf = useConfirmarVenta({
    clienteId: cliente?.id ?? '', esPedido: tipo === 'Pedido', lineas, descuentoGeneral: descuentoValido, cabecera: cab.cabecera,
    porcentajeCedido: cab.porcentajeCedido, borrador: b, alGuardar: vaciar, edicion,
  })
  const [catalogo, setCatalogo] = useState(false)
  const [editando, setEditando] = useState<LineaCarrito | null>(null)
  const [fragancias, setFragancias] = useState<string | null>(null)
  const { productos: catalogoVenta } = useCatalogoVenta('')
  const volver = { kind: 'atras' as const, onPress: () => router.back() }

  // Cada venta nueva arranca con el carrito vacío.
  useEffect(() => { vaciar() }, [vaciar])

  // Abrir una venta del servidor (retomar, editar o duplicar): lo que tiene pasa a la pantalla.
  const [abierta, setAbierta] = useState(false)
  const cargada = useVentaCargada(abrir?.ventaId, !abierta)
  const [aDuplicar, setADuplicar] = useState<VentaCargada | null>(null)
  const aplicar = (d: VentaCargada, cabecera = d.cabecera, proponerFecha = true) => {
    useCarritoVenta.setState({ lineas: d.lineas })
    setDescuentoTexto(mostrarNumero(d.descuentoGeneral))
    setDescuentoValido(d.descuentoGeneral)
    cab.hidratar(cabecera, proponerFecha)
  }
  useEffect(() => {
    const d = cargada.datos
    if (!abrir || !d || abierta) return
    setAbierta(true)
    setCliente(d.cliente)
    if (abrir.modo === 'retomar') {
      aplicar(d)
      setTipo(abrir.tipo)
      b.retomar(abrir.ventaId, d.version)
    } else if (abrir.modo === 'editar') {
      // Una venta guardada sin fecha no recibe una que el vendedor no eligió.
      aplicar(d, d.cabecera, false)
      setTipo(d.tipo)
      setEdicion({ ventaId: abrir.ventaId, version: d.version, codigo: d.codigo })
    } else {
      // Duplicar: primero el borrador nuevo; las líneas entran cuando existe, así se autoguardan en él.
      setTipo(d.tipo)
      setADuplicar(d)
      void b.crear(d.cliente.id)
    }
  })
  useEffect(() => {
    if (!aDuplicar || (!b.borrador && !b.errorAlCrear)) return
    // La fecha de entrega no se copia: se propone el próximo día hábil.
    aplicar(aDuplicar, { ...aDuplicar.cabecera, fecha: null })
    setADuplicar(null)
  })

  if (abrir && !abierta) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar title={abrir.modo === 'retomar' ? 'Retomar borrador' : abrir.modo === 'editar' ? 'Editar venta' : 'Duplicar venta'} leading={volver} />
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
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar title="Nueva venta" leading={volver} />
        <SeleccionarClienteSheet
          visible
          onClose={() => router.back()}
          onSelect={(elegido, t) => { setCliente(elegido); setTipo(t); void b.crear(elegido.id) }}
          onNuevoCliente={() => router.push('/(tabs)/socios/nuevo' as never)}
        />
      </View>
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
  const rotulo = nombre ? `${direccionDeEntrega(cliente)} · ${nombre}` : direccionDeEntrega(cliente)
  const lineasVista = (
    <LineasVenta lineas={lineas} {...avisos} tope={tope}
      nota={retenido && b.borrador ? `El borrador guarda los descuentos hasta tu tope (${mostrarNumero(tope)} %); el resto se guarda al confirmar el pedido.` : null} descuentoTexto={descuentoTexto} descuentoGeneral={descuentoGeneral} flete={cab.cabecera.flete}
      onDescuento={setDescuentoTexto} onAgregar={() => setCatalogo(true)} onEditar={setEditando}
      onElegirFragancias={setFragancias} nombrePadre={(id) => catalogoVenta.find((p) => p.id === id)?.nombre} />
  )
  const cabeceraVista = <CabeceraVenta clienteId={cliente.id} rotuloCliente={rotulo} cab={cab} />
  const franjaTotal = (
    <View style={{ padding: space[4], gap: space[1], borderColor: c.border, borderTopWidth: isTabletLandscape ? 0 : 1, borderBottomWidth: isTabletLandscape ? 1 : 0, backgroundColor: c.surface }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>Total estimado</Text>
        <Text testID="venta-total" style={{ ...typeScale.titulo, ...importe, color: c.text }}>{formatImporte(total)}</Text>
      </View>
      {comision !== null ? (
        <Text style={{ ...typeScale.secundario, alignSelf: 'flex-start', paddingHorizontal: space[2], borderRadius: radii.pastilla, backgroundColor: c.brandSoft, color: c.brandInk }}>
          {`Tu comisión estimada ${formatImporte(comision)}`}
        </Text>
      ) : null}
      {conf.error ? <Notice tone="peligro">{conf.error}</Notice> : null}
      <Button
        label={edicion ? 'Guardar cambios' : tipo === 'Pedido' ? 'Confirmar pedido' : 'Guardar presupuesto'}
        onPress={() => void conf.confirmar()}
        loading={conf.enviando}
        disabled={lineas.length === 0 || descuentoGeneral === null || cab.fleteInvalido || !!cab.cesionError || conf.enviando}
      />
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar
        title={edicion ? `Editar ${tipo.toLowerCase()} ${edicion.codigo}` : tipo === 'Pedido' ? 'Nuevo pedido' : 'Nuevo presupuesto'}
        subtitle={rotulo}
        leading={volver}
        syncLabel={b.etiqueta}
        actions={b.borrador ? [{ icon: Trash2, accessibilityLabel: 'Descartar borrador', onPress: descartar }] : []}
        // Tablet horizontal (plan §8): Líneas y Cabecera lado a lado, sin pestañas.
        tabs={isTabletLandscape ? undefined : [
          { label: `Líneas (${lineas.length})`, selected: pestana === 'lineas', onPress: () => setPestana('lineas') },
          { label: 'Cabecera', selected: pestana === 'cabecera', onPress: () => setPestana('cabecera') },
        ]}
      />
      {aviso ? (
        <View style={{ padding: space[4], paddingBottom: 0, gap: space[2] }}>
          <Notice tone="peligro">{aviso}</Notice>
          {b.estado === 'error' && b.reintentable ? <Button label="Reintentar" variant="secundario" onPress={b.reintentar} /> : null}
        </View>
      ) : null}
      {isTabletLandscape ? franjaTotal : null}
      {isTabletLandscape ? (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={{ flex: 3 }}>{lineasVista}</View>
          <View style={{ flex: 2, borderLeftWidth: 1, borderLeftColor: c.border }}>{cabeceraVista}</View>
        </View>
      ) : <View style={{ flex: 1 }}>{pestana === 'lineas' ? lineasVista : cabeceraVista}</View>}
      {isTabletLandscape ? null : franjaTotal}
      <Modal visible={catalogo} animationType="slide" onRequestClose={() => setCatalogo(false)}>
        <TopBar title="Agregar productos" leading={{ kind: 'atras', onPress: () => setCatalogo(false) }} />
        <CatalogoVenta onVerVenta={() => setCatalogo(false)} />
      </Modal>
      <BottomSheet visible={conf.pedirMotivo} onClose={conf.cerrarMotivo} accessibilityLabel="Motivo sin stock">
        <View style={{ gap: space[3] }}>
          <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>Falta stock</Text>
          <Text style={{ ...typeScale.cuerpo, color: c.text }}>Para guardar el pedido sin stock, contá por qué. Va a quedar por autorizar.</Text>
          <Field label="Motivo" value={motivo} onChangeText={setMotivo} placeholder="Ej.: el cliente espera la reposición del lunes." multiline />
          <Button label="Confirmar con este motivo" disabled={!motivo.trim() || conf.enviando} loading={conf.enviando} onPress={() => void conf.confirmar(motivo)} />
        </View>
      </BottomSheet>
      <EditarLineaSheet linea={editando} onClose={() => setEditando(null)}
        onConfirm={(l) => { reemplazar(l); setEditando(null) }} onQuitar={(id) => { quitar(id); setEditando(null) }} />
      <FraganciasSheet padreId={fragancias} onClose={() => setFragancias(null)} />
    </View>
  )
}
