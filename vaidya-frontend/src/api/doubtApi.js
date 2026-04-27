import api from './axiosClient'

export const doubtApi = {
  ask: (data) => api.post('/api/v1/doubts/ask', data),
  analyzeLastExam: () => api.post('/api/v1/doubts/analyze-last-exam'),
  listStudentExams: () => api.get('/api/v1/doubts/student-exams'),
  analyzeAttempt: (attemptId) => api.get(`/api/v1/doubts/analyze-attempt/${attemptId}`),
}
