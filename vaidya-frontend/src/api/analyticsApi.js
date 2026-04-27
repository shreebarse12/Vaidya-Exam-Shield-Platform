import api from './axiosClient'

export const analyticsApi = {
  studentReport: (studentId, params) => api.get(`/api/v1/analytics/student/${studentId}`, { params }),
  weakTopics:    (studentId) => api.get(`/api/v1/analytics/student/${studentId}/weak-topics`),
  ranking:       (examId, params) => api.get(`/api/v1/analytics/ranking/${examId}`, { params }),
  institute:     () => api.get('/api/v1/analytics/institute'),
}

export const adminApi = {
  dashboard:          () => api.get('/api/v1/admin/dashboard'),
  listTenants:        (params) => api.get('/api/v1/admin/tenants', { params }),
  getTenant:          (id) => api.get(`/api/v1/admin/tenants/${id}`),
  updateTenantStatus: (id, status) => api.patch(`/api/v1/admin/tenants/${id}/status`, null, { params: { status } }),
  approveTenant:      (id) => api.post(`/api/v1/admin/tenants/${id}/approve`),
  listUsers:          (params) => api.get('/api/v1/admin/users', { params }),
}

export const subscriptionApi = {
  listPlans:    () => api.get('/api/v1/subscriptions/plans'),
  createOrder:  (planId) => api.post('/api/v1/subscriptions/create-order', null, { params: { plan_id: planId } }),
}