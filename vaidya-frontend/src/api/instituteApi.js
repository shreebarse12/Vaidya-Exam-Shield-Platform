import api from './axiosClient'

export const instituteApi = {
  dashboard:        ()     => api.get('/api/v1/institute/dashboard'),
  // Students
  addStudent:       (data) => api.post('/api/v1/institute/students', data),
  listStudents:     ()     => api.get('/api/v1/institute/students'),
  deactivateStudent:(id)   => api.delete(`/api/v1/institute/students/${id}`),
  bulkImportStudents:(fd)  => api.post('/api/v1/institute/students/bulk-import', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  // Faculty
  addFaculty:       (data) => api.post('/api/v1/institute/faculty', data),
  listFaculty:      ()     => api.get('/api/v1/institute/faculty'),
  // Batches
  createBatch:      (data) => api.post('/api/v1/institute/batches', data),
  listBatches:      ()     => api.get('/api/v1/institute/batches'),
  listFlaggedAttempts: ()  => api.get('/api/v1/institute/proctoring/flagged-attempts'),
}
