// FILE: src/store/index.js
import { configureStore } from '@reduxjs/toolkit'
import authReducer from './authSlice'
import examReducer from './examSlice'
import notificationReducer from './notificationSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    exam: examReducer,
    notifications: notificationReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore non-serializable values in exam timer (Date objects)
        ignoredPaths: ['exam.startedAt'],
      },
    }),
})

export default store