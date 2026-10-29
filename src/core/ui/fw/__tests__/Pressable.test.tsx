/**
 * A style function on React Native's Pressable is dropped on the device by NativeWind's interop (the "Nueva venta"
 * Fab and every Button lost their size and background). The fw Pressable hands over an already resolved style.
 */
import fs from 'fs'
import path from 'path'
import React from 'react'
import { StyleSheet } from 'react-native'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { Pressable } from '../Pressable'

const fondo = () => StyleSheet.flatten(screen.getByRole('button').props.style)

describe('fw Pressable', () => {
  it('passes a resolved style (never a function) and follows the pressed state', () => {
    const onPressIn = jest.fn()
    render(
      <Pressable accessibilityRole="button" onPressIn={onPressIn}
        style={({ pressed }) => ({ height: 48, backgroundColor: pressed ? 'red' : 'blue' })} />,
    )
    expect(typeof screen.getByRole('button').props.style).not.toBe('function')
    expect(fondo()).toMatchObject({ height: 48, backgroundColor: 'blue' })
    fireEvent(screen.getByRole('button'), 'pressIn')
    expect(fondo()).toMatchObject({ backgroundColor: 'red' })
    expect(onPressIn).toHaveBeenCalledTimes(1)
    fireEvent(screen.getByRole('button'), 'pressOut')
    expect(fondo()).toMatchObject({ backgroundColor: 'blue' })
  })

  it('a plain style goes through unchanged', () => {
    render(<Pressable accessibilityRole="button" style={{ height: 56 }} />)
    expect(fondo()).toMatchObject({ height: 56 })
  })
})

describe('no style function on the Pressable from react-native', () => {
  // Files that import Pressable from 'react-native' must not give it `style={({ pressed }) => ...}`.
  const raiz = path.resolve(__dirname, '../../../../..')
  const archivos = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) return e.name === 'node_modules' || e.name === '__tests__' ? [] : archivos(p)
      return p.endsWith('.tsx') ? [p] : []
    })

  it('every such Pressable comes from core/ui/fw', () => {
    const conFuncion = ['src', 'app', 'libs'].flatMap((d) => archivos(path.join(raiz, d))).filter((f) => {
      const s = fs.readFileSync(f, 'utf8')
      const deReactNative = /import\s*\{[^}]*\bPressable\b[^}]*\}\s*from\s*'react-native'/.test(s)
      return deReactNative && /style=\{\s*\(\s*\{\s*pressed/.test(s)
    })
    expect(conFuncion.map((f) => path.relative(raiz, f))).toEqual([])
  })
})
