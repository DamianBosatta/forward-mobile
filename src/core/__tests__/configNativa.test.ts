/**
 * Re-audit 4, OPS-03/OPS-07/OPS-09/SEG-13: native config that no screen test sees.
 */
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

import config from '../../../app.config'
import pkg from '../../../package.json'

const raiz = join(__dirname, '..', '..', '..')

describe('native config', () => {
  it('has a single source for the app version: package.json', () => {
    expect(config.version).toBe(pkg.version)
    expect(pkg.version).toMatch(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/)
  })

  it('points the development EAS profile to a non-production API', () => {
    const eas = JSON.parse(readFileSync(join(raiz, 'eas.json'), 'utf8'))
    const env = eas.build.development.env
    expect(env.EXPO_PUBLIC_API_URL).not.toContain('forward-gestion.com.ar')
    expect(env.EXPO_PUBLIC_SIGNALR_URL).not.toContain('forward-gestion.com.ar')
  })

  it('does not track the generated ios folder', () => {
    expect(existsSync(join(raiz, 'ios', 'Podfile'))).toBe(false)
  })
})
