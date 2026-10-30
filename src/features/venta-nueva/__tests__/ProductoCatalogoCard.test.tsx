import React from 'react'
import { render, screen, userEvent } from '@testing-library/react-native'
import { formatImporte } from '@/core/ui/fw'
import { ProductoCatalogoCard } from '../components/ProductoCatalogoCard'
import { cajaDe6, producto } from '../__testing__/producto'

const noop = () => {}
const pintar = (cantidad: number, extra: Record<string, unknown> = {}) =>
  render(<ProductoCatalogoCard producto={producto(extra)} cantidad={cantidad} verCantidades={false} onAbrirOferta={noop} />)

describe('ProductoCatalogoCard (CalleCatalogo)', () => {
  it('lo que ya está en el carrito se marca con el fondo y el borde de la marca; lo que no, queda liso', () => {
    const r = pintar(6)
    expect(screen.getByTestId('producto-p1')).toHaveStyle({ backgroundColor: '#E0F8F3', borderColor: '#00C29E' })
    r.unmount()
    pintar(0)
    expect(screen.getByTestId('producto-p1')).toHaveStyle({ backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' })
  })

  it('con foto la muestra; sin foto deja el ícono de producto', () => {
    const r = pintar(0, { imageUrl: 'https://img.test/a.png' })
    expect(screen.UNSAFE_getByType(require('react-native').Image).props.source).toEqual({ uri: 'https://img.test/a.png' })
    r.unmount()
    pintar(0, { imageUrl: null })
    expect(screen.UNSAFE_queryByType(require('react-native').Image)).toBeNull()
  })

  describe('tarjeta de la propuesta (T3)', () => {
    const tarjeta = (p = producto(), props: Record<string, unknown> = {}) =>
      render(<ProductoCatalogoCard producto={p} cantidad={0} verCantidades onAbrirOferta={noop} {...props} />)

    it('la presentación: "Bulto x N u" si se vende por bulto, "Unidad" si no; y la marca arriba', () => {
      tarjeta(cajaDe6({ marca: 'Bettanin' }))
      expect(screen.getByText('Bulto x 6 u')).toBeTruthy()
      expect(screen.getByText('Bettanin')).toBeTruthy()
      screen.unmount()
      tarjeta(producto())
      expect(screen.getByText('Unidad')).toBeTruthy()
    })

    it('el stock sale de `disponible` (no de `real`), en bultos si se vende por bulto, y dice "ahora" solo en vivo', () => {
      tarjeta(cajaDe6({ disponible: 30, real: 999 }), { enVivo: true })
      expect(screen.getByText('Quedan 5 bultos · ahora')).toBeTruthy()
      screen.unmount()
      tarjeta(producto({ disponible: 1 }), { enVivo: false })
      expect(screen.getByText('Quedan 1 u')).toBeTruthy()
    })

    it('quien no ve cantidades (disponible = 0 del servidor) ve "Hay stock" por puedeVenderse, sin números', () => {
      tarjeta(producto({ disponible: 0, puedeVenderse: true }), { verCantidades: false })
      expect(screen.getByText('Hay stock')).toBeTruthy()
      expect(screen.queryByText(/Quedan/)).toBeNull()
    })

    it('sin stock se rotula "Sin stock" pero se puede agregar igual (queda por autorizar)', async () => {
      const onAbrirOferta = jest.fn()
      tarjeta(producto({ disponible: 0, puedeVenderse: false }), { onAbrirOferta })
      await userEvent.press(screen.getByRole('button', { name: 'Añadir Pala c/Cabo Fija LP' }))
      expect(screen.getByText('Sin stock')).toBeTruthy()
      expect(onAbrirOferta).toHaveBeenCalledTimes(1)
    })

    it('precio por bulto y por unidad, y chip "Oferta" cuando el servidor manda precio con oferta', () => {
      tarjeta(cajaDe6({ precioVenta: 100, precioConOferta: 90 }))
      expect(screen.getByText('Oferta')).toBeTruthy()
      expect(screen.getByText('$ 540,00')).toBeTruthy()
      expect(screen.getByText('$ 90,00 por unidad')).toBeTruthy()
    })

    it('Agregar y el chip de edición abren la pantalla de cantidad y oferta', async () => {
      const onAbrirOferta = jest.fn()
      const p = cajaDe6()
      const r = tarjeta(p, { onAbrirOferta })
      await userEvent.press(screen.getByRole('button', { name: `Añadir ${p.nombre}` }))
      expect(onAbrirOferta).toHaveBeenCalledWith(p)
      r.unmount()
      render(<ProductoCatalogoCard producto={p} cantidad={12} verCantidades onAbrirOferta={onAbrirOferta} />)
      await userEvent.press(screen.getByText('2 bultos ✎'))
      expect(onAbrirOferta).toHaveBeenCalledTimes(2)
    })
  })

  describe('línea del carrito en la tarjeta (maqueta ventas-nueva-2-productos)', () => {
    const conLinea = (cantidad: number, descuentoPct: number) => {
      const p = producto({ precioVenta: 2340 })
      return render(<ProductoCatalogoCard producto={p} cantidad={cantidad} linea={{ productoId: p.id, producto: p, cantidad, descuentoPct }} verCantidades onAbrirOferta={noop} />)
    }

    it('dice cuántas unidades lleva y cuánto suma, con el descuento si lo hay', () => {
      conLinea(36, 12)
      expect(screen.getByTestId('linea-resumen-p1').props.children).toBe(`36 unidades · ${formatImporte(36 * 2340 * 0.88)}`)
      expect(screen.getByText('Descuento 12 %')).toBeTruthy()
    })

    it('sin descuento no hay chip y sin línea no hay resumen', () => {
      const r = conLinea(1, 0)
      expect(screen.getByTestId('linea-resumen-p1').props.children).toBe(`1 unidad · ${formatImporte(2340)}`)
      expect(screen.queryByText(/Descuento/)).toBeNull()
      r.unmount()
      pintar(0)
      expect(screen.queryByTestId('linea-resumen-p1')).toBeNull()
    })
  })

  describe('se vende por y cantidad en la tarjeta (ventas-nueva-2-productos)', () => {
    const conLineaDe = (p: ReturnType<typeof producto>, cantidad: number, onCambiarCantidad = jest.fn()) => {
      render(<ProductoCatalogoCard producto={p} cantidad={cantidad} verCantidades onAbrirOferta={noop}
        linea={{ productoId: p.id, producto: p, cantidad, descuentoPct: 0 }} onCambiarCantidad={onCambiarCantidad} />)
      return onCambiarCantidad
    }
    const pack = () => producto({ id: 'pk', ventaMinimaUnidades: 6, bultoContenido: 12, fraccionMinimaVenta: 'Unidad' })

    it('sin la línea en el carrito no hay selector ni cantidad', () => {
      render(<ProductoCatalogoCard producto={pack()} cantidad={0} verCantidades onAbrirOferta={noop} onCambiarCantidad={jest.fn()} />)
      expect(screen.queryByRole('button', { name: /^Bulto/ })).toBeNull()
      expect(screen.queryByRole('button', { name: /^Sumar / })).toBeNull()
    })

    it('un producto que se vende solo por unidad no tiene selector, pero sí la cantidad', async () => {
      const onCambiar = conLineaDe(producto(), 3)
      expect(screen.queryByRole('radiogroup', { name: 'Se vende por' })).toBeNull()
      await userEvent.press(screen.getByRole('button', { name: /^Sumar / }))
      expect(onCambiar).toHaveBeenCalledWith(4)
    })

    it('Pack y Bulto: marca el modo de la línea, "+" suma un pack y cambiar a Bulto redondea al próximo bulto', async () => {
      const onCambiar = conLineaDe(pack(), 6)
      expect(screen.getByRole('button', { name: 'Pack · 6' })).toHaveAccessibilityState({ selected: true })
      expect(screen.getByRole('button', { name: 'Bulto · 12' })).toHaveAccessibilityState({ selected: false })
      await userEvent.press(screen.getByRole('button', { name: /^Sumar / }))
      expect(onCambiar).toHaveBeenLastCalledWith(12)
      await userEvent.press(screen.getByRole('button', { name: 'Bulto · 12' }))
      expect(onCambiar).toHaveBeenLastCalledWith(12)
    })

    it('en Bulto el "+" suma 12 unidades y "−" resta un bulto sin bajar del mínimo', async () => {
      const onCambiar = conLineaDe(pack(), 24)
      expect(screen.getByRole('button', { name: 'Bulto · 12' })).toHaveAccessibilityState({ selected: true })
      await userEvent.press(screen.getByRole('button', { name: /^Sumar / }))
      expect(onCambiar).toHaveBeenLastCalledWith(36)
      await userEvent.press(screen.getByRole('button', { name: /^Restar / }))
      expect(onCambiar).toHaveBeenLastCalledWith(12)
    })

    it('"−" está apagado en el mínimo de venta', () => {
      conLineaDe(pack(), 6)
      expect(screen.getByRole('button', { name: /^Restar / })).toBeDisabled()
    })
  })
})
