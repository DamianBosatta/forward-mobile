import * as FileSystem from 'expo-file-system/legacy';
import * as Sentry from '@sentry/react-native';

/**
 * Forward ERP – Centralized File Logger (SDK 54+ Optimized)
 * Captures system events, API requests, and errors into a persistent .log file.
 * Uses the legacy API from expo-file-system/legacy as recommended to avoid deprecation warnings.
 */

const LOG_FILE_PATH = `${FileSystem.documentDirectory}forward_app.log`;
const isDev = __DEV__;

// Basic lock/queue mechanism to prevent race conditions during file writes
let isWriting = false;
const writeQueue: string[] = [];

/**
 * Processes the log queue sequentially.
 */
const processQueue = async () => {
  if (isWriting || writeQueue.length === 0) return;
  
  isWriting = true;
  const entry = writeQueue.shift();
  
  if (entry) {
    try {
      // Append string to file using legacy API
      await FileSystem.writeAsStringAsync(LOG_FILE_PATH, entry, {
        append: true,
        encoding: FileSystem.EncodingType?.UTF8 || 'utf8',
      } as any);
    } catch (err) {
      console.warn('LOGGER_ERROR: Failed to write to log file:', err);
    }
  }
  
  isWriting = false;
  // Trigger next item in queue
  if (writeQueue.length > 0) {
    processQueue();
  }
};

/**
 * Appends a message to the local log file with a timestamp.
 */
const appendToLogFile = (level: string, ...args: any[]) => {
  try {
    const timestamp = new Date().toISOString();
    const message = args
      .map(arg => {
        try {
          return typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg);
        } catch (e) {
          return '[Unserializable Object]';
        }
      })
      .join(' ');
    
    const logEntry = `[${timestamp}] [${level}] ${message}\n`;
    
    // Add to queue and trigger processing
    writeQueue.push(logEntry);
    processQueue();
  } catch (err) {
    console.error('Logger encountered an internal error:', err);
  }
};

export const logger = {
  log: (...args: any[]) => {
    if (isDev) console.log('[LOG]', ...args);
    appendToLogFile('LOG', ...args);
  },
  warn: (...args: any[]) => {
    if (isDev) console.warn('[WARN]', ...args);
    appendToLogFile('WARN', ...args);
  },

  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
    appendToLogFile('ERROR', ...args);
    
    // Si el último argumento es un error o el primero, mandarlo a Sentry
    const err = args.find(a => a instanceof Error) || (typeof args[0] === 'object' && args[0]?.message ? args[0] : null);
    if (err) {
        Sentry.captureException(err);
    } else {
        Sentry.captureMessage(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
    }
  },
  info: (...args: any[]) => {
    if (isDev) console.info('[INFO]', ...args);
    appendToLogFile('INFO', ...args);
  },
  
  getLogFileUri: () => LOG_FILE_PATH,
  
  readLogs: async () => {
    try {
      const info = await FileSystem.getInfoAsync(LOG_FILE_PATH);
      if (info.exists) {
        return await FileSystem.readAsStringAsync(LOG_FILE_PATH);
      }
      return 'Log file is empty or does not exist.';
    } catch (err) {
      return `Error reading logs: ${err}`;
    }
  },
  
  clearLogs: async () => {
    try {
      await FileSystem.writeAsStringAsync(LOG_FILE_PATH, '');
      console.log('Logs cleared.');
    } catch (err) {
      console.error('Failed to clear logs:', err);
    }
  }
};

