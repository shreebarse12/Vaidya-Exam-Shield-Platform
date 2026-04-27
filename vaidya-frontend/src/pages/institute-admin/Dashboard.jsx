import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { GraduationCap, UserCheck, Layers, Trophy, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

import { instituteApi } from '@/api/instituteApi'
import { examApi } from '@/api/examApi'
import { analyticsApi } from '@/api/analyticsApi'
import { StatCard, Spinner, PageHeader, Badge, Modal } from '@/components/shared/UI'

function RankingModal({ open, onClose, exam, rankingData, loading }) {
  return (
    <Modal open={open} onClose={onClose} title={exam ? `${exam.name} Ranking` : 'Exam Ranking'} size="xl">
      {loading ? (
        <div className="py-10 flex justify-center">
          <Spinner />
        </div>
      ) : !rankingData ? (
        <p className="text-sm text-slate-500">Select an exam to view rankings.</p>
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
              <thead className="border-b border-slate-200 bg-slate-50">
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

export default function InstituteDashboard() {
  const [stats, setStats] = useState(null)
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [rankingOpen, setRankingOpen] = useState(false)
  const [selectedExam, setSelectedExam] = useState(null)
  const [rankingData, setRankingData] = useState(null)
  const [rankingLoading, setRankingLoading] = useState(false)
  const [publishingRankExamId, setPublishingRankExamId] = useState(null)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, examsRes] = await Promise.all([
        instituteApi.dashboard(),
        examApi.list(),
      ])
      setStats(statsRes.data)
      setExams(examsRes.data || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

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

  async function handlePublishRanks(exam) {
    setPublishingRankExamId(exam.id)
    try {
      await examApi.publishRanks(exam.id)
      toast.success(`Ranks for "${exam.name}" are now published`)
      await loadDashboard()
      if (selectedExam?.id === exam.id) {
        await handleViewRanking(exam)
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not publish ranks')
    } finally {
      setPublishingRankExamId(null)
    }
  }

  function canPublishRanks(exam) {
    if (exam.status !== 'published' && exam.status !== 'completed') return false
    if (exam.config?.rank_published) return false
    if (!exam.end_time) return true
    return new Date(exam.end_time) <= new Date()
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-6">
      <PageHeader title="Institute Dashboard" subtitle="Overview of your institute" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Students" value={stats?.total_students ?? 0} icon={GraduationCap} color="blue" />
        <StatCard label="Faculty Members" value={stats?.total_faculty ?? 0} icon={UserCheck} color="green" />
        <StatCard label="Batches" value={stats?.total_batches ?? 0} icon={Layers} color="purple" />
      </div>

      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Exam Rankings</h2>
            <p className="text-sm text-slate-500">Review internal leaderboard data and publish ranks after the exam window ends.</p>
          </div>
          <Badge color="blue">{exams.length} exams</Badge>
        </div>

        {exams.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="font-medium text-slate-500">No exams available yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Exam</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">End Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Ranking</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {exams.map((exam) => (
                  <tr key={exam.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{exam.name}</p>
                      <p className="text-xs text-slate-500">{exam.question_count || 0} questions</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={exam.status === 'published' ? 'green' : exam.status === 'completed' ? 'purple' : 'gray'}>
                        {exam.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {exam.end_time ? format(new Date(exam.end_time), 'dd MMM yyyy, hh:mm a') : 'No end time'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={exam.config?.rank_published ? 'green' : 'gray'}>
                        {exam.config?.rank_published ? 'Published' : 'Pending'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
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
