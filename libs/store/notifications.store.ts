import { create } from 'zustand'

// ─────────────────────────────────────────────────────────────────────────────
// Notifications Store – Alertas en tiempo real (SignalR)
// ─────────────────────────────────────────────────────────────────────────────

export interface Notification {
  id: string
  type: 'stock-alert' | 'info' | 'warning' | 'error'
  title: string
  message: string
  timestamp: Date
  read: boolean
}

interface NotificationsState {
  notifications: Notification[]
  unreadCount: number

  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearAll: () => void
}

export const useNotificationsStore = create<NotificationsState>()((set) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (notification) => {
    const newNotif: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      read: false,
    }
    set((state) => ({
      notifications: [newNotif, ...state.notifications].slice(0, 50), // max 50
      unreadCount: state.unreadCount + 1,
    }))
  },

  markAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  clearAll: () => set({ notifications: [], unreadCount: 0 }),
}))
