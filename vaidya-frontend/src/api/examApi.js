import api from './axiosClient'

export const examApi = {
  // Faculty
  create:      (data) => api.post('/api/v1/exams', data),
  list:        (params) => api.get('/api/v1/exams', { params }),
  getById:     (id)   => api.get(`/api/v1/exams/${id}`),
  publish:     (id)   => api.post(`/api/v1/exams/${id}/publish`),
  publishRanks:(id)   => api.post(`/api/v1/exams/${id}/publish-ranks`),
  unpublish:   (id)   => api.post(`/api/v1/exams/${id}/unpublish`),
  update:      (id, data) => api.patch(`/api/v1/exams/${id}`, data),

  // Student
  start:       (id)   => api.post(`/api/v1/exams/${id}/start`),
  saveAnswers: (data) => api.post('/api/v1/exams/save-answers', data),
  submit:      (data) => api.post('/api/v1/exams/submit', data),
  getTimer:    (attemptId) => api.get(`/api/v1/exams/timer/${attemptId}`),
}
