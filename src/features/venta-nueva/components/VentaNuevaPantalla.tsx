import React, { useEffect, useMemo, useState } from 'react'
import { Alert, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Trash2 } from 'lucide-react-native'
import { space, useColors } from '@/libs/theme'
import { Notice, TopBar } from '@/core/ui/fw'
import { SeleccionarClienteSheet, type TipoDocumento } from '@/features/clientes/components/SeleccionarClienteSheet'
import { direccionDeEntrega, nombreDelCliente } from '@/features/clientes/lib/cliente'
import type { ClienteElegido } from '@/features/clientes/lib/recientes'
import { useCarritoVenta } from '../hooks/useCarritoVenta'
import { useBorradorVenta } from '../hooks/useBorradorVenta'
import { aAutoguardado } from '../lib/payload'
import { CatalogoVenta } from './CatalogoVenta'

/** Venta nueva (plan 9, fase 2): elegir cliente crea el borrador en el servidor y desde ahí se autoguarda. */
export function VentaNuevaPantalla() {
  const c = useColors()
  const router = useRouter()
  const [cliente, setCliente] = useState<ClienteElegido | null>(null)
  const [tipo, setTipo] = useState<TipoDocumento>('Pedido')
  const lineas = useCarritoVenta((s) => s.lineas)
  const vaciar = useCarritoVenta((s) => s.vaciar)
  const b = useBorradorVenta(useMemo(() => aAutoguardado(lineas), [lineas]))
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
      <CatalogoVenta onVerVenta={() => {}} />
    </View>
  )
}
