/**
 * Audit tranche 4, S3: the "Mi cuenta" version line, so support can ask "¿qué versión tenés?".
 */
import { lineasDeVersion } from '../lib/version'

describe('lineasDeVersion', () => {
  it('shows the version and the build number', () => {
    expect(lineasDeVersion({ version: '1.0.0', build: '12' })).toEqual({
      version: 'Forward Mobile 1.0.0 (build 12)',
      actualizacion: null,
    })
  })

  it('omits the build when there is no build number', () => {
    expect(lineasDeVersion({ version: '1.0.0', build: null }).version).toBe('Forward Mobile 1.0.0')
    expect(lineasDeVersion({ version: '1.0.0' }).version).toBe('Forward Mobile 1.0.0')
  })

  it('shows the running update: first 8 characters of its id and its Argentina calendar day', () => {
    // 2026-11-03T01:30Z is still 2 November in Argentina (UTC-3).
    const lineas = lineasDeVersion({
      version: '1.0.0',
      build: '12',
      actualizacion: { id: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789', creadaEl: new Date('2026-11-03T01:30:00Z') },
    })
    expect(lineas).toEqual({
      version: 'Forward Mobile 1.0.0 (build 12)',
      actualizacion: 'Actualización a1b2c3d4 del 02/11/2026',
    })
  })

  it('shows the update id without a date when the date is unknown', () => {
    expect(lineasDeVersion({ version: '1.0.0', actualizacion: { id: 'a1b2c3d4e5', creadaEl: null } }).actualizacion)
      .toBe('Actualización a1b2c3d4')
  })

  it('with updates disabled there is no update line and the version still shows', () => {
    expect(lineasDeVersion({ version: '1.0.0', build: '12', actualizacion: null })).toEqual({
      version: 'Forward Mobile 1.0.0 (build 12)',
      actualizacion: null,
    })
  })

  it('without a version it still names the app', () => {
    expect(lineasDeVersion({}).version).toBe('Forward Mobile')
  })
})

describe('leerDatosDeVersion', () => {
  it('does not throw when the build lacks the expo-updates and expo-application native modules', () => {
    jest.isolateModules(() => {
      jest.doMock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }))
      jest.doMock('expo-updates', () => { throw new Error("Cannot find native module 'ExpoUpdates'") })
      jest.doMock('expo-application', () => { throw new Error("Cannot find native module 'ExpoApplication'") })
      const { leerDatosDeVersion } = require('../lib/version') as typeof import('../lib/version')
      expect(leerDatosDeVersion()).toEqual({ version: '1.0.0', build: null, actualizacion: null })
    })
  })
})
