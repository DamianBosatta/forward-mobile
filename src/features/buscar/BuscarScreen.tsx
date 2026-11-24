import React, { useState } from 'react'
import { ScrollView, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Search } from 'lucide-react-native'
import { importe, radii, space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { Button, Notice, StatusChip, TopBar, chipForEstado, formatImporte, iniciales, useInsetInferior } from '@/core/ui/fw'
import { PressableFx } from '@/core/ui/fw/PressableFx'
import { usePermissions } from '@/core/auth/RequirePermission'
import { useInfiniteVentas } from '@/libs/api-client/ventas'
import type { Venta } from '@/libs/api-client'
import type { SocioListDto } from '@/libs/api-client/types'
import { useCartera, useValorDiferido } from '@/features/clientes/hooks/useCartera'
import { Esqueletos } from '@/features/clientes/components/Esqueletos'
import { clienteDeVenta } from '@/features/inicio/lib/clienteDeVenta'
import { direccionDeEntrega, nombreDelCliente } from '@/features/clientes/lib/cliente'
import { fechaCorta } from '@/core/utils/fecha'
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
  const insetInferior = useInsetInferior()
  const c = useColors()
  const router = useRouter()
  const { isTablet, isTabletLandscape } = useResponsive()
  const { canDo } = usePermissions()
  const [texto, setTexto] = useState('')
  const termino = texto.trim()
  const visibles = seccionesVisibles(canDo)
  const hayAlguna = visibles.clientes || visibles.ventas || visibles.cuentas
  const buscando = termino.length >= MINIMO_BUSQUEDA

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Propuesta de Cuenta, frame 14: el campo va dentro de la barra, en lugar del título. */}
      <TopBar
        title="Buscar"
        leading={{ kind: 'atras', onPress: () => router.back() }}
        campo={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], height: space[12] + space[1], borderRadius: radii.pastilla, backgroundColor: c.surface, paddingHorizontal: space[4] }}>
            <Search size={20} color={c.onTopBarStrong} />
            <TextInput
              accessibilityLabel="Buscar"
              placeholder="Cliente, venta o cuenta"
              placeholderTextColor={c.onTopBar}
              cursorColor={c.onTopBarStrong}
              value={texto}
              onChangeText={setTexto}
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
              style={{ ...typeScale.cuerpo, flex: 1, color: c.onTopBarStrong, paddingVertical: 0 }}
            />
          </View>
        }
      />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space[4], gap: space[4], paddingBottom: space[12] + insetInferior }}>
        {!hayAlguna ? (
          <Notice tone="peligro">Tu usuario no tiene acceso a ningún módulo para buscar.</Notice>
        ) : !buscando ? (
          // Propuesta Cuenta, frame 14: la lupa en círculo con el mismo pedido de letras.
          <View testID="buscar-antes" style={{ alignItems: 'center', gap: space[3], paddingTop: space[12], paddingHorizontal: space[4] }}>
            <View style={{ width: 96, height: 96, borderRadius: radii.pastilla, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Search size={40} color={c.textSecondary} />
            </View>
            <Text style={{ ...typeScale.cuerpo, color: c.textSecondary, textAlign: 'center' }}>{`Escribí al menos ${MINIMO_BUSQUEDA} letras para buscar.`}</Text>
          </View>
        ) : (
          <View testID="buscar-resultados" style={{ flexDirection: isTabletLandscape ? 'row' : 'column', alignItems: isTabletLandscape ? 'flex-start' : 'stretch', gap: space[4] }}>
            {visibles.clientes ? <SeccionClientes termino={termino} columna={isTabletLandscape} /> : null}
            {visibles.ventas ? <SeccionVentas termino={termino} columna={isTabletLandscape} /> : null}
            {visibles.cuentas ? <SeccionCuentas termino={termino} columna={isTabletLandscape} /> : null}
          </View>
        )}
        <Text style={{ ...typeScale.secundario, color: c.textSecondary, textAlign: 'center' }}>
          La búsqueda solo muestra lo que tu usuario puede ver.
        </Text>
      </ScrollView>
    </View>
  )
}

function Seccion({ titulo, cantidad, testID, columna, estado, pie, children }: {
  titulo: string
  cantidad?: number
  testID: string
  columna: boolean
  estado: Estado
  /** Texto bajo la tarjeta (p. ej. "Se muestran 5 de N ventas…"). */
  pie?: React.ReactNode
  children?: React.ReactNode
}) {
  const c = useColors()
  return (
    <View testID={testID} style={{ gap: space[2], ...(columna ? { flex: 1, minWidth: 0 } : null) }}>
      <Text accessibilityRole="header" style={{ ...typeScale.etiqueta, letterSpacing: 0.72, color: c.textSecondary }}>
        {cantidad !== undefined ? `${titulo.toUpperCase()} · ${cantidad}` : titulo.toUpperCase()}
      </Text>
      {estado === 'cargando' ? <Esqueletos bloques={[{ alto: 64 }]} /> : null}
      {estado === 'error' ? <Notice tone="peligro">{`No se pudo buscar en ${titulo.toLowerCase()}.`}</Notice> : null}
      {estado === 'vacio' ? <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>Sin resultados.</Text> : null}
      {estado === 'ok' ? (
        // Receta FWD: una fila suelta de 22 de radio por resultado, sin bordes; las separa el espacio.
        <View testID="tarjeta-seccion" style={{ gap: space[2] }}>
          {React.Children.toArray(children).map((fila, i) => (
            <View key={React.isValidElement(fila) && fila.key !== null ? fila.key : i} style={{ backgroundColor: c.surface, borderRadius: radii.fila, overflow: 'hidden' }}>{fila}</View>
          ))}
        </View>
      ) : null}
      {estado === 'ok' ? pie : null}
    </View>
  )
}

function Fila({ etiqueta, avatar, titulo, detalle, detalleEnRojo = false, derecha, chip, vender, testID, onPress }: {
  etiqueta: string
  avatar?: string
  titulo: string
  detalle?: string | null
  /** El detalle es una deuda vencida: va destacado (peso 800) y con su texto "Vencido"; el color nunca va solo. */
  detalleEnRojo?: boolean
  derecha?: string
  chip?: React.ComponentProps<typeof StatusChip> | null
  /** "Vender" dentro de la fila, a la derecha (solo con permiso de crear ventas). */
  vender?: { label: string; onPress: () => void }
  testID?: string
  onPress: () => void
}) {
  const c = useColors()
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], paddingRight: vender ? space[2] : 0 }}>
      <PressableFx
        accessibilityRole="button"
        accessibilityLabel={etiqueta}
        onPress={onPress}
        android_ripple={{ color: c.surface2 }}
        style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 68, paddingVertical: space[3], paddingLeft: space[4], paddingRight: vender ? space[1] : space[4] }}
      >
        {avatar ? (
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ width: 44, height: 44, borderRadius: radii.pastilla, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{avatar}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text numberOfLines={2} style={{ ...typeScale.cuerpoDestacado, color: c.text }}>{titulo}</Text>
          {detalle ? <Text numberOfLines={1} style={detalleEnRojo ? { ...typeScale.secundario, fontFamily: typeScale.cuerpoDestacado.fontFamily, fontWeight: '800', color: c.text } : { ...typeScale.secundario, color: c.textSecondary }}>{detalle}</Text> : null}
        </View>
        {derecha || chip ? (
          <View style={{ alignItems: 'flex-end', gap: space[1] }}>
            {derecha ? <Text style={[typeScale.cuerpoDestacado, importe, { color: c.text }]}>{derecha}</Text> : null}
            {chip ? <StatusChip {...chip} /> : null}
          </View>
        ) : null}
      </PressableFx>
      {vender ? <Button label="Vender" accessibilityLabel={vender.label} onPress={vender.onPress} /> : null}
    </View>
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
        // Lienzo ResBuscar y propuesta Cuenta, frame 15: "Vender" dentro de la fila (solo con la venta nueva y permiso para crear ventas).
        return (
          <Fila
            key={cl.id}
            testID={`fila-cliente-${cl.id}`}
            etiqueta={[direccion, nombre].filter(Boolean).join(', ')}
            avatar={iniciales(direccion)}
            titulo={direccion}
            detalle={nombre}
            vender={venderA ? { label: `Vender a ${direccion}`, onPress: () => router.push(venderA(cl.id) as never) } : undefined}
            onPress={() => router.push({ pathname: '/(tabs)/socios/[id]', params: { id: cl.id } })}
          />
        )
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
            detalleEnRojo={cl.tieneDeudaVencida === true}
            derecha={saldo}
            onPress={() => router.push({ pathname: '/(tabs)/cuentas/[id]', params: { id: cl.id } })}
          />
        )
      })}
    </Seccion>
  )
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
    <Seccion
      titulo="Ventas"
      testID="buscar-ventas"
      columna={columna}
      cantidad={espera ? undefined : total}
      estado={estadoDe(espera, q.error, ventas.length)}
      pie={total !== undefined && total > ventas.length ? (
        <Text style={{ ...typeScale.secundario, color: c.textSecondary }}>
          {`Se muestran ${ventas.length} de ${total} ventas. Afiná la búsqueda para ver el resto.`}
        </Text>
      ) : null}
    >
      {ventas.map((v) => {
        // La dirección es el título del cliente en cualquier otra lista; acá el título es el pedido, así que va el nombre.
        const { titulo: cliente, nombre } = clienteDeVenta(v)
        const quien = nombre ?? cliente
        const tipo = v.tipoOperacion === 1 ? 'Presupuesto' : 'Pedido'
        const numero = v.codigoPedido ?? v.id.slice(0, 8).toUpperCase()
        const monto = formatImporte(v.totalAmount)
        const chip = chipForEstado('venta', v.estado)
        return (
          <Fila
            key={v.id}
            etiqueta={[`${tipo} ${numero}`, quien, fechaCorta(v.fecha), monto, chip?.label].filter(Boolean).join(', ')}
            titulo={`${tipo} ${numero}`}
            detalle={`${quien} · ${fechaCorta(v.fecha)}`}
            derecha={monto}
            chip={chip}
            onPress={() => router.push(`/(tabs)/ventas/${v.id}` as never)}
          />
        )
      })}
    </Seccion>
  )
}
