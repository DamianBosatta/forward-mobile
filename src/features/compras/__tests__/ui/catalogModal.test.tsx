import React from 'react'
import { render, screen, userEvent, fireEvent } from '@testing-library/react-native'
import { CatalogModal } from '../../components/CatalogModal'

const PRODUCTOS = [
  { id: 'p1', nombre: 'Balde Nuvia 10L', codigoPropio: 'A000001', imageUrl: null },
  { id: 'p2', nombre: 'Escoba Premium', codigoPropio: 'A000002', imageUrl: null },
]

function abrir(extra: Partial<React.ComponentProps<typeof CatalogModal>> = {}) {
  const props = {
    visible: true, onClose: jest.fn(), productSearch: '', setProductSearch: jest.fn(), loadingProds: false,
    productosFiltrados: PRODUCTOS, hayMasProductos: false, cargarMasProductos: jest.fn(),
    detalles: [{ productoId: 'p2', cantidad: 3 }], setProductoCantidad: jest.fn(), ...extra,
  }
  render(<CatalogModal {...props} />)
  return props
}

describe('selector de productos de la compra', () => {
  it('muestra el título nuevo, el buscador y una fila por producto', () => {
    abrir()
    expect(screen.getByText('Agregar productos')).toBeTruthy()
    expect(screen.getByLabelText('Buscar producto')).toBeTruthy()
    expect(screen.queryByText(/Catálogo Maestro/i)).toBeNull()
    expect(screen.getByText('Balde Nuvia 10L')).toBeTruthy()
    expect(screen.getByText('A000002')).toBeTruthy()
  })

  it('escribir en el buscador llama a setProductSearch con el texto', () => {
    const p = abrir()
    fireEvent.changeText(screen.getByLabelText('Buscar producto'), 'balde')
    expect(p.setProductSearch).toHaveBeenCalledWith('balde')
  })

  it('"+ Añadir" agrega el producto con cantidad 1 y +/− cambian la cantidad ya cargada', async () => {
    const p = abrir()
    await userEvent.press(screen.getByRole('button', { name: 'Añadir Balde Nuvia 10L' }))
    expect(p.setProductoCantidad).toHaveBeenCalledWith(PRODUCTOS[0], 1)
    await userEvent.press(screen.getByRole('button', { name: 'Sumar Escoba Premium' }))
    expect(p.setProductoCantidad).toHaveBeenCalledWith(PRODUCTOS[1], 4)
    await userEvent.press(screen.getByRole('button', { name: 'Restar Escoba Premium' }))
    expect(p.setProductoCantidad).toHaveBeenCalledWith(PRODUCTOS[1], 2)
  })

  it('la cantidad se puede tipear y vaciarla quita el producto (0)', () => {
    const p = abrir()
    const campo = screen.getByLabelText('Cantidad de Escoba Premium')
    fireEvent.changeText(campo, '12')
    expect(p.setProductoCantidad).toHaveBeenCalledWith(PRODUCTOS[1], 12)
    fireEvent.changeText(campo, '')
    expect(p.setProductoCantidad).toHaveBeenCalledWith(PRODUCTOS[1], 0)
  })

  it('Listo cierra y sin resultados avisa', async () => {
    const p = abrir({ productosFiltrados: [], productSearch: 'zzz' })
    expect(screen.getByText('No hay productos con esa búsqueda')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Listo' }))
    expect(p.onClose).toHaveBeenCalled()
  })
})
