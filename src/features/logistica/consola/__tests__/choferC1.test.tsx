import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { conTema } from '@/core/ui/fw/__testing__/tema'
import type { ParadaDto } from '@/libs/api-client/types'
import { armarLinea, type LineaCobroForm } from '../entrega'
import { CobroEnEntrega } from '../CobroEnEntrega'
import { ParadaGrande } from '../ParadaGrande'

jest.mock('../CamaraChofer', () => ({ CamaraChofer: () => null }))

const EFECTIVO = { id: 'm-ef', nombre: 'Efectivo', tipo: 'Efectivo' }
const TRANSFER = { id: 'm-tr', nombre: 'Transferencia bancaria', tipo: 'Transferencia' }
const CHEQUE = { id: 'm-ch', nombre: 'Cheque', tipo: 'Cheque' }
const linea = (medio: LineaCobroForm['medio'], monto: string, fotoUrl: string | null = null): LineaCobroForm => ({ medio, monto, fotoUrl })

const props = { medios: [], mediosError: false, onLineas: jest.fn(), onSubiendo: jest.fn() }

describe('S7 cheque: el chofer solo avisa, con monto y foto', () => {
  it('la línea viaja con medioPagoId, monto y fotoUrl, sin el arreglo cheques', () => {
    const r = armarLinea(linea(CHEQUE as never, '1.500', 'https://r2.test/c.jpg'), 1)
    expect(r).toEqual({ linea: { medioPagoId: 'm-ch', monto: 1500, fotoUrl: 'https://r2.test/c.jpg' } })
    expect('linea' in r && 'cheques' in r.linea).toBe(false)
  })
  it('sin foto no sale y dice qué falta', () => {
    expect(armarLinea(linea(CHEQUE as never, '1500'), 2)).toEqual({ error: 'Falta la foto del cheque (cobro 2).' })
  })
  it('con monto cero no sale', () => {
    expect(armarLinea(linea(CHEQUE as never, '0', 'https://r2.test/c.jpg'), 1)).toEqual({ error: 'El monto del cobro 1 tiene que ser mayor a cero.' })
  })
  it('lo ya existente sigue igual: efectivo y transferencia mantienen su cuerpo', () => {
    expect(armarLinea(linea(EFECTIVO as never, '500'), 1)).toEqual({ linea: { medioPagoId: 'm-ef', monto: 500, fotoUrl: undefined } })
    expect(armarLinea(linea(TRANSFER as never, '900', 'https://r2.test/t.jpg'), 1)).toEqual({ linea: { medioPagoId: 'm-tr', monto: 900, fotoUrl: 'https://r2.test/t.jpg' } })
    expect(armarLinea(linea(TRANSFER as never, '900'), 1)).toEqual({ error: 'Falta la foto del comprobante de la transferencia (cobro 1).' })
  })
})

describe.each(['light', 'dark'] as const)('chofer C1 (%s)', (tema) => {
  beforeEach(() => conTema(tema))

  it('S7: el cheque pide solo monto y foto: sin número, banco, titular ni fechas', () => {
    render(<CobroEnEntrega {...props} lineas={[linea(CHEQUE as never, '')]} />)
    expect(screen.getByLabelText('Monto del cobro 1')).toBeTruthy()
    expect(screen.getByText('Sacar foto del cheque')).toBeTruthy()
    expect(screen.queryByLabelText(/N\.º de cheque|Banco|Titular|Fecha de/)).toBeNull()
  })

  it('S6: la transferencia ofrece "Sacar foto del comprobante" como botón primario', () => {
    render(<CobroEnEntrega {...props} lineas={[linea(TRANSFER as never, '')]} />)
    expect(screen.getByText('Sacar foto del comprobante')).toBeTruthy()
  })

  it('S9: con un pago cargado no hay botón "Sumar otro pago" dentro del cobro', () => {
    render(<CobroEnEntrega {...props} lineas={[linea(EFECTIVO as never, '500')]} />)
    expect(screen.queryByText('Sumar otro pago')).toBeNull()
    expect(screen.queryByLabelText('Sumar otro pago')).toBeNull()
  })

  it('S8: la próxima parada no ofrece "Ver pedido"', () => {
    const parada = { id: 'p1', ventaId: 'v1', clienteNombre: 'Abel', direccion: 'Calle 1', estado: 0 } as unknown as ParadaDto
    render(<ParadaGrande parada={parada} numero={1} total={2} puedeLlamar notaCargando={false} onLlamar={jest.fn()} onNota={jest.fn()} />)
    expect(screen.queryByText('Ver pedido')).toBeNull()
    expect(screen.getByText('Nota de entrega')).toBeTruthy()
  })
})
