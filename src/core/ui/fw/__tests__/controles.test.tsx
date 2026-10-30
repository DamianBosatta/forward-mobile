import React, { useState } from 'react'
import { render, screen, userEvent } from '@testing-library/react-native'
import { themeColors } from '@/libs/theme'
import { Button, Field, Segmented } from '../index'
import { TEMAS, conTema, estilo } from '../__testing__/tema'

afterEach(() => conTema('light'))

describe('Button', () => {
  it('llama a onPress al tocarlo', async () => {
    const onPress = jest.fn()
    render(<Button label="Confirmar pedido" onPress={onPress} />)
    await userEvent.press(screen.getByRole('button', { name: 'Confirmar pedido' }))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('deshabilitado no llama a onPress y lo anuncia', async () => {
    const onPress = jest.fn()
    render(<Button label="Anular" variant="peligro" onPress={onPress} disabled />)
    const boton = screen.getByRole('button', { name: 'Anular' })
    await userEvent.press(boton)
    expect(onPress).not.toHaveBeenCalled()
    expect(boton).toBeDisabled()
  })

  it('cargando no llama a onPress y se anuncia ocupado', async () => {
    const onPress = jest.fn()
    render(<Button label="Guardar nota" variant="secundario" onPress={onPress} loading />)
    const boton = screen.getByRole('button', { name: 'Guardar nota' })
    await userEvent.press(boton)
    expect(onPress).not.toHaveBeenCalled()
    expect(boton.props.accessibilityState).toMatchObject({ busy: true, disabled: true })
  })

  it.each(TEMAS)('tema %s: cada variante usa su par de tokens', (tema) => {
    conTema(tema)
    const c = themeColors[tema]
    render(
      <>
        <Button label="P" onPress={jest.fn()} />
        <Button label="S" variant="secundario" onPress={jest.fn()} />
        <Button label="D" variant="peligro" onPress={jest.fn()} />
        <Button label="X" onPress={jest.fn()} disabled />
      </>,
    )
    const pares: [string, string, string][] = [
      ['P', c.action, c.onAction],
      ['S', c.surface, c.text],
      ['D', c.dangerStrong, c.onDangerStrong],
      ['X', c.surface2, c.textSecondary],
    ]
    for (const [label, fondo, texto] of pares) {
      expect(estilo(screen.getByRole('button', { name: label })).backgroundColor).toBe(fondo)
      expect(estilo(screen.getByText(label)).color).toBe(texto)
    }
  })
})

describe('Field', () => {
  it('muestra el error, lo anuncia y lo deja como pista del campo', () => {
    render(<Field label="Costo por unidad ($)" error="Falta el costo" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Falta el costo')
    expect(screen.getByLabelText('Costo por unidad ($)').props.accessibilityHint).toBe('Falta el costo')
  })

  it('sin error muestra la ayuda y no anuncia nada', () => {
    render(<Field label="Observaciones" help="Se imprime en el remito" />)
    expect(screen.getByText('Se imprime en el remito')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it.each(TEMAS)('tema %s: relleno superficie-2 y texto del tema', (tema) => {
    conTema(tema)
    render(<Field label="Observaciones" value="Entregar antes de las 12" />)
    const s = estilo(screen.getByLabelText('Observaciones'))
    expect(s.backgroundColor).toBe(themeColors[tema].surface2)
    expect(s.color).toBe(themeColors[tema].text)
    expect(s.height).toBe(48)
  })
})

describe('Field con ojo', () => {
  it('verOcultar muestra el ojo y alterna ver/ocultar; sin la prop no hay ojo', async () => {
    render(<Field label="Contraseña" secureTextEntry verOcultar />)
    expect(screen.getByLabelText('Contraseña').props.secureTextEntry).toBe(true)
    await userEvent.press(screen.getByLabelText('Mostrar contraseña'))
    expect(screen.getByLabelText('Contraseña').props.secureTextEntry).toBe(false)
    await userEvent.press(screen.getByLabelText('Ocultar contraseña'))
    expect(screen.getByLabelText('Contraseña').props.secureTextEntry).toBe(true)
  })

  it('sin verOcultar no hay botón y secureTextEntry se respeta', () => {
    render(<Field label="Contraseña" secureTextEntry />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByLabelText('Contraseña').props.secureTextEntry).toBe(true)
  })
})

describe('Segmented', () => {
  const OPCIONES = [
    { value: 'logistica', label: 'Logística' },
    { value: 'retiro', label: 'Retiro' },
    { value: 'expreso', label: 'Expreso' },
  ] as const

  function Controlado() {
    const [v, setV] = useState<'logistica' | 'retiro' | 'expreso'>('logistica')
    return <Segmented accessibilityLabel="Método de entrega" options={[...OPCIONES]} value={v} onChange={setV} />
  }

  it('cambia la selección y la expone en accessibilityState', async () => {
    render(<Controlado />)
    expect(screen.getByRole('radio', { name: 'Logística' })).toBeSelected()
    await userEvent.press(screen.getByRole('radio', { name: 'Retiro' }))
    expect(screen.getByRole('radio', { name: 'Retiro' })).toBeSelected()
    expect(screen.getByRole('radio', { name: 'Logística' })).not.toBeSelected()
  })

  it('tocar el segmento elegido no vuelve a avisar', async () => {
    const onChange = jest.fn()
    render(<Segmented accessibilityLabel="Entrega" options={[...OPCIONES]} value="retiro" onChange={onChange} />)
    await userEvent.press(screen.getByRole('radio', { name: 'Retiro' }))
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.press(screen.getByRole('radio', { name: 'Expreso' }))
    expect(onChange).toHaveBeenCalledWith('expreso')
  })

  it.each(TEMAS)('tema %s: segmentos de 44 px y el elegido en superficie', (tema) => {
    conTema(tema)
    render(<Segmented accessibilityLabel="Entrega" options={[...OPCIONES]} value="retiro" onChange={jest.fn()} />)
    for (const radio of screen.getAllByRole('radio')) {
      expect(estilo(radio).minHeight).toBeGreaterThanOrEqual(44)
    }
    expect(estilo(screen.getByRole('radio', { name: 'Retiro' })).backgroundColor).toBe(themeColors[tema].surface)
  })
})
