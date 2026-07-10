import { useState, useCallback, useMemo } from 'react'
import {
  useCuentasPropias,
  useCuentasClientes,
  useCuentasProveedores,
  useLiquidez,
  type CuentaCorrienteResumen,
} from '../api/queries'

export type TabType = 'propias' | 'clientes' | 'proveedores'

export function useCuentasResumen() {
  const [activeTab, setActiveTab] = useState<TabType>('propias')
  const [showArchived, setShowArchived] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const { data: propias = [], isLoading: loadPropias, refetch: refetchPropias } = useCuentasPropias(!showArchived)
  const { data: clientes = [], isLoading: loadClientes, refetch: refetchClientes } = useCuentasClientes(!showArchived)
  const { data: proveedores = [], isLoading: loadProveedores, refetch: refetchProveedores } = useCuentasProveedores(!showArchived)
  const { data: liquidezResp, isLoading: loadLiquidez, refetch: refetchLiquidez } = useLiquidez()

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    if (activeTab === 'propias') await Promise.all([refetchPropias(), refetchLiquidez()])
    if (activeTab === 'clientes') await refetchClientes()
    if (activeTab === 'proveedores') await refetchProveedores()
    setRefreshing(false)
  }, [activeTab, refetchPropias, refetchLiquidez, refetchClientes, refetchProveedores])

  const isLoading = (activeTab === 'propias' && loadPropias) ||
                    (activeTab === 'clientes' && loadClientes) ||
                    (activeTab === 'proveedores' && loadProveedores) ||
                    loadLiquidez

  const currentData = useMemo(() => {
    let data: CuentaCorrienteResumen[] = []
    if (activeTab === 'propias') data = propias
    if (activeTab === 'clientes') data = clientes
    if (activeTab === 'proveedores') data = proveedores

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      data = data.filter(c => 
        (c.nombre ?? '').toLowerCase().includes(q) ||
        c.razonSocial?.toLowerCase().includes(q)
      )
    }
    return data
  }, [activeTab, propias, clientes, proveedores, searchQuery])

  const totalACobrar = useMemo(
    () => clientes.reduce((s, c) => s + Math.max(c.saldoActual ?? 0, 0), 0),
    [clientes]
  )
  const totalAPagar = useMemo(
    () => proveedores.reduce((s, c) => s + Math.max(c.saldoActual ?? 0, 0), 0),
    [proveedores]
  )

  return {
    state: { activeTab, showArchived, searchQuery, refreshing, isLoading },
    data: {
      currentData,
      liquidez: liquidezResp,
      totalACobrar,
      totalAPagar,
      counts: {
        propias: propias.length,
        clientes: clientes.length,
        proveedores: proveedores.length
      }
    },
    actions: { setActiveTab, setShowArchived, setSearchQuery, onRefresh }
  }
}
