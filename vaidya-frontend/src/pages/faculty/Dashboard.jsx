import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { BookOpen, FileText, Plus, Send, Trophy } from 'lucide-react'
import toast from 'react-hot-toast'

import { questionApi } from '@/api/questionApi'
import { examApi } from '@/api/examApi'
import { analyticsApi } from '@/api/analyticsApi'
import { StatCard, Spinner, PageHeader, Badge, Modal } from '@/components/shared/UI'
import { DashboardCardSkeleton, TableRowSkeleton } from '@/components/shared/Skeletons'

function RankingModal({ open, onClose, exam, rankingData, loading }) {
  return (
    <Modal open={open} onClose={onClose} title={exam ? `${exam.name} Ranking` : 'Exam Ranking'} size="xl">
      {loading ? (
        <div className="py-10 flex justify-center">
          <Spinner />
        </div>
      ) : !rankingData ? (
        <p className="text-sm text-slate-500">Select an exam to view the leaderboard.</p>
      ) : rankingData.total_participants === 0 ? (
        <p className="text-sm text-slate-500">No submitted attempts found for this exam yet.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{rankingData.exam_name}</p>
              <p className="text-xs text-slate-500">{rankingData.total_participants} participants</p>
            </div>
            <Badge color={rankingData.rank_published ? 'green' : 'yellow'}>
              {rankingData.rank_published ? 'Published' : 'Internal Preview'}
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Student</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Score</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Percentage</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rankingData.leaderboard.map((entry) => (
                  <tr key={entry.attempt_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">#{entry.rank ?? '-'}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{entry.student_name}</p>
                      <p className="text-xs text-slate-500">{entry.student_email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {entry.score}/{entry.max_score}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{entry.score_percentage}%</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {entry.submitted_at ? format(new Date(entry.submitted_at), 'dd MMM yyyy, hh:mm a') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default function FacultyDashboard() {
  const navigate = useNavigate()
  const [qStats, setQStats] = useState({ total: 0, published: 0, draft: 0 })
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [rankingOpen, setRankingOpen] = useState(false)
  const [selectedExam, setSelectedExam] = useState(null)
  const [rankingData, setRankingData] = useState(null)
  const [rankingLoading, setRankingLoading] = useState(false)
  const [publishingRankExamId, setPublishingRankExamId] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [allQ, pubQ, examsRes] = await Promise.all([
        questionApi.list({ page: 1, page_size: 1 }),
        questionApi.list({ page: 1, page_size: 1, status: 'published' }),
        examApi.list(),
      ])
      setQStats({
        total: allQ.data.total || 0,
        published: pubQ.data.total || 0,
        draft: (allQ.data.total || 0) - (pubQ.data.total || 0),
      })
      setExams(examsRes.data || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  async function handlePublish(examId, examName) {
    try {
      await examApi.publish(examId)
      toast.success(`"${examName}" is now live for students`)
      fetchAll()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not publish exam')
    }
  }

  async function handlePublishRanks(exam) {
    setPublishingRankExamId(exam.id)
    try {
      await examApi.publishRanks(exam.id)
      toast.success(`Ranks for "${exam.name}" are now published`)
      await fetchAll()
      if (selectedExam?.id === exam.id) {
        await handleViewRanking(exam)
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not publish ranks')
    } finally {
      setPublishingRankExamId(null)
    }
  }

  async function handleViewRanking(exam) {
    setSelectedExam(exam)
    setRankingOpen(true)
    setRankingLoading(true)
    try {
      const res = await analyticsApi.ranking(exam.id)
      setRankingData(res.data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not load ranking')
      setRankingData(null)
    } finally {
      setRankingLoading(false)
    }
  }

  function canPublishRanks(exam) {
    if (exam.status !== 'published' && exam.status !== 'completed') return false
    if (exam.config?.rank_published) return false
    if (!exam.end_time) return true
    return new Date(exam.end_time) <= new Date()
  }

  if (loading) return (
    <div className="space-y-6">
      <DashboardCardSkeleton count={3} />
      <TableRowSkeleton rows={4} cols={7} />
    </div>
  )

  const statusColor = { published: 'green', draft: 'gray', ongoing: 'blue', completed: 'purple' }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Faculty Dashboard"
        actions={
          <>
            <button onClick={() => navigate('/faculty/questions')} className="btn-secondary">
              <BookOpen className="w-4 h-4" /> Question Bank
            </button>
            <button onClick={() => navigate('/faculty/exams/create')} className="btn-primary">
              <Plus className="w-4 h-4" /> Create Exam
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Questions" value={qStats.total} icon={BookOpen} color="blue" sub={`${qStats.published} published`} />
        <StatCard label="Draft Questions" value={qStats.draft} icon={BookOpen} color="orange" sub="Need to be published" />
        <StatCard label="Total Exams" value={exams.length} icon={FileText} color="green" />
      </div>

      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 dark:text-white">Your Exams</h2>
          <button onClick={() => navigate('/faculty/exams/create')} className="btn-primary py-1.5 text-sm">
            <Plus className="w-3.5 h-3.5" /> New Exam
          </button>
        </div>

        {exams.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-gray-600" />
            <p className="font-medium text-slate-500 dark:text-gray-400">No exams yet</p>
            <p className="mt-1 mb-4 text-sm text-slate-400 dark:text-gray-500">Create your first exam to get started</p>
            <button onClick={() => navigate('/faculty/exams/create')} className="btn-primary">
              <Plus className="w-4 h-4" /> Create Exam
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Exam Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Duration</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Questions</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Ranking</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {exams.map((exam) => (
                  <tr key={exam.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{exam.name}</p>
                      {exam.description ? (
                        <p className="mt-0.5 max-w-xs truncate text-xs text-slate-400">{exam.description}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{Math.floor(exam.duration_seconds / 60)} min</td>
                    <td className="px-4 py-3 text-slate-600">{exam.question_count || 0}</td>
                    <td className="px-4 py-3">
                      <Badge color={statusColor[exam.status] || 'gray'}>{exam.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {exam.created_at ? format(new Date(exam.created_at), 'dd MMM yyyy') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={exam.config?.rank_published ? 'green' : 'gray'}>
                        {exam.config?.rank_published ? 'Published' : 'Pending'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {exam.status === 'draft' ? (
                          <button
                            onClick={() => handlePublish(exam.id, exam.name)}
                            className="flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-green-700"
                            title="Publish and make the exam available to students"
                          >
                            <Send className="h-3 w-3" /> Publish
                          </button>
                        ) : null}

                        <button
                          onClick={() => handleViewRanking(exam)}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
                        >
                          <Trophy className="h-3 w-3" /> View Ranking
                        </button>

                        {canPublishRanks(exam) ? (
                          <button
                            onClick={() => handlePublishRanks(exam)}
                            disabled={publishingRankExamId === exam.id}
                            className="rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {publishingRankExamId === exam.id ? 'Publishing...' : 'Publish Ranks'}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {qStats.draft > 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="mt-0.5 text-amber-500">!</div>
          <div>
            <p className="text-sm font-medium text-amber-800">
              You have {qStats.draft} draft question{qStats.draft > 1 ? 's' : ''}
            </p>
            <p className="mt-0.5 text-xs text-amber-700">
              Draft questions are not available while creating exams. Move them to published when they are ready.
            </p>
            <button
              onClick={() => navigate('/faculty/questions')}
              className="mt-1 text-xs text-amber-700 underline hover:text-amber-900"
            >
              Go to Question Bank
            </button>
          </div>
        </div>
      ) : null}

      <RankingModal
        open={rankingOpen}
        onClose={() => setRankingOpen(false)}
        exam={selectedExam}
        rankingData={rankingData}
        loading={rankingLoading}
      />
    </div>
  )
}
