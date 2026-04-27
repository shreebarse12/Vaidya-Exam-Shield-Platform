import { configureStore } from '@reduxjs/toolkit'
import authReducer from './authSlice'
import examReducer from './examSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    exam: examReducer,
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