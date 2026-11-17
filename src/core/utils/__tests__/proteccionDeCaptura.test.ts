/**
 * M9, SEG-12, owner's decision #24: the whole app blocks screen capture. Android gets FLAG_SECURE (no screenshots,
 * no recordings, a blank thumbnail in the recent apps); iOS blocks screenshots and recordings and blurs the app
 * switcher snapshot.
 */
const mockPrevenir = jest.fn(async () => undefined)
const mockSelector = jest.fn(async () => undefined)
jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: (...a: unknown[]) => mockPrevenir(...(a as [])),
  enableAppSwitcherProtectionAsync: (...a: unknown[]) => mockSelector(...(a as [])),
}))

import { Platform } from 'react-native'
import { protegerCapturaDeLaApp } from '../proteccionDeCaptura'

const conPlataforma = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true })
}

beforeEach(() => {
  mockPrevenir.mockClear()
  mockSelector.mockClear()
})

it('android: blocks screen capture for the whole app (FLAG_SECURE also blanks the recent apps thumbnail)', async () => {
  conPlataforma('android')
  await protegerCapturaDeLaApp()
  expect(mockPrevenir).toHaveBeenCalledTimes(1)
  expect(mockSelector).not.toHaveBeenCalled()
})

it('ios: blocks screen capture and hides the app switcher snapshot', async () => {
  conPlataforma('ios')
  await protegerCapturaDeLaApp()
  expect(mockPrevenir).toHaveBeenCalledTimes(1)
  expect(mockSelector).toHaveBeenCalledTimes(1)
})

it('web: does nothing', async () => {
  conPlataforma('web')
  await protegerCapturaDeLaApp()
  expect(mockPrevenir).not.toHaveBeenCalled()
  expect(mockSelector).not.toHaveBeenCalled()
})

it('a native failure is reported to the caller (the root logs it), never swallowed in silence', async () => {
  conPlataforma('android')
  mockPrevenir.mockRejectedValueOnce(new Error('sin módulo nativo'))
  await expect(protegerCapturaDeLaApp()).rejects.toThrow('sin módulo nativo')
})
