import api from './axiosClient'

export const questionApi = {
  create:       (data) => api.post('/api/v1/questions', data),
  list:         (params) => api.get('/api/v1/questions', { params }),
  getById:      (id)   => api.get(`/api/v1/questions/${id}`),
  update:       (id, data) => api.patch(`/api/v1/questions/${id}`, data),
  delete:       (id)   => api.delete(`/api/v1/questions/${id}`),
  bulkImport:   (formData) => api.post('/api/v1/questions/bulk-import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  downloadTemplate: () => api.get('/api/v1/questions/template', { responseType: 'blob' }),
}