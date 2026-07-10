import { useState, useMemo, useEffect, useCallback } from 'react'
import { Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { createCompraSchema } from '@/libs/validations'

import {
  useCreateCompra,
  useUpdateCompra,
  useConfirmarCompra,
  useRecibirCompra,
  useCompra,
  comprasKeys,
} from '../api/queries'
import { useProductos, useProveedores, useDepositos } from '@/libs/api-client'
import type { SocioComercial, Deposito, Producto, CompraDetalle } from '@/libs/api-client'

export interface DetalleItem {
  productoId: string
  nombre: string
  imageUrl?: string
  costoUnitario: number
  cantidad: number
}

export type EstadoOrden = 'Presupuesto' | 'Confirmado' | 'Recibida'

export function useCompraForm(editId?: string) {
  const router = useRouter()
  const queryClient = useQueryClient()

  // Queries
  const { data: compraEdit, isLoading: loadingEdit } = useCompra(editId ?? '')
  const { data: productosResponse, isLoading: loadingProds } = useProductos({ pageSize: 150 })
  const { data: proveedoresResponse } = useProveedores()
  const { data: depositosResponse } = useDepositos()

  const productos = productosResponse?.items ?? []
  const proveedores = proveedoresResponse?.items ?? []
  const depositos = depositosResponse ?? []

  // Mutations
  const { mutateAsync: createCompra, isPending: isCreating } = useCreateCompra()
  const { mutateAsync: updateCompra, isPending: isUpdating } = useUpdateCompra()
  const { mutateAsync: confirmarCompra, isPending: isConfirming } = useConfirmarCompra()
  const { mutateAsync: recibirCompra, isPending: isReceiving } = useRecibirCompra()

  const isPending = isCreating || isUpdating || isConfirming || isReceiving

  // Form state
  const [proveedorSelected, setProveedorSelected] = useState<SocioComercial | null>(null)
  const [depositoSelected, setDepositoSelected] = useState<Deposito | null>(null)
  const [detalles, setDetalles] = useState<DetalleItem[]>([])
  const [gastosStr, setGastosStr] = useState('')
  const [descuentoStr, setDescuentoStr] = useState('')
  const [estadoOrden, setEstadoOrden] = useState<EstadoOrden>('Presupuesto')
  const [successModal, setSuccessModal] = useState(false)

  // Modal state
  const [showProvModal, setShowProvModal] = useState(false)
  const [showDepModal, setShowDepModal] = useState(false)
  const [showProductModal, setShowProductModal] = useState(false)
  const [provSearch, setProvSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')

  // ── State Lifecycle Management ───────────────────────────────────────────
  const [focusKey, setFocusKey] = useState(0)

  const resetFormState = useCallback(() => {
    setProveedorSelected(null)
    setDepositoSelected(null)
    setDetalles([])
    setGastosStr('')
    setDescuentoStr('')
    setEstadoOrden('Presupuesto')
    setSuccessModal(false)
    setShowProvModal(false)
    setShowDepModal(false)
    setShowProductModal(false)
    setProvSearch('')
    setProductSearch('')
  }, [])

  const bumpFocusKey = useCallback(() => setFocusKey(k => k + 1), [])

  // Pre-fill Edit Mode
  useEffect(() => {
    if (editId && compraEdit) {
      setProveedorSelected(proveedores.find(p => p.id === compraEdit.proveedorId) || null)
      setDepositoSelected(depositos.find((d: Deposito) => d.id === compraEdit.depositoId) || null)
      setDetalles(compraEdit.detalles?.map((d: CompraDetalle) => ({
        productoId: d.productoId ?? '',
        nombre: d.nombreProducto ?? '—',
        costoUnitario: d.costoUnitarioBaseAmount ?? 0,
        cantidad: d.cantidad ?? 0,
      })) ?? [])
      setGastosStr(String(compraEdit.gastosOperativos || ''))
      setDescuentoStr(String((compraEdit as typeof compraEdit & { descuentoPorcentaje?: number }).descuentoPorcentaje || ''))
      
      const s = String(compraEdit.estado)
      if (s === 'Presupuesto' || s === '1' || s === 'NotaPedido') setEstadoOrden('Presupuesto')
      else if (s === 'Confirmado' || s === '2') setEstadoOrden('Confirmado')
      else if (s === 'Recibida' || s === '3' || s === 'Entregado') setEstadoOrden('Recibida')
    }
  }, [compraEdit, editId, proveedores, depositos, focusKey])

  // Computed
  const gastos = useMemo(() => Math.max(parseFloat(gastosStr) || 0, 0), [gastosStr])
  const descPct = useMemo(() => Math.max(parseFloat(descuentoStr) || 0, 0), [descuentoStr])
  const bruto = useMemo(() => detalles.reduce((acc, d) => acc + d.cantidad * d.costoUnitario, 0), [detalles])
  const subtotal = useMemo(() => bruto * (1 - descPct / 100), [bruto, descPct])
  const total = useMemo(() => subtotal + gastos, [subtotal, gastos])

  const proveedoresFiltrados = useMemo(
    () => proveedores.filter(p => (p.razonSocial ?? '').toLowerCase().includes(provSearch.toLowerCase())),
    [proveedores, provSearch]
  )
  const productosFiltrados = useMemo(
    () => productos.filter(p => (p.nombre ?? '').toLowerCase().includes(productSearch.toLowerCase())),
    [productos, productSearch]
  )

  // Handlers
  const setProductoCantidad = useCallback((prod: Producto & { precioCompraBase?: number }, qty: number) => {
    setDetalles(prev => {
      if (qty <= 0) return prev.filter(d => d.productoId !== prod.id)
      const idx = prev.findIndex(d => d.productoId === prod.id)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = { ...copy[idx], cantidad: qty }
        return copy
      }
      return [...prev, {
        productoId: prod.id ?? '',
        nombre: prod.nombre ?? '',
        imageUrl: prod.imageUrl ?? undefined,
        costoUnitario: prod.precioCompraBase ?? ((prod.precioVenta ?? 0) * 0.7),
        cantidad: qty,
      }]
    })
  }, [])

  const updateCantidad = useCallback((id: string, delta: number) => {
    setDetalles(prev => prev.map(d =>
      d.productoId === id ? { ...d, cantidad: Math.max(1, d.cantidad + delta) } : d
    ))
  }, [])

  const updateCosto = useCallback((id: string, value: string) => {
    const num = parseFloat(value)
    if (!isNaN(num) && num >= 0)
      setDetalles(prev => prev.map(d => d.productoId === id ? { ...d, costoUnitario: num } : d))
  }, [])

  const removeDetalle = useCallback((id: string) => {
    setDetalles(prev => prev.filter(d => d.productoId !== id))
  }, [])

  const onSubmit = useCallback(async () => {
    const payload = {
      id: editId,
      proveedorId: proveedorSelected?.id ?? '',
      depositoId: depositoSelected?.id ?? '',
      gastosOperativos: gastos,
      descuentoPorcentaje: descPct,
      detalles: detalles.map(d => ({
        productoId: d.productoId,
        cantidad: d.cantidad,
        costoUnitario: d.costoUnitario,
        descuentoPorcentaje: 0,
        monedaCosto: 'ARS',
      })),
      estado: estadoOrden === 'Presupuesto' ? 1 : estadoOrden === 'Confirmado' ? 2 : 3,
    }

    // ── Zod Validation ──
    const validation = createCompraSchema.safeParse(payload)
    if (!validation.success) {
      const firstError = validation.error.errors[0]?.message ?? 'Datos inválidos'
      return Alert.alert('⚠️ Validación', firstError)
    }

    try {
      let newId = editId
      if (editId) {
        await updateCompra({ id: editId, data: payload })
        if (estadoOrden === 'Confirmado') await confirmarCompra(editId).catch(() => {})
        if (estadoOrden === 'Recibida') {
          await confirmarCompra(editId).catch(() => {})
          await recibirCompra(editId).catch(() => {})
        }
      } else {
        const resultId = await createCompra(payload)
        newId = typeof resultId === 'string' ? resultId : resultId.id
        
        if (estadoOrden === 'Confirmado' || estadoOrden === 'Recibida') {
          await confirmarCompra(newId!)
        }
        if (estadoOrden === 'Recibida') {
           await recibirCompra(newId!)
        }
      }
      setSuccessModal(true)
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error)?.message ?? 'No se pudo procesar la solicitud.')
    }
  }, [editId, proveedorSelected, depositoSelected, gastos, descPct, detalles, estadoOrden, updateCompra, confirmarCompra, recibirCompra, createCompra])

  const canSubmit = !!proveedorSelected && !!depositoSelected && detalles.length > 0 && !isPending

  return {
    loadingEdit, loadingProds, isPending,
    proveedorSelected, setProveedorSelected,
    depositoSelected, setDepositoSelected,
    detalles, setDetalles,
    gastosStr, setGastosStr,
    descuentoStr, setDescuentoStr,
    estadoOrden, setEstadoOrden,
    successModal, setSuccessModal,
    showProvModal, setShowProvModal,
    showDepModal, setShowDepModal,
    showProductModal, setShowProductModal,
    provSearch, setProvSearch,
    productSearch, setProductSearch,
    subtotal, total,
    proveedoresFiltrados, productosFiltrados, depositos,
    setProductoCantidad, updateCantidad, updateCosto, removeDetalle,
    onSubmit, canSubmit,
    // State lifecycle management
    resetFormState, bumpFocusKey, queryClient, comprasKeys,
  }
}
