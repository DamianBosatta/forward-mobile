import React, { useState } from 'react'
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native'
import { Pressable } from '@/core/ui/fw/Pressable'
import { useRouter } from 'expo-router'
import { Search } from 'lucide-react-native'
import { radii, shadowMd, space, typeScale, useColors, useIsDark } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { Button, Notice, StatusChip, TopBar, chipForEstado, formatImporte, iniciales } from '@/core/ui/fw'
import { usePermissions } from '@/core/auth/RequirePermission'
import { useInfiniteVentas } from '@/libs/api-client/ventas'
import type { Venta } from '@/libs/api-client'
import type { SocioListDto } from '@/libs/api-client/types'
import { useCartera, useValorDiferido } from '@/features/clientes/hooks/useCartera'
import { direccionDeEntrega, nombreDelCliente } from '@/features/clientes/lib/cliente'
import { tituloDelDia } from '@/features/ventas/lib/agruparPorDia'
import { parseDateSafe } from '@/src/utils/date'
import { useVenderA } from '@/features/venta-nueva/hooks/useVenderA'
import { MINIMO_BUSQUEDA, clientesConCuenta, seccionesVisibles } from './lib/secciones'

const MAX_POR_SECCION = 5

type Estado = 'cargando' | 'error' | 'vacio' | 'ok'

/**
 * Buscar (láminas R14 y TM14): un solo campo sobre clientes, ventas y cuenta corriente. Cada sección
 * usa la consulta de su módulo (la búsqueda la hace el servidor) y aparece solo si el usuario puede
 * leer ese módulo. En tablet las secciones van en columnas.
 */
export function BuscarScreen() {
  const c = useColors()
  const router = useRouter()
  const { isTablet } = useResponsive()
  const { canDo } = usePermissions()
  const [texto, setTexto] = useState('')
  const termino = texto.trim()
  const visibles = seccionesVisibles(canDo)
  const hayAlguna = visibles.clientes || visibles.ventas || visibles.cuentas
  const buscando = termino.length >= MINIMO_BUSQUEDA

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title="Buscar" leading={{ kind: 'atras', onPress: () => router.back() }} />
      <View style={{ backgroundColor: c.topBar, paddingHorizontal: space[4], paddingVertical: space[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], height: space[12], borderRadius: radii.campo, backgroundColor: c.surface, paddingHorizontal: space[3] }}>
          <Search size={20} color={c.textSecondary} />
          <TextInput
            accessibilityLabel="Buscar"
            placeholder="Cliente, pedido o cuenta"
            placeholderTextColor={c.textSecondary}
            value={texto}
            onChangeText={setTexto}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
            style={{ ...typeScale.cuerpo, flex: 1, color: c.text, paddingVertical: 0 }}
          />
        </View>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space[4], gap: space[4], paddingBottom: space[12] }}>
        {!hayAlguna ? (
          <Notice tone="peligro">Tu usuario no tiene acceso a ningún módulo para buscar.</Notice>
        ) : !buscando ? (
          <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>{`Escribí al menos ${MINIMO_BUSQUEDA} letras para buscar.`}</Text>
        ) : (
          <View testID="buscar-resultados" style={{ flexDirection: isTablet ? 'row' : 'column', alignItems: isTablet ? 'flex-start' : 'stretch', gap: space[4] }}>
            {visibles.clientes ? <SeccionClientes termino={termino} columna={isTablet} /> : null}
            {visibles.ventas ? <SeccionVentas termino={termino} columna={isTablet} /> : null}
            {visibles.cuentas ? <SeccionCuentas termino={termino} columna={isTablet} /> : null}
          </View>
        )}
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
          La búsqueda solo muestra lo que tu usuario puede ver.
        </Text>
      </ScrollView>
    </View>
  )
}

function Seccion({ titulo, cantidad, testID, columna, estado, children }: {
  titulo: string
  cantidad?: number
  testID: string
  columna: boolean
  estado: Estado
  children?: React.ReactNode
}) {
  const c = useColors()
  return (
    <View testID={testID} style={{ gap: space[2], ...(columna ? { flex: 1, minWidth: 0 } : null) }}>
      <Text accessibilityRole="header" style={{ ...typeScale.etiqueta, color: c.textSecondary }}>
        {cantidad !== undefined ? `${titulo.toUpperCase()} · ${cantidad}` : titulo.toUpperCase()}
      </Text>
      {estado === 'cargando' ? <ActivityIndicator color={c.brand} accessibilityLabel={`Buscando en ${titulo}`} /> : null}
      {estado === 'error' ? <Notice tone="peligro">{`No se pudo buscar en ${titulo.toLowerCase()}.`}</Notice> : null}
      {estado === 'vacio' ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Sin resultados.</Text> : null}
      {estado === 'ok' ? children : null}
    </View>
  )
}

function Fila({ etiqueta, avatar, titulo, detalle, derecha, chip, onPress }: {
  etiqueta: string
  avatar?: string
  titulo: string
  detalle?: string | null
  derecha?: string
  chip?: React.ComponentProps<typeof StatusChip> | null
  onPress: () => void
}) {
  const c = useColors()
  const sombra = shadowMd[useIsDark() ? 'dark' : 'light']
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={onPress}
      style={({ pressed }) => [
        { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 44, padding: space[3], borderRadius: radii.tarjeta, backgroundColor: pressed ? c.surface2 : c.surface },
        sombra,
      ]}
    >
      {avatar ? (
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ width: 40, height: 40, borderRadius: radii.pastilla, backgroundColor: c.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ ...typeScale.secundario, color: c.brandInk }}>{avatar}</Text>
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{titulo}</Text>
        {detalle ? <Text numberOfLines={1} style={{ ...typeScale.secundario, color: c.textSecondary }}>{detalle}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: space[1] }}>
        {derecha ? <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{derecha}</Text> : null}
        {chip ? <StatusChip {...chip} /> : null}
      </View>
    </Pressable>
  )
}

function estadoDe(cargando: boolean, error: unknown, n: number): Estado {
  if (cargando) return 'cargando'
  if (error) return 'error'
  return n === 0 ? 'vacio' : 'ok'
}

/** Clientes y cuenta corriente salen de la misma cartera del servidor (misma consulta, una sola vez). */
function useClientesEncontrados(termino: string) {
  const q = useCartera(termino)
  const pendiente = useValorDiferido(termino) !== termino
  return { ...q, pendiente }
}

function SeccionClientes({ termino, columna }: { termino: string; columna: boolean }) {
  const router = useRouter()
  const venderA = useVenderA()
  const q = useClientesEncontrados(termino)
  const lista = q.clientes.slice(0, MAX_POR_SECCION)
  const espera = q.isLoading || q.pendiente
  return (
    <Seccion titulo="Clientes" testID="buscar-clientes" columna={columna} cantidad={espera ? undefined : q.totalCount} estado={estadoDe(espera, q.error, lista.length)}>
      {lista.map((cl) => {
        const direccion = direccionDeEntrega(cl)
        const nombre = nombreDelCliente(cl)
        const fila = (
          <Fila
            key={cl.id}
            etiqueta={[direccion, nombre].filter(Boolean).join(', ')}
            avatar={iniciales(direccion)}
            titulo={direccion}
            detalle={nombre}
            onPress={() => router.push({ pathname: '/(tabs)/socios/[id]', params: { id: cl.id } })}
          />
        )
        // Lienzo ResBuscar: la fila lleva su botón "Vender" (solo con la venta nueva y permiso para crear ventas).
        return venderA ? (
          <View key={cl.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <View style={{ flex: 1, minWidth: 0 }}>{fila}</View>
            <Button label="Vender" accessibilityLabel={`Vender a ${direccion}`} onPress={() => router.push(venderA(cl.id) as never)} />
          </View>
        ) : fila
      })}
    </Seccion>
  )
}

function SeccionCuentas({ termino, columna }: { termino: string; columna: boolean }) {
  const router = useRouter()
  const q = useClientesEncontrados(termino)
  const lista: SocioListDto[] = clientesConCuenta(q.clientes).slice(0, MAX_POR_SECCION)
  const espera = q.isLoading || q.pendiente
  return (
    <Seccion titulo="Cuenta corriente" testID="buscar-cuentas" columna={columna} cantidad={espera ? undefined : lista.length} estado={estadoDe(espera, q.error, lista.length)}>
      {lista.map((cl) => {
        const direccion = direccionDeEntrega(cl)
        const saldo = formatImporte(cl.saldoAmount)
        return (
          <Fila
            key={cl.id}
            etiqueta={`Cuenta de ${direccion}, saldo ${saldo}${cl.tieneDeudaVencida ? ', deuda vencida' : ''}`}
            titulo={direccion}
            detalle={cl.tieneDeudaVencida ? `Vencido ${formatImporte(cl.deudaVencidaAmount)}` : nombreDelCliente(cl)}
            derecha={saldo}
            onPress={() => router.push({ pathname: '/(tabs)/cuentas/[id]', params: { id: cl.id } })}
          />
        )
      })}
    </Seccion>
  )
}

function fechaCorta(iso: string): string {
  const f = parseDateSafe(iso)
  return f ? tituloDelDia(f) : ''
}

function SeccionVentas({ termino, columna }: { termino: string; columna: boolean }) {
  const c = useColors()
  const router = useRouter()
  const diferido = useValorDiferido(termino)
  const q = useInfiniteVentas({ pageSize: MAX_POR_SECCION, searchTerm: diferido })
  const espera = q.isLoading || diferido !== termino
  const ventas: Venta[] = (q.data?.pages[0]?.items ?? []).slice(0, MAX_POR_SECCION)
  const total = q.data?.pages[0]?.totalCount
  return (
    <Seccion titulo="Ventas" testID="buscar-ventas" columna={columna} cantidad={espera ? undefined : total} estado={estadoDe(espera, q.error, ventas.length)}>
      {ventas.map((v) => {
        const direccion = v.direccionCliente?.trim() || v.nombreFantasiaCliente?.trim() || v.razonSocialCliente
        const tipo = v.tipoOperacion === 1 ? 'Presupuesto' : 'Pedido'
        const numero = v.codigoPedido ?? v.id.slice(0, 8).toUpperCase()
        const importe = formatImporte(v.totalAmount)
        const chip = chipForEstado('venta', v.estado)
        return (
          <Fila
            key={v.id}
            etiqueta={[`${tipo} ${numero}`, direccion, fechaCorta(v.fecha), importe, chip?.label].filter(Boolean).join(', ')}
            titulo={`${tipo} ${numero}`}
            detalle={`${direccion} · ${fechaCorta(v.fecha)}`}
            derecha={importe}
            chip={chip}
            onPress={() => router.push(`/(tabs)/ventas/${v.id}` as never)}
          />
        )
      })}
      {total !== undefined && total > ventas.length ? (
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
          {`Se muestran ${ventas.length} de ${total} ventas. Afiná la búsqueda para ver el resto.`}
        </Text>
      ) : null}
    </Seccion>
  )
}
