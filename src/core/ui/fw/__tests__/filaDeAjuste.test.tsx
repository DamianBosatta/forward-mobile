import React from 'react'
import { render, screen, userEvent } from '@testing-library/react-native'
import { Fingerprint, Lock } from 'lucide-react-native'
import { themeColors } from '@/libs/theme'
import { Button, FilaDeAjuste, FilaInterruptor } from '../index'
import { TEMAS, conTema, estilo } from '../__testing__/tema'

afterEach(() => conTema('light'))

describe('FilaInterruptor', () => {
  it('la fila entera es el interruptor: dice su estado y cambia al tocarla', async () => {
    const alCambiar = jest.fn()
    render(<FilaInterruptor icono={Fingerprint} titulo="Entrar con huella" apoyo="Prendida" prendido onChange={alCambiar} />)
    const fila = screen.getByRole('switch', { name: 'Entrar con huella' })
    expect(fila.props.accessibilityState.checked).toBe(true)
    expect(screen.getByText('Prendida')).toBeTruthy()
    await userEvent.press(fila)
    expect(alCambiar).toHaveBeenCalledTimes(1)
  })

  it('apagado se anuncia sin marcar', () => {
    render(<FilaInterruptor titulo="Entrar con huella" apoyo="Apagada" prendido={false} onChange={jest.fn()} />)
    expect(screen.getByRole('switch', { name: 'Entrar con huella' }).props.accessibilityState.checked).toBe(false)
  })

  it('deshabilitado no cambia', async () => {
    const alCambiar = jest.fn()
    render(<FilaInterruptor titulo="Crítico" prendido disabled onChange={alCambiar} />)
    await userEvent.press(screen.getByRole('switch', { name: 'Crítico' }))
    expect(alCambiar).not.toHaveBeenCalled()
  })
})

describe('FilaDeAjuste', () => {
  it('es un botón con título y línea de apoyo que lleva a otra pantalla', async () => {
    const alTocar = jest.fn()
    render(<FilaDeAjuste icono={Lock} titulo="Cambiar contraseña" apoyo="Pide la actual y una nueva" onPress={alTocar} />)
    expect(screen.getByText('Pide la actual y una nueva')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Cambiar contraseña' }))
    expect(alTocar).toHaveBeenCalledTimes(1)
  })

  it.each(TEMAS)('tema %s: ocupa al menos 56 de alto y usa tokens del tema', (tema) => {
    conTema(tema)
    const c = themeColors[tema]
    render(<FilaDeAjuste titulo="Usuarios" onPress={jest.fn()} />)
    const fila = estilo(screen.getByRole('button', { name: 'Usuarios' }))
    expect(fila.minHeight).toBeGreaterThanOrEqual(56)
    expect(estilo(screen.getByText('Usuarios')).color).toBe(c.text)
  })
})

describe('Button peligroContorno', () => {
  it.each(TEMAS)('tema %s: contorno y texto con el rojo del chip anulado, sin fondo sólido', (tema) => {
    conTema(tema)
    const c = themeColors[tema]
    render(<Button label="Cerrar sesión" variant="peligroContorno" onPress={jest.fn()} />)
    const b = estilo(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(b.backgroundColor).toBe(c.surface)
    expect(b.borderColor).toBe(c.chip.anulado.text)
    expect(estilo(screen.getByText('Cerrar sesión')).color).toBe(c.chip.anulado.text)
  })
})
