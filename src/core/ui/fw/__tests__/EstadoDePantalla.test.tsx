/**
 * Bloque 12, T13b (lienzo R16): los tres estados de pantalla (lista vacía, sin conexión con el
 * servidor y sin permiso) se ven igual en toda la app.
 */
import React from 'react'
import { render, screen, userEvent } from '@testing-library/react-native'
import { EstadoDePantalla, textoSinConexion } from '../EstadoDePantalla'

describe('EstadoDePantalla', () => {
  it('lista vacía: dice qué pasa, qué va a aparecer y ofrece la acción', async () => {
    const accion = jest.fn()
    render(
      <EstadoDePantalla
        tipo="vacio"
        titulo="Todavía no vendiste hoy"
        texto="Cuando cargues una venta, aparece acá agrupada por día."
        accion={{ label: 'Nueva venta', onPress: accion }}
      />,
    )
    expect(screen.getByRole('header', { name: 'Todavía no vendiste hoy' })).toBeTruthy()
    expect(screen.getByText('Cuando cargues una venta, aparece acá agrupada por día.')).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Nueva venta' }))
    expect(accion).toHaveBeenCalledTimes(1)
  })

  it('sin conexión: dice a qué hora (de Argentina) guardó el teléfono lo que se muestra', () => {
    // 11:12 UTC = 08:12 en Argentina.
    render(<EstadoDePantalla tipo="sinConexion" titulo="No pudimos cargar los clientes" guardadoA={Date.UTC(2026, 9, 22, 11, 12)} />)
    expect(screen.getByText('Parece que no hay señal. Mostramos lo último que guardó el teléfono a las 08:12.')).toBeTruthy()
  })

  it('sin conexión y sin nada guardado no inventa una hora', () => {
    render(<EstadoDePantalla tipo="sinConexion" titulo="No pudimos cargar los clientes" />)
    expect(screen.getByText('Parece que no hay señal. Probá de nuevo en un rato.')).toBeTruthy()
  })

  it('sin permiso: nombra la sección y dice a quién pedirlo', () => {
    render(<EstadoDePantalla tipo="sinPermiso" titulo="No tenés acceso a Compras" />)
    expect(screen.getByRole('header', { name: 'No tenés acceso a Compras' })).toBeTruthy()
    expect(screen.getByText('Si lo necesitás, pedíselo a quien administra los usuarios en la web.')).toBeTruthy()
  })

  it('un texto propio reemplaza al de siempre', () => {
    render(<EstadoDePantalla tipo="sinPermiso" titulo="No tenés acceso" texto="Hablalo con gestión." />)
    expect(screen.getByText('Hablalo con gestión.')).toBeTruthy()
    expect(screen.queryByText(/administra los usuarios/)).toBeNull()
  })

  it('textoSinConexion es la misma frase de la pantalla, para un aviso sobre lo guardado', () => {
    expect(textoSinConexion(Date.UTC(2026, 9, 22, 11, 12))).toBe('Parece que no hay señal. Mostramos lo último que guardó el teléfono a las 08:12.')
    expect(textoSinConexion()).toBe('Parece que no hay señal. Probá de nuevo en un rato.')
    // react-query usa 0 cuando nunca guardó nada: tampoco se inventa la hora.
    expect(textoSinConexion(0)).toBe('Parece que no hay señal. Probá de nuevo en un rato.')
  })
})
