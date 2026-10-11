import React from 'react'
import { render, screen, userEvent } from '@testing-library/react-native'
import { CircleCheck, FileText, Search, Tag } from 'lucide-react-native'
import { themeColors } from '@/libs/theme'
import { BottomBar, Notice, TopBar } from '../index'
import { TEMAS, conTema, estilo } from '../__testing__/tema'

afterEach(() => conTema('light'))

describe('TopBar', () => {
  it('el botón de atrás, las acciones y las pestañas responden', async () => {
    const volver = jest.fn()
    const buscar = jest.fn()
    const cabecera = jest.fn()
    render(
      <TopBar
        title="Nuevo pedido"
        subtitle="Tarantino 1898"
        leading={{ kind: 'atras', onPress: volver }}
        actions={[{ icon: Search, accessibilityLabel: 'Buscar', onPress: buscar }]}
        syncLabel="Guardado"
        tabs={[
          { label: 'Líneas (2)', selected: true, onPress: jest.fn() },
          { label: 'Cabecera', selected: false, onPress: cabecera },
        ]}
      />,
    )
    await userEvent.press(screen.getByRole('button', { name: 'Volver' }))
    await userEvent.press(screen.getByRole('button', { name: 'Buscar' }))
    await userEvent.press(screen.getByRole('tab', { name: 'Cabecera' }))
    expect([volver, buscar, cabecera].map((f) => f.mock.calls.length)).toEqual([1, 1, 1])
    expect(screen.getByRole('tab', { name: 'Líneas (2)' })).toBeSelected()
    expect(screen.getByLabelText('Guardado')).toBeTruthy()
  })

  it.each(TEMAS)('tema %s: barra, título y punto de sincronizado con los tokens', (tema) => {
    conTema(tema)
    const c = themeColors[tema]
    render(<TopBar title="Inicio" leading={{ kind: 'menu', onPress: jest.fn() }} syncLabel="Guardado" />)
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toBeTruthy()
    expect(estilo(screen.getByRole('header')).color).toBe(c.onTopBarStrong)
    expect(estilo(screen.getByTestId('topbar-sync-dot')).backgroundColor).toBe(c.brand)
  })
})

describe('BottomBar', () => {
  const items = (presupuesto = jest.fn()) => [
    { key: 'presupuesto', label: 'Presupuesto', icon: FileText, onPress: presupuesto },
    { key: 'pedido', label: 'Pedido', icon: Tag, onPress: jest.fn() },
  ]

  it('marca el activo y llama al ítem tocado', async () => {
    const presupuesto = jest.fn()
    render(<BottomBar items={items(presupuesto)} activeKey="pedido" />)
    expect(screen.getByRole('button', { name: 'Pedido' })).toBeSelected()
    expect(screen.getByRole('button', { name: 'Presupuesto' })).not.toBeSelected()
    await userEvent.press(screen.getByRole('button', { name: 'Presupuesto' }))
    expect(presupuesto).toHaveBeenCalledTimes(1)
  })

  it.each(TEMAS)('tema %s: el activo va en marca-tinta y el resto en texto', (tema) => {
    conTema(tema)
    const c = themeColors[tema]
    render(<BottomBar items={items()} activeKey="pedido" />)
    expect(estilo(screen.getByText('Pedido')).color).toBe(c.brandInk)
    expect(estilo(screen.getByText('Presupuesto')).color).toBe(c.text)
    expect(estilo(screen.getByRole('button', { name: 'Pedido' })).borderTopColor).toBe(c.brand)
  })
})

describe('Notice', () => {
  it('el de peligro se anuncia como alerta; los demás no', () => {
    render(
      <>
        <Notice tone="peligro">El precio está por debajo del costo.</Notice>
        <Notice tone="advertencia" title="Tu tope es 10 %.">Va a quedar por autorizar.</Notice>
      </>,
    )
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByRole('alert')).toHaveTextContent('El precio está por debajo del costo.')
    expect(screen.getByText(/Va a quedar por autorizar/)).toHaveTextContent('Tu tope es 10 %. Va a quedar por autorizar.')
  })

  it.each(TEMAS)('tema %s: texto en color de texto e ícono en color de estado', (tema) => {
    conTema(tema)
    const c = themeColors[tema]
    render(<Notice tone="exito" testID="aviso">Pedido guardado.</Notice>)
    expect(estilo(screen.getByTestId('aviso')).backgroundColor).toBe(c.chip.entregado.bg)
    expect(estilo(screen.getByText('Pedido guardado.')).color).toBe(c.text)
    expect(screen.UNSAFE_getByType(CircleCheck).props.color).toBe(c.chip.entregado.text)
  })
})
