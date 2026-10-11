import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Modal, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Trash2 } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { Notice, TopBar, formatImporte } from '@/core/ui/fw'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { hasCapability } from '@/features/auth/lib/capabilities'
import { SeleccionarClienteSheet, type TipoDocumento } from '@/features/clientes/components/SeleccionarClienteSheet'
import { direccionDeEntrega, nombreDelCliente } from '@/features/clientes/lib/cliente'
import type { ClienteElegido } from '@/features/clientes/lib/recientes'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
import { useBorradorVenta } from '../hooks/useBorradorVenta'
import { useComisionEstimada } from '../hooks/useComisionEstimada'
import { aAutoguardado } from '../lib/payload'
import { avisosVenta, totalesEstimados } from '../lib/avisos'
import { leerNumero } from '../lib/linea'
import type { LineaCarrito } from '../lib/carrito'
import { CatalogoVenta } from './CatalogoVenta'
import { EditarLineaSheet } from './EditarLineaSheet'
import { LineasVenta } from './LineasVenta'

/** Venta nueva (plan 9, fase 2): elegir cliente crea el borrador en el servidor y desde ahí se autoguarda. */
export function VentaNuevaPantalla() {
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
  const b = useBorradorVenta(useMemo(() => aAutoguardado(lineas, descuentoValido), [lineas, descuentoValido]))
  const comision = useComisionEstimada(lineas, descuentoValido)
  const [catalogo, setCatalogo] = useState(false)
  const [editando, setEditando] = useState<LineaCarrito | null>(null)
  const volver = { kind: 'atras' as const, onPress: () => router.back() }

  // Cada venta nueva arranca con el carrito vacío.
  useEffect(() => { vaciar() }, [vaciar])

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
  const tope = user?.maxDescuentoPorcentaje ?? 0
  const avisos = avisosVenta(lineas, { tipo, tope, exento: hasCapability(user?.permissions, 'CAP_EXENTO_TOPE_DESCUENTO'), descuentoGeneral: descuentoValido })
  const { total } = totalesEstimados(lineas, descuentoValido)

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar
        title={tipo === 'Pedido' ? 'Nuevo pedido' : 'Nuevo presupuesto'}
        subtitle={nombre ? `${direccionDeEntrega(cliente)} · ${nombre}` : direccionDeEntrega(cliente)}
        leading={volver}
        syncLabel={b.etiqueta}
        actions={b.borrador ? [{ icon: Trash2, accessibilityLabel: 'Descartar borrador', onPress: descartar }] : []}
      />
      {aviso ? <View style={{ padding: space[4], paddingBottom: 0 }}><Notice tone="peligro">{aviso}</Notice></View> : null}
      <View style={{ flex: 1 }}>
        <LineasVenta lineas={lineas} {...avisos} tope={tope} descuentoTexto={descuentoTexto} descuentoGeneral={descuentoGeneral}
          onDescuento={setDescuentoTexto} onAgregar={() => setCatalogo(true)} onEditar={setEditando} />
      </View>
      <View style={{ padding: space[4], gap: space[1], borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>Total estimado</Text>
          <Text testID="venta-total" style={{ ...typeScale.titulo, ...importe, color: c.text }}>{formatImporte(total)}</Text>
        </View>
        {comision !== null ? (
          <Text style={{ ...typeScale.secundario, alignSelf: 'flex-start', paddingHorizontal: space[2], borderRadius: radii.pastilla, backgroundColor: c.brandSoft, color: c.brandInk }}>
            {`Tu comisión estimada ${formatImporte(comision)}`}
          </Text>
        ) : null}
      </View>
      <Modal visible={catalogo} animationType="slide" onRequestClose={() => setCatalogo(false)}>
        <TopBar title="Agregar productos" leading={{ kind: 'atras', onPress: () => setCatalogo(false) }} />
        <CatalogoVenta onVerVenta={() => setCatalogo(false)} />
      </Modal>
      <EditarLineaSheet linea={editando} onClose={() => setEditando(null)}
        onConfirm={(l) => { reemplazar(l); setEditando(null) }} onQuitar={(id) => { quitar(id); setEditando(null) }} />
    </View>
  )
}
