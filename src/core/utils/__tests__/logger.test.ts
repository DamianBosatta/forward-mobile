import * as Sentry from '@sentry/react-native'

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}))

// The logger reads __DEV__ on every call, so each test can pick its environment.
const setDev = (value: boolean) => {
  ;(global as unknown as { __DEV__: boolean }).__DEV__ = value
}

const loadLogger = () => {
  let logger!: typeof import('../logger').logger
  jest.isolateModules(() => {
    logger = require('../logger').logger
  })
  return logger
}

describe('logger', () => {
  const originalDev = (global as unknown as { __DEV__: boolean }).__DEV__
  let infoSpy: jest.SpyInstance
  let warnSpy: jest.SpyInstance
  let errorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {})
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    setDev(originalDev)
    infoSpy.mockRestore()
    errorSpy.mockRestore()
  })

  describe('level by environment', () => {
    it('prints debug and info in development', () => {
      setDev(true)
      const logger = loadLogger()
      logger.info('hello')
      logger.warn('careful')
      expect(infoSpy).toHaveBeenCalledWith('[INFO]', 'hello')
      expect(warnSpy).toHaveBeenCalledWith('[WARN]', 'careful')
    })

    it('prints only warn and error in production', () => {
      setDev(false)
      const logger = loadLogger()
      logger.log('noise')
      logger.info('noise')
      logger.warn('careful')
      logger.error('boom')
      expect(infoSpy).not.toHaveBeenCalled()
      expect(warnSpy).toHaveBeenCalledWith('[WARN]', 'careful')
      expect(errorSpy).toHaveBeenCalledWith('[ERROR]', 'boom')
    })
  })

  describe('Sentry reporting', () => {
    it('reports a 5xx message and an Error object', () => {
      setDev(false)
      const logger = loadLogger()
      logger.error('API Error [500] /ventas:', 'server down')
      const err = new Error('crash')
      logger.error('CRITICAL_CRASH:', err)
      expect(Sentry.captureMessage).toHaveBeenCalledWith('API Error [500] /ventas: server down')
      expect(Sentry.captureException).toHaveBeenCalledWith(err)
    })

    it('never reports a 4xx to Sentry', () => {
      setDev(false)
      const logger = loadLogger()
      logger.error('API Error [404] /clientes/9:', 'not found')
      logger.error('API Error [422] /ventas:', 'invalid')
      logger.error(Object.assign(new Error('Datos inválidos'), { status: 400 }))
      expect(Sentry.captureMessage).not.toHaveBeenCalled()
      expect(Sentry.captureException).not.toHaveBeenCalled()
    })

    it('never reports an Error whose message is a 4xx, even without a numeric status', () => {
      setDev(false)
      const logger = loadLogger()
      logger.error(new Error('API Error [404] /x'))
      expect(Sentry.captureException).not.toHaveBeenCalled()
      expect(Sentry.captureMessage).not.toHaveBeenCalled()
    })

    it('still reports an Error whose message is a 5xx or unrelated', () => {
      setDev(false)
      const logger = loadLogger()
      logger.error(new Error('API Error [500] /x'))
      logger.error(new Error('boom'))
      expect(Sentry.captureException).toHaveBeenCalledTimes(2)
    })

    it('still does not report the 4xx string', () => {
      setDev(false)
      const logger = loadLogger()
      logger.error('API Error [404] /x')
      expect(Sentry.captureMessage).not.toHaveBeenCalled()
    })

    it('never sends the query string (search terms) to Sentry', () => {
      setDev(false)
      const logger = loadLogger()
      logger.error('API Error [500] /clientes?buscar=juan%20perez&page=2:', 'server down')
      const err = Object.assign(new Error('GET /clientes?buscar=juan%20perez failed'), { status: 500 })
      logger.error(err)

      const sent = (Sentry.captureMessage as jest.Mock).mock.calls[0][0] as string
      expect(sent).toContain('/clientes')
      expect(sent).not.toMatch(/juan|buscar|perez/)
      const sentError = (Sentry.captureException as jest.Mock).mock.calls[0][0] as Error
      expect(sentError.message).not.toMatch(/juan|buscar|perez/)
    })
  })
})
