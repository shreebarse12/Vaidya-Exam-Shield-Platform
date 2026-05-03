// FILE: src/store/notificationSlice.js
import { createSlice } from '@reduxjs/toolkit'

let nextId = 1

const notificationSlice = createSlice({
  name: 'notifications',
  initialState: {
    items: [],
    unreadCount: 0,
  },
  reducers: {
    addNotification(state, action) {
      const { title, message, icon = '🔔', type = 'info' } = action.payload
      state.items.unshift({
        id: nextId++,
        title,
        message,
        icon,
        type,
        read: false,
        timestamp: new Date().toISOString(),
      })
      state.unreadCount += 1
      // Keep max 50 notifications
      if (state.items.length > 50) state.items.pop()
    },
    markAsRead(state, action) {
      const item = state.items.find((n) => n.id === action.payload)
      if (item && !item.read) {
        item.read = true
        state.unreadCount = Math.max(0, state.unreadCount - 1)
      }
    },
    markAllAsRead(state) {
      state.items.forEach((n) => { n.read = true })
      state.unreadCount = 0
    },
    clearAll(state) {
      state.items = []
      state.unreadCount = 0
    },
  },
})

export const { addNotification, markAsRead, markAllAsRead, clearAll } = notificationSlice.actions

export const selectNotifications = (s) => s.notifications.items
export const selectUnreadCount   = (s) => s.notifications.unreadCount

export default notificationSlice.reducer
