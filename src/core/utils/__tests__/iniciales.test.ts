import { iniciales } from '../texto'
import { inicialesDeDireccion } from '@/features/clientes/lib/cliente'
import { iniciales as inicialesDeLaTarjeta } from '@/core/ui/fw/DocumentCard'

describe('iniciales (avatar)', () => {
  it('"Calle 1 234" ya no da "C1": el prefijo de calle se salta', () => {
    expect(iniciales('Calle 1 234')).not.toBe('C1')
    expect(iniciales('Calle 1 234')).toBe('12')
  })

  it.each(['Calle', 'Av.', 'Av', 'AVENIDA', 'Pasaje', 'Pje.', 'pje', 'Ruta', 'Bv.', 'Boulevard', 'Diagonal'])('salta el prefijo %s', (prefijo) => {
    expect(iniciales(`${prefijo} del Valle 89`)).toBe('DV')
  })

  it('sin prefijo conserva las iniciales de siempre', () => {
    expect(iniciales('Brandsen 3314')).toBe('B3')
    expect(iniciales('Juan Pérez')).toBe('JP')
    expect(iniciales('Insumos del Sur SA')).toBe('ID')
  })

  it('solo el prefijo: no queda vacío', () => {
    expect(iniciales('Ruta')).toBe('R')
    expect(iniciales('')).toBe('')
  })

  it('los dos lugares usan la misma función', () => {
    expect(inicialesDeDireccion).toBe(iniciales)
    expect(inicialesDeLaTarjeta).toBe(iniciales)
  })
})
