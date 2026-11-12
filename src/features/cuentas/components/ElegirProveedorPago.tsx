import React, { useState } from 'react'
import { ActivityIndicator, FlatList, Text, View } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import { space, typeScale, useColors } from '@/libs/theme'
import { Button, Field, Notice, PieFijo } from '@/core/ui/fw'
import { MOTIVO_SIN_PERMISO_DE_COBRO, MotivoDeshabilitado } from '@/core/ui/fw/MotivoDeshabilitado'
import { textoSinConexion } from '@/core/ui/fw/EstadoDePantalla'
import { esFallaDeRed } from '@/core/api/errores'
import { mensajeDelServidor } from '@/features/compras/lib/mensaje-error'
import { useProveedores } from '@/features/proveedores/hooks/useProveedores'
import { ProveedorCard } from '@/features/proveedores/components/ProveedorCard'

interface Props {
  seleccionadoId: string | null
  onElegir: (socioId: string) => void
  onContinuar: () => void
  puedePagar: boolean
}

/**
 * Paso 1 del pago a un proveedor (el lugar de `ElegirClienteCobro`): los proveedores activos buscados en el servidor
 * (nombre o CUIT), con la fila de la lista de Proveedores. Solo cuando se entra a pagar sin un proveedor elegido.
 */
export function ElegirProveedorPago({ seleccionadoId, onElegir, onContinuar, puedePagar }: Props) {
  const c = useColors()
  const [busqueda, setBusqueda] = useState('')
  const { proveedores, isLoading, error, refetch, cargarMas } = useProveedores(busqueda)
  const buscando = busqueda.trim().length > 0

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        style={{ flex: 1 }}
        data={proveedores}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="handled"
        onEndReached={cargarMas}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View style={{ gap: space[2], paddingHorizontal: space[4], paddingTop: space[3], paddingBottom: space[2] }}>
            <Field label="Buscar proveedor" value={busqueda} onChangeText={setBusqueda} placeholder="Nombre o CUIT" returnKeyType="search" />
            {error ? (
              <View style={{ gap: space[2] }}>
                <Notice tone={esFallaDeRed(error) ? 'advertencia' : 'peligro'}>
                  {esFallaDeRed(error) ? textoSinConexion() : mensajeDelServidor(error, 'No se pudieron cargar los proveedores.')}
                </Notice>
                <Button label="Reintentar" variant="secundario" onPress={() => { void refetch() }} />
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => (
          <ProveedorCard proveedor={item} seleccionado={item.id === seleccionadoId} primera={index === 0} ultima={index === proveedores.length - 1} onPress={() => onElegir(item.id)} />
        )}
        ListEmptyComponent={
          isLoading ? <ActivityIndicator color={c.brandInk} /> : error ? undefined : (
            <Text style={{ ...typeScale.secundario, color: c.textSecondary, paddingHorizontal: space[4] }}>
              {buscando ? 'Ningún proveedor coincide con la búsqueda.' : 'Todavía no hay proveedores.'}
            </Text>
          )
        }
      />
      <PieFijo>
        {!puedePagar ? <MotivoDeshabilitado>{MOTIVO_SIN_PERMISO_DE_COBRO}</MotivoDeshabilitado> : null}
        <Button label="Continuar a qué pagás" iconoFinal={ChevronRight} disabled={!seleccionadoId || !puedePagar} onPress={onContinuar} />
      </PieFijo>
    </View>
  )
}
