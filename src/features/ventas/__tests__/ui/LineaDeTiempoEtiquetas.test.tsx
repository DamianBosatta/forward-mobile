import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { LineaDeTiempo } from '../../components/DetalleVenta'
import { pasosDeLaVenta, PASOS_DE_LA_VENTA } from '../../lib/lineaDeTiempo'

describe.each(['light', 'dark'] as const)('Línea de tiempo de la venta (%s)', () => {
  it.each([360, 768])('ninguna etiqueta se corta a mitad de palabra (ancho %s)', () => {
    render(<LineaDeTiempo pasos={pasosDeLaVenta('Confirmada')!} />)
    for (const etiqueta of PASOS_DE_LA_VENTA) {
      const t = screen.getByText(etiqueta)
      expect(t.props.numberOfLines).toBe(1)
      expect(t.props.adjustsFontSizeToFit).toBe(true)
      expect(t.props.minimumFontScale).toBeGreaterThanOrEqual(0.8)
    }
  })
})
