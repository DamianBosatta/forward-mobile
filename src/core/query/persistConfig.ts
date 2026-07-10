import { storage } from '../utils/storage'

/**
 * MMKV Persister for TanStack Query
 * Uses synchronous storage to prevent UI flickers and improve performance.
 */
export const mmkvPersister = {
  persistClient: async (client: any) => {
    storage.set('REACT_QUERY_OFFLINE_CACHE', JSON.stringify(client))
  },
  restoreClient: async () => {
    const cache = storage.getString('REACT_QUERY_OFFLINE_CACHE')
    if (!cache) return undefined
    return JSON.parse(cache)
  },
  removeClient: async () => {
    storage.remove('REACT_QUERY_OFFLINE_CACHE')
  },
}

// Exporting as default or named as needed by _layout.tsx
export const asyncStoragePersister = mmkvPersister // Maintaining name compatibility or updating layout
