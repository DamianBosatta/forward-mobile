import React from 'react'
import { render, screen, userEvent } from '@testing-library/react-native'
import { VentasSinSenalLista } from '../components/VentasSinSenalLista'
import type { EstadoEnCola, VentaEnCola } from '../lib/cola'

// 14:40 UTC = 11:40 en Argentina.
const venta = (clave: string, estado: EstadoEnCola, extra: Partial<VentaEnCola> = {}): VentaEnCola => ({
  clave,
  alta: {
    clienteId: 'c1', depositoId: 'd1', tipoOperacion: 2, metodoEntrega: 1, entregaInmediata: false, descuentoGeneral: 0,
    items: [], claveIdempotencia: clave,
  },
  encoladaEn: Date.UTC(2026, 9, 22, 14, 40),
  cliente: { direccion: 'Alem 3669', nombreFantasia: 'Almacén Rosa' },
  visto: { total: 61204.1, precios: {} },
  estado,
  ...extra,
})
const esperando: EstadoEnCola = { tipo: 'esperando', fase: { paso: 'nueva' }, intentos: 0 }
const AVISO = 'Podés seguir vendiendo. Las ventas quedan guardadas en el teléfono y se mandan solas cuando vuelva la señal. Precios y stock de las 08:12.'
const PIE = 'Si el precio cambió al enviarse, la venta queda en Borradores para que la revises.'

describe('VentasSinSenalLista (V9)', () => {
  it('sin señal avisa que se puede seguir vendiendo y de qué hora son los precios', () => {
    render(<VentasSinSenalLista items={[]} sinSenal horaCatalogo="08:12" />)
    expect(screen.getByText(AVISO)).toBeTruthy()
    expect(screen.getByText(PIE)).toBeTruthy()
  })

  it('con señal no muestra el aviso; sin hora del catálogo no inventa una', () => {
    const { rerender } = render(<VentasSinSenalLista items={[]} sinSenal={false} horaCatalogo="08:12" />)
    expect(screen.queryByText(/Podés seguir vendiendo/)).toBeNull()
    rerender(<VentasSinSenalLista items={[]} sinSenal horaCatalogo={null} />)
    expect(screen.getByText('Podés seguir vendiendo. Las ventas quedan guardadas en el teléfono y se mandan solas cuando vuelva la señal.')).toBeTruthy()
  })

  it('agrupa: esperando para enviarse (con cuántas), para revisar y enviadas', () => {
    render(
      <VentasSinSenalLista
        sinSenal
        horaCatalogo="08:12"
        items={[
          venta('a', esperando),
          venta('b', esperando, { alta: { ...venta('b', esperando).alta, tipoOperacion: 1 }, encoladaEn: Date.UTC(2026, 9, 22, 14, 58), cliente: { direccion: 'Jara 1643', nombreFantasia: 'Dietética' }, visto: { total: 23880, precios: {} } }),
          venta('c', { tipo: 'enviada', ventaId: 'v1', codigo: 'A00419', estado: 'PendienteAutorizacion' }, { encoladaEn: Date.UTC(2026, 9, 22, 13, 21), cliente: { direccion: 'Tarantino 1898' }, visto: { total: 88738.89, precios: {} } }),
          venta('d', { tipo: 'revisar', mensaje: 'Falta justificar la venta sin stock.' }),
          venta('e', { tipo: 'enBorradores', ventaId: 'b1', totalServidor: 70000 }),
        ]}
      />,
    )
    expect(screen.getByText('Esperando para enviarse · 2')).toBeTruthy()
    expect(screen.getAllByText('En el teléfono')).toHaveLength(2)
    expect(screen.getAllByText('Pedido · 11:40').length).toBeGreaterThan(0)
    expect(screen.getByText('Presupuesto · 11:58')).toBeTruthy()
    expect(screen.getByText('Jara 1643')).toBeTruthy()
    expect(screen.getByText('Dietética')).toBeTruthy()
    expect(screen.getByText('$ 23.880,00')).toBeTruthy()

    expect(screen.getByText('Enviadas')).toBeTruthy()
    expect(screen.getByText('Pedido A00419 · 10:21')).toBeTruthy()
    expect(screen.getByText('Por autorizar')).toBeTruthy()
    expect(screen.getByText('$ 88.738,89')).toBeTruthy()

    expect(screen.getByText('Para revisar · 2')).toBeTruthy()
    expect(screen.getByText('Falta justificar la venta sin stock.')).toBeTruthy()
    expect(screen.getByText('En Borradores')).toBeTruthy()
    expect(screen.getByText('El precio cambió: quedó en Borradores con el precio de hoy ($ 70.000,00).')).toBeTruthy()
  })

  it('sin ventas en el teléfono lo dice', () => {
    render(<VentasSinSenalLista items={[]} sinSenal={false} horaCatalogo={null} />)
    expect(screen.getByText('No hay ventas guardadas en el teléfono.')).toBeTruthy()
    expect(screen.queryByText(/Esperando para enviarse/)).toBeNull()
  })

  it('tocar una venta avisa cuál (para abrirla o revisarla)', async () => {
    const onAbrir = jest.fn()
    const v = venta('c', { tipo: 'enviada', ventaId: 'v1', codigo: 'A00419', estado: 'Confirmada' })
    render(<VentasSinSenalLista items={[v]} sinSenal={false} horaCatalogo={null} onAbrir={onAbrir} />)
    await userEvent.setup().press(screen.getByRole('button', { name: /Alem 3669/ }))
    expect(onAbrir).toHaveBeenCalledWith(v)
  })
})
