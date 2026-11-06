import fs from 'fs'
import path from 'path'

const RAIZ = path.resolve(__dirname, '../../../../..')

describe('arranque del GPS del viaje', () => {
  it('main apunta a index.js, que carga registroGps antes que la entrada del router (la tarea se define aunque Android arranque solo el JS)', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8')) as { main: string }
    expect(pkg.main).toBe('index.js')
    const imports = fs.readFileSync(path.join(RAIZ, 'index.js'), 'utf8')
      .split('\n').map((l) => l.trim()).filter((l) => /^(import|require)\b/.test(l) || /require\(/.test(l))
    const iGps = imports.findIndex((l) => l.includes('registroGps'))
    const iRouter = imports.findIndex((l) => l.includes('expo-router/entry'))
    expect(iGps).toBeGreaterThanOrEqual(0)
    expect(iRouter).toBeGreaterThan(iGps)
  })

  it('Android 13+: el manifiesto declara POST_NOTIFICATIONS (la notificación del servicio de ubicación)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = require('../../../../../app.config').default as { android?: { permissions?: string[] } }
    expect(config.android?.permissions).toContain('android.permission.POST_NOTIFICATIONS')
  })
})
