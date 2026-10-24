import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { LineasVenta } from '../components/LineasVenta'
import { producto } from '../__testing__/producto'
import type { LineaCarrito } from '../lib/carrito'

const lineas: LineaCarrito[] = [
  { productoId: 'p1', producto: producto({ id: 'p1', nombre: 'Producto X' }), cantidad: 5, descuentoPct: 0 },
  { productoId: 'p2', producto: producto({ id: 'p2', nombre: 'Producto Y' }), cantidad: 1, descuentoPct: 0 },
]

function pantalla(extra: Partial<React.ComponentProps<typeof LineasVenta>> = {}) {
  return render(
    <LineasVenta
      lineas={lineas} porAutorizar={[]} rechazos={[]} descuentoGeneral={0} onDescuentoGeneral={jest.fn()} onSumar={jest.fn()} onRestar={jest.fn()}
      tope={10} onAgregar={jest.fn()} onEditar={jest.fn()} onElegirFragancias={jest.fn()} nombrePadre={() => undefined} {...extra}
    />,
  )
}

describe('LineasVenta con stock en vivo (S2)', () => {
  it('muestra el aviso de la línea y la marca; la línea sin cambios no se marca', () => {
    pantalla({ avisosStock: { p1: 'Quedan 3 de Producto X (cargaste 5)' } })
    expect(screen.getByText('Quedan 3 de Producto X (cargaste 5)')).toBeTruthy()
    expect(screen.getByTestId('linea-stock-p1')).toBeTruthy()
    expect(screen.queryByTestId('linea-stock-p2')).toBeNull()
  })

  it('el indicador dice "Stock en vivo" con conexión y "Sin conexión" sin ella', () => {
    const a = pantalla({ enVivo: true })
    expect(screen.getByText('Stock en vivo')).toBeTruthy()
    a.unmount()
    pantalla({ enVivo: false })
    expect(screen.getByText('Sin conexión')).toBeTruthy()
  })

  it('lo de antes sigue igual: sin avisos ni indicador no muestra nada de stock en vivo', () => {
    pantalla()
    expect(screen.queryByText('Stock en vivo')).toBeNull()
    expect(screen.queryByText('Sin conexión')).toBeNull()
    expect(screen.queryByTestId('linea-stock-p1')).toBeNull()
    expect(screen.getByText('Producto X')).toBeTruthy()
    expect(screen.getByText('Agregar productos')).toBeTruthy()
  })
})
