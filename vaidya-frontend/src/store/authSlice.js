import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { authApi } from '@/api/authApi'

// ── Async thunks ───────────────────────────────────────────────────────────────

export const loginThunk = createAsyncThunk('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const res = await authApi.login(credentials)
    return res.data
  } catch (err) {
    return rejectWithValue(err.response?.data?.detail || 'Login failed')
  }
})

export const registerThunk = createAsyncThunk('auth/register', async (data, { rejectWithValue }) => {
  try {
    const res = await authApi.register(data)
    return res.data
  } catch (err) {
    return rejectWithValue(err.response?.data?.detail || 'Registration failed')
  }
})

// ── Slice ──────────────────────────────────────────────────────────────────────

const storedUser = localStorage.getItem('user')

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user:         storedUser ? JSON.parse(storedUser) : null,
    accessToken:  localStorage.getItem('access_token') || null,
    refreshToken: localStorage.getItem('refresh_token') || null,
    loading:      false,
    error:        null,
  },
  reducers: {
    logout(state) {
      state.user         = null
      state.accessToken  = null
      state.refreshToken = null
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user')
    },
    clearError(state) {
      state.error = null
    },
    setUser(state, action) {
      state.user = action.payload
      localStorage.setItem('user', JSON.stringify(action.payload))
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginThunk.pending, (state) => {
        state.loading = true
        state.error   = null
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.loading      = false
        state.accessToken  = action.payload.access_token
        state.refreshToken = action.payload.refresh_token
        state.user         = action.payload.user
        localStorage.setItem('access_token', action.payload.access_token)
        localStorage.setItem('refresh_token', action.payload.refresh_token)
        localStorage.setItem('user', JSON.stringify(action.payload.user))
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.loading = false
        state.error   = action.payload
      })
      // Register
      .addCase(registerThunk.pending,   (state) => { state.loading = true; state.error = null })
      .addCase(registerThunk.fulfilled, (state) => { state.loading = false })
      .addCase(registerThunk.rejected,  (state, action) => { state.loading = false; state.error = action.payload })
  },
})

export const { logout, clearError, setUser } = authSlice.actions

// Selectors
export const selectUser        = (state) => state.auth.user
export const selectRole        = (state) => state.auth.user?.role
export const selectTenantId    = (state) => state.auth.user?.tenant_id
export const selectAuthLoading = (state) => state.auth.loading
export const selectAuthError   = (state) => state.auth.error
export const selectIsLoggedIn  = (state) => !!state.auth.user

export default authSlice.reducer