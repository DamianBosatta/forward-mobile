import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native'
import { Plus, Search } from 'lucide-react-native'
import { useQueryClient } from '@tanstack/react-query'
import { fetchSocio, sociosKeys, useClientesRecientes } from '@/libs/api-client/socios'
import { radii, space, typeScale, useColors } from '@/libs/theme'
import { Notice, StatusChip } from '@/core/ui/fw'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { FiltrosCartera, SIN_FILTROS, type FiltrosDeCartera } from '@/features/clientes/components/FiltrosCartera'
import { useCartera } from '@/features/clientes/hooks/useCartera'
import { direccionDeEntrega, inicialesDeDireccion, nombreDelCliente } from '@/features/clientes/lib/cliente'
import { aElegido, fusionarRecientes, guardarReciente, leerRecientes, quitarReciente, type ClienteElegido } from '@/features/clientes/lib/recientes'

interface Props {
  onElegir: (cliente: ClienteElegido) => void
  onNuevoCliente: () => void
  /** Tablet: el cliente que ya está abierto en el panel de la derecha. */
  seleccionadoId?: string
}

class ClienteNoDisponible extends Error {}

/**
 * V2 "¿A quién le vendés?" (CalleCliente / TabCalleCliente): búsqueda en el servidor sobre la cartera del vendedor,
 * filtros de la cartera (deuda vencida y localidad; los decide el servidor), recientes y alta. Devuelve solo el
 * cliente: el tipo (Pedido o Presupuesto) se elige después, en V3. La cartera la acota el servidor (`agenda`):
 * un cliente de otro vendedor no llega, así que no hay filas bloqueadas (regla de gestión de cartera: pendiente T1).
 *
 * La verificación de un reciente es la de `SeleccionarClienteSheet`, que queda sin uso en la app cuando se
 * borre la venta vieja (T3): ahí se borra la hoja y esta copia es la única.
 */
export function ElegirClienteVenta({ onElegir, onNuevoCliente, seleccionadoId }: Props) {
  const c = useColors()
  const usuarioId = useAuthStore((s) => s.user?.id)
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState<FiltrosDeCartera>(SIN_FILTROS)
  const { clientes, isLoading, error, cargarMas, totalCount } = useCartera(busqueda, filtros)
  const buscando = busqueda.trim().length > 0
  const qc = useQueryClient()
  const [guardados, setGuardados] = useState(() => leerRecientes(usuarioId))
  const [aviso, setAviso] = useState<string | null>(null)
  const [noDisponibles, setNoDisponibles] = useState<string[]>([])
  const delServidor = useClientesRecientes(true)
  useEffect(() => { setGuardados(leerRecientes(usuarioId)) }, [usuarioId])
  const recientes = buscando ? [] : fusionarRecientes(delServidor.data, guardados, noDisponibles)

  const elegir = (cliente: ClienteElegido) => {
    guardarReciente(usuarioId, cliente)
    onElegir(aElegido(cliente))
  }

  // Un reciente es una foto vieja: se confirma con el servidor que sigue en la cartera y se usa el dato fresco.
  const verificando = useRef(false)
  const elegirReciente = async (reciente: ClienteElegido) => {
    if (verificando.current) return
    verificando.current = true
    setAviso(null)
    try {
      const fresco = await qc.fetchQuery({ queryKey: sociosKeys.detail(reciente.id), queryFn: () => fetchSocio(reciente.id), staleTime: 0 })
      if (!fresco.activo) throw new ClienteNoDisponible()
      elegir(fresco)
    } catch (e) {
      // Solo si el servidor lo niega (403/404) o está de baja se quita; una falla de red o 5xx deja el reciente.
      if (e instanceof ClienteNoDisponible || [403, 404].includes((e as { status?: number })?.status ?? 0)) {
        quitarReciente(usuarioId, reciente.id)
        setGuardados(leerRecientes(usuarioId))
        setNoDisponibles((ids) => [...ids, reciente.id])
        setAviso('Ese cliente ya no está disponible en tu cartera.')
      } else {
        setAviso('No se pudo verificar el cliente. Probá de nuevo.')
      }
    } finally {
      verificando.current = false
    }
  }

  const titulo = (t: string) => (
    <Text accessibilityRole="header" style={{ ...typeScale.secundario, fontFamily: typeScale.cuerpoDestacado.fontFamily, fontWeight: '600', color: c.textSecondary }}>{t}</Text>
  )

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FiltrosCartera valor={filtros} onCambio={setFiltros} totalCartera={totalCount} />
      <View style={{ padding: space[4], gap: space[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], height: 52, borderRadius: radii.campo, backgroundColor: c.surface2, paddingHorizontal: space[3], borderWidth: 2, borderColor: c.brand }}>
          <Search size={20} color={c.textSecondary} />
          <TextInput
            accessibilityLabel="Buscar cliente"
            placeholder="Dirección, nombre o código"
            placeholderTextColor={c.textSecondary}
            value={busqueda}
            onChangeText={setBusqueda}
            autoCorrect={false}
            style={{ ...typeScale.cuerpo, flex: 1, color: c.text, paddingVertical: 0 }}
          />
        </View>
        {aviso ? <Notice tone="peligro">{aviso}</Notice> : null}
        {error ? <Notice tone="peligro">{mensajeDelServidor(error, 'No se pudo cargar la cartera.')}</Notice> : null}
      </View>
      <FlatList
        style={{ flex: 1 }}
        data={clientes}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        onEndReached={cargarMas}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View style={{ gap: space[2], paddingHorizontal: space[4], paddingBottom: space[2] }}>
            {recientes.length > 0 ? (
              <>
                {titulo('Recientes')}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
                  {recientes.map((r) => {
                    const direccion = direccionDeEntrega(r)
                    return (
                      <Pressable key={`r-${r.id}`} accessibilityRole="button" accessibilityLabel={`Reciente: ${direccion}`} onPress={() => { void elegirReciente(r) }}
                        style={{ width: '23%', minHeight: 44, alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 52, height: 52, borderRadius: radii.pastilla, backgroundColor: c.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ ...typeScale.cuerpoDestacado, color: c.brandInk }}>{inicialesDeDireccion(direccion)}</Text>
                        </View>
                        <Text numberOfLines={2} style={{ ...typeScale.etiqueta, color: c.text, textAlign: 'center' }}>{direccion}</Text>
                      </Pressable>
                    )
                  })}
                </View>
              </>
            ) : null}
            {titulo(buscando ? 'Resultados' : 'Tu cartera')}
          </View>
        }
        renderItem={({ item }) => {
          const direccion = direccionDeEntrega(item)
          const nombre = nombreDelCliente(item)
          const vencida = item.tieneDeudaVencida === true
          const sel = item.id === seleccionadoId
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: sel }}
              accessibilityLabel={[direccion, nombre, vencida && 'deuda vencida'].filter(Boolean).join(', ')}
              onPress={() => elegir(item)}
              style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3], borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: sel ? c.brandSoft : 'transparent' }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{direccion}</Text>
                {nombre ? <Text numberOfLines={1} style={{ ...typeScale.secundario, color: c.textSecondary }}>{nombre}</Text> : null}
              </View>
              {vencida ? <StatusChip estado="anulado" label="Deuda vencida" /> : null}
            </Pressable>
          )
        }}
        ListEmptyComponent={
          isLoading ? <ActivityIndicator color={c.brandInk} /> : error ? null : (
            <Text style={{ ...typeScale.secundario, color: c.textSecondary, paddingHorizontal: space[4] }}>
              {buscando ? 'Ningún cliente coincide con la búsqueda.' : 'Todavía no hay clientes en tu cartera.'}
            </Text>
          )
        }
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Nuevo cliente"
        onPress={onNuevoCliente}
        style={{ minHeight: 48, margin: space[4], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2], borderRadius: radii.campo, borderWidth: 1, borderColor: c.border }}
      >
        <Plus size={20} color={c.brandInk} />
        <Text style={{ ...typeScale.cuerpoDestacado, color: c.brandInk }}>Nuevo cliente</Text>
      </Pressable>
    </View>
  )
}
