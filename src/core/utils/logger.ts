import * as Sentry from '@sentry/react-native'

/**
 * Forward ERP – centralized logger.
 *
 * Level by environment: development prints everything (log/info are the debug level);
 * production prints and reports only warn and error. There is no file sink: nothing read it
 * and it grew without a cap.
 *
 * Sentry rules: a 4xx is an expected business/validation answer, never reported; the query
 * string (search terms typed by the user) is stripped from anything sent.
 */

// Read on every call (not at import) so the level always follows the current environment.
const isDev = () => __DEV__

const QUERY_STRING = /\?\S*/g

const withoutQueryString = (text: string): string => text.replace(QUERY_STRING, '?<redacted>')

const API_ERROR_4XX = /API Error \[4\d\d\]/

const statusOf = (value: unknown): number | null => {
  const status = (value as { status?: unknown } | null)?.status
  return typeof status === 'number' ? status : null
}

const isClientError = (status: number | null): boolean => status !== null && status >= 400 && status < 500

const stringify = (arg: unknown): string => {
  if (typeof arg !== 'object' || arg === null) return String(arg)
  try {
    return JSON.stringify(arg)
  } catch {
    return '[Unserializable Object]'
  }
}

/** Same error with the query string removed from its message; keeps name and stack. */
const scrubbedError = (err: Error): Error => {
  const message = withoutQueryString(err.message)
  if (message === err.message) return err
  const copy = new Error(message)
  copy.name = err.name
  copy.stack = err.stack ? withoutQueryString(err.stack) : err.stack
  return copy
}

const reportToSentry = (args: unknown[]) => {
  const err = args.find((a) => a instanceof Error) ?? (typeof args[0] === 'object' && (args[0] as { message?: string } | null)?.message ? args[0] : null)

  if (err) {
    // A 4xx arrives as a numeric status or as the "API Error [4xx]" text, whether logged as a string or inside an Error.
    if (isClientError(statusOf(err)) || API_ERROR_4XX.test(String((err as { message?: unknown }).message))) return
    Sentry.captureException(err instanceof Error ? scrubbedError(err) : err)
    return
  }

  const text = args.map(stringify).join(' ')
  if (API_ERROR_4XX.test(text)) return
  Sentry.captureMessage(withoutQueryString(text))
}

export const logger = {
  /** Debug level: development only. */
  log: (...args: any[]) => {
    if (isDev()) console.log('[LOG]', ...args)
  },
  /** Debug level: development only. */
  info: (...args: any[]) => {
    if (isDev()) console.info('[INFO]', ...args)
  },
  warn: (...args: any[]) => {
    console.warn('[WARN]', ...args)
  },
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args)
    reportToSentry(args)
  },
}
