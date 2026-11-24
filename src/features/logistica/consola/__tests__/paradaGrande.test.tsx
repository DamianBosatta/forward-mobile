import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { conTema, estilo } from '@/core/ui/fw/__testing__/tema'
import { themeColors } from '@/libs/theme'
import type { ParadaDto } from '@/libs/api-client/types'
import { ParadaGrande } from '../ParadaGrande'

const parada = { id: 'p1', orden: 1, ventaId: 'v', clienteNombre: 'Abel', direccion: 'Calle 1 123', telefono: '1', cantidadBultos: 2, montoTotal: 100, latitud: 0, longitud: 0, estado: 1 } as unknown as ParadaDto
const props = { parada, numero: 1, total: 3, puedeLlamar: true, notaCargando: false, onLlamar: jest.fn(), onNota: jest.fn() }

describe.each(['light', 'dark'] as const)('ParadaGrande (%s)', (tema) => {
  beforeEach(() => conTema(tema))

  it('MD-1: the address is the largest line and the client name goes below it, smaller', () => {
    render(<ParadaGrande {...props} />)
    const direccion = estilo(screen.getByText('Calle 1 123'))
    const cliente = estilo(screen.getByText('Abel'))
    expect(direccion.fontSize).toBeGreaterThan(cliente.fontSize as number)
    const orden = JSON.stringify(screen.toJSON())
    expect(orden.indexOf('Calle 1 123')).toBeLessThan(orden.indexOf('Abel'))
  })

  it('MD-3: the shortcuts have a 2 px ink border so they read on the lime card', () => {
    render(<ParadaGrande {...props} />)
    for (const nombre of ['Llamar', 'Nota de entrega']) {
      const e = estilo(screen.getByLabelText(nombre))
      expect(e.borderWidth).toBe(2)
      expect(e.borderColor).toBe(themeColors[tema].ink)
    }
  })
})
