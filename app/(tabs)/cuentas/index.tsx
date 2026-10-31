import React, { useState } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ArrowLeftRight } from 'lucide-react-native'
import { space, typeScale, useColors } from '@/libs/theme'
import { useResponsive } from '@/libs/useResponsive'
import { FiltroChip } from '@/core/ui/fw/FiltroChip'
import { Button, Notice, Segmented, TopBar, TwoPane, useMenuLeading } from '@/core/ui/fw'
import { EstadoDePantalla, textoSinConexion } from '@/core/ui/fw/EstadoDePantalla'
import { esFallaDeRed } from '@/core/api/errores'
import { MOTIVO_SIN_PERMISO_DE_TRANSFERENCIA, MotivoDeshabilitado } from '@/core/ui/fw/MotivoDeshabilitado'
import { usePermissions } from '@/core/auth/RequirePermission'
import { useCartera } from '@/features/clientes/hooks/useCartera'
import { ClienteCard } from '@/features/clientes/components/ClienteCard'
import { BuscadorCartera } from '@/features/clientes/components/BuscadorCartera'
import { textoMostrando } from '@/features/clientes/lib/cliente'
import { CuentaCorrienteCliente } from '@/features/cuentas/components/CuentaCorrienteCliente'
import { RegistrarCobro } from '@/features/cuentas/components/RegistrarCobro'
import { DeudasAProveedores } from '@/features/cuentas/components/DeudasAProveedores'
import { useDeudasResumen } from '@/features/cuentas/api/queries'
import { ResumenDeCuentas } from '@/features/cuentas/components/ResumenDeCuentas'
import { ConAccesosRapidos } from '@/src/components/layout/AccesosRapidos'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'

type LadoDeCuentas = 'medeben' | 'debo'

/** Sin MOD_PAGOS:Read el servidor no deja ver las deudas con proveedores (`GET /deudas/proveedores`). */
export const AVISO_DEBO_SIN_PERMISO = 'Tu usuario no puede ver lo que se les debe a los proveedores.'

/**
 * Cuentas (láminas cuentas-lista CuentaCorriente y TabCuentaCorriente): la cartera por dirección de
 * entrega; tocar un cliente abre su cuenta (en tablet horizontal, en el panel de la derecha).
 */
function CuentasCorrientesScreen() {
  const c = useColors()
  const router = useRouter()
  const menu = useMenuLeading()
  const { isTabletLandscape } = useResponsive()
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState<string | null>(null)
  // TM9: en tablet horizontal el cobro se abre en el mismo panel, sin salir de la lista.
  const [cobrando, setCobrando] = useState(false)
  const [soloVencidas, setSoloVencidas] = useState(false)
  const [lado, setLado] = useState<LadoDeCuentas>('medeben')
  const { canCreate, canRead } = usePermissions()
  // Misma regla que Tesorería: la pantalla pide los tipos (MOD_PAGOS:Read) y las cuentas propias (MOD_CC:Read).
  const puedeVerDeudas = canRead('MOD_PAGOS')
  const resumenDeudas = useDeudasResumen(puedeVerDeudas)
  const puedeTransferir = canCreate('MOD_PAGOS') && canRead('MOD_PAGOS') && canRead('MOD_CC')
  const { clientes, totalCount, saldoTotal, isLoading, isRefetching, error, dataUpdatedAt, refetch, cargarMas } = useCartera(
    busqueda,
    soloVencidas ? { conDeudaVencida: true } : undefined,
  )
  const sinRed = esFallaDeRed(error)
  const hayDatos = clientes.length > 0

  const abrir = (id: string) => {
    if (isTabletLandscape) { setAbierto(id); setCobrando(false) }
    else router.push({ pathname: '/(tabs)/cuentas/[id]', params: { id } })
  }

  const lista = (
    <View style={{ flex: 1 }}>
      {totalCount !== undefined ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ ...typeScale.secundario, color: c.text, paddingHorizontal: space[4], paddingTop: space[3] }}
        >
          {textoMostrando(clientes.length, totalCount, saldoTotal)}
        </Text>
      ) : null}
      {error && !(sinRed && !hayDatos) ? (
        <View style={{ padding: space[4] }}>
          {sinRed ? (
            <Notice tone="advertencia">{textoSinConexion(dataUpdatedAt || undefined)}</Notice>
          ) : (
            <Notice tone="peligro">{mensajeDelServidor(error, 'No se pudo cargar la cartera.')}</Notice>
          )}
        </View>
      ) : null}
      <FlatList
        data={clientes}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ClienteCard cliente={item} seleccionado={isTabletLandscape && item.id === abierto} onPress={() => abrir(item.id)} />
        )}
        onEndReached={cargarMas}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.brandInk} />}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color={c.brandInk} style={{ marginTop: space[8] }} />
          ) : error ? (
            sinRed ? (
              <EstadoDePantalla tipo="sinConexion" titulo="No pudimos cargar los clientes" accion={{ label: 'Reintentar', onPress: () => void refetch() }} />
            ) : null
          ) : (
            <EstadoDePantalla
              tipo="vacio"
              titulo={busqueda.trim() ? 'Ningún cliente coincide con la búsqueda.' : 'Todavía no hay clientes en tu cartera.'}
            />
          )
        }
      />
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar
        title="Cuentas"
        leading={menu}
        actions={[{ icon: ArrowLeftRight, accessibilityLabel: 'Transferir', disabled: !puedeTransferir, onPress: () => router.push('/(tabs)/tesoreria/transferencia') }]}
      />
      {!puedeTransferir ? (
        <View style={{ paddingHorizontal: space[4], paddingTop: space[2] }}>
          <MotivoDeshabilitado>{MOTIVO_SIN_PERMISO_DE_TRANSFERENCIA}</MotivoDeshabilitado>
        </View>
      ) : null}
      <View style={{ paddingHorizontal: space[4], paddingTop: space[3] }}>
        <Segmented
          options={[
            { value: 'medeben', label: totalCount !== undefined ? `Me deben · ${totalCount}` : 'Me deben' },
            { value: 'debo', label: 'Debo' },
          ]}
          value={lado}
          onChange={setLado}
          accessibilityLabel="Lado de las cuentas"
        />
      </View>
      {lado === 'debo' ? (
        puedeVerDeudas ? (
          <DeudasAProveedores />
        ) : (
          <View style={{ padding: space[4] }}>
            <Notice tone="info">{AVISO_DEBO_SIN_PERMISO}</Notice>
          </View>
        )
      ) : (
        <>
          <ResumenDeCuentas saldoTotal={saldoTotal} clientesConDeuda={resumenDeudas.data?.clientesConDeuda} />
          <BuscadorCartera sobre="pantalla" valor={busqueda} onCambio={setBusqueda} />
          <View style={{ flexDirection: 'row', paddingHorizontal: space[4], paddingBottom: space[1] }}>
            <FiltroChip label="Con deuda vencida" activo={soloVencidas} onPress={() => setSoloVencidas(v => !v)} />
          </View>
      <TwoPane
        list={lista}
        detail={
          isTabletLandscape && abierto ? (
            cobrando ? (
              <View style={{ flex: 1 }}>
                <View style={{ padding: space[4], paddingBottom: 0, alignItems: 'flex-start' }}>
                  <Button label="Volver a la cuenta" variant="secundario" onPress={() => setCobrando(false)} />
                </View>
                <RegistrarCobro key={abierto} socioId={abierto} onVolver={() => setCobrando(false)} />
              </View>
            ) : (
              <CuentaCorrienteCliente key={abierto} socioId={abierto} onRegistrarCobro={() => setCobrando(true)} />
            )
          ) : null
        }
        emptyDetail={
          <Text style={{ ...typeScale.cuerpo, color: c.textSecondary, textAlign: 'center', marginTop: space[12] }}>
            Elegí un cliente para ver su cuenta.
          </Text>
        }
      />
        </>
      )}
    </View>
  )
}

export default function CuentasCorrientesScreenConBarra() {
  return (
    <ConAccesosRapidos activa="cobros">
      <CuentasCorrientesScreen />
    </ConAccesosRapidos>
  )
}
