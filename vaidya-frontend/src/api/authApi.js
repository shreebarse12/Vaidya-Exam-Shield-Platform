import api from './axiosClient'

export const authApi = {
  register:        (data) => api.post('/api/v1/auth/register', data),
  verifyEmail:     (data) => api.post('/api/v1/auth/verify-email', data),
  login:           (data) => api.post('/api/v1/auth/login', data),
  logout:          ()     => api.post('/api/v1/auth/logout'),
  refreshToken:    (data) => api.post('/api/v1/auth/refresh', data),
  forgotPassword:  (data) => api.post('/api/v1/auth/forgot-password', data),
  resetPassword:   (data) => api.post('/api/v1/auth/reset-password', data),
  changePassword:  (data) => api.post('/api/v1/auth/change-password', data),
  getMe:           ()     => api.get('/api/v1/auth/me'),
}