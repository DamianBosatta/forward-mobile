import React, { useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native'
import { Plus, Search } from 'lucide-react-native'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { BottomSheet, Notice, Segmented } from '@/core/ui/fw'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { useCartera } from '../hooks/useCartera'
import { direccionDeEntrega, inicialesDeDireccion, nombreDelCliente } from '../lib/cliente'
import { aElegido, guardarReciente, leerRecientes, type ClienteElegido } from '../lib/recientes'

export type TipoDocumento = 'Presupuesto' | 'Pedido'

interface SeleccionarClienteSheetProps {
  visible: boolean
  onClose: () => void
  onSelect: (cliente: ClienteElegido, tipoDocumento: TipoDocumento) => void
  onNuevoCliente: () => void
  tipoInicial?: TipoDocumento
}

const TIPOS = [
  { value: 'Presupuesto' as const, label: 'Presupuesto' },
  { value: 'Pedido' as const, label: 'Pedido' },
]

function Fila({ cliente, onPress }: { cliente: ClienteElegido; onPress: () => void }) {
  const c = useColors()
  const direccion = direccionDeEntrega(cliente)
  const nombre = nombreDelCliente(cliente)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={nombre ? `${direccion}, ${nombre}` : direccion}
      onPress={onPress}
      style={({ pressed }) => ({ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space[3], opacity: pressed ? 0.85 : 1 })}
    >
      <View style={{ width: 40, height: 40, borderRadius: radii.pastilla, backgroundColor: c.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ ...typeScale.secundario, color: c.brandInk }}>{inicialesDeDireccion(direccion)}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{direccion}</Text>
        {nombre ? <Text numberOfLines={1} style={{ ...typeScale.secundario, color: c.textSecondary }}>{nombre}</Text> : null}
      </View>
    </Pressable>
  )
}

function Titulo({ children }: { children: string }) {
  const c = useColors()
  return <Text accessibilityRole="header" style={{ ...typeScale.secundario, fontFamily: typeScale.cuerpoDestacado.fontFamily, fontWeight: '600', color: c.textSecondary }}>{children}</Text>
}

/**
 * Hoja "¿A quién le vendés?" (láminas Cliente y TabCliente): tipo de documento, búsqueda en el
 * servidor sobre la cartera, recientes de este usuario y alta. Devuelve el cliente y el tipo.
 */
export function SeleccionarClienteSheet({ visible, onClose, onSelect, onNuevoCliente, tipoInicial = 'Pedido' }: SeleccionarClienteSheetProps) {
  const c = useColors()
  const { height } = useWindowDimensions()
  const usuarioId = useAuthStore(s => s.user?.id)
  const [tipo, setTipo] = useState<TipoDocumento>(tipoInicial)
  const [busqueda, setBusqueda] = useState('')
  const { clientes, isLoading, error, cargarMas } = useCartera(busqueda)
  const buscando = busqueda.trim().length > 0
  const recientes = buscando ? [] : leerRecientes(usuarioId)

  const elegir = (cliente: ClienteElegido) => {
    guardarReciente(usuarioId, cliente)
    onSelect(aElegido(cliente), tipo)
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} accessibilityLabel="Elegir cliente">
      <View style={{ gap: space[1] }}>
        <Text accessibilityRole="header" style={{ ...typeScale.titulo, color: c.text }}>¿A quién le vendés?</Text>
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Tu cartera, por dirección de entrega</Text>
      </View>
      <Segmented options={TIPOS} value={tipo} onChange={setTipo} accessibilityLabel="Tipo de documento" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], height: space[12], borderRadius: radii.campo, backgroundColor: c.surface2, paddingHorizontal: space[3] }}>
        <Search size={20} color={c.textSecondary} />
        <TextInput
          accessibilityLabel="Buscar cliente"
          placeholder="Dirección, nombre o CUIT"
          placeholderTextColor={c.textSecondary}
          value={busqueda}
          onChangeText={setBusqueda}
          autoCorrect={false}
          style={{ ...typeScale.cuerpo, flex: 1, color: c.text, paddingVertical: 0 }}
        />
      </View>
      {error ? <Notice tone="peligro">{mensajeDelServidor(error, 'No se pudo cargar la cartera.')}</Notice> : null}
      <FlatList
        style={{ maxHeight: height * 0.45 }}
        data={clientes}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="handled"
        onEndReached={cargarMas}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View style={{ gap: space[2] }}>
            {recientes.length > 0 ? (
              <>
                <Titulo>Recientes</Titulo>
                {recientes.map(r => <Fila key={`r-${r.id}`} cliente={r} onPress={() => elegir(r)} />)}
              </>
            ) : null}
            <Titulo>{buscando ? 'Resultados' : 'Cartera'}</Titulo>
          </View>
        }
        renderItem={({ item }) => <Fila cliente={item} onPress={() => elegir(item)} />}
        ListEmptyComponent={
          isLoading ? <ActivityIndicator color={c.brandInk} /> : error ? null : (
            <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
              {buscando ? 'Ningún cliente coincide con la búsqueda.' : 'Todavía no hay clientes en tu cartera.'}
            </Text>
          )
        }
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Nuevo cliente"
        onPress={onNuevoCliente}
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2] }}
      >
        <Plus size={20} color={c.brandInk} />
        <Text style={{ ...typeScale.cuerpoDestacado, color: c.brandInk }}>Nuevo cliente</Text>
      </Pressable>
    </BottomSheet>
  )
}
