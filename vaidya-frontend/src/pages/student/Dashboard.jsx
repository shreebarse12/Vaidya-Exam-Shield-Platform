import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { selectUser } from '@/store/authSlice'
import { examApi } from '@/api/examApi'
import { analyticsApi } from '@/api/analyticsApi'
import { useNavigate } from 'react-router-dom'
import { StatCard, Spinner, Badge } from '@/components/shared/UI'
import { DashboardCardSkeleton, TableRowSkeleton } from '@/components/shared/Skeletons'
import { Trophy, Target, Clock, BookOpen, Play, TrendingUp } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function StudentDashboard() {

  const user = useSelector(selectUser)
  const navigate = useNavigate()

  const [exams, setExams] = useState([])
  const [report, setReport] = useState(null)
  const [weakTopics, setWeakTopics] = useState([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(null)

  useEffect(() => {

    async function fetchAll() {

      try {

        const examsRes = await examApi.list({ status: 'published' })

        // Support multiple backend response formats
        const examList =
          examsRes?.data?.items ||
          examsRes?.data?.data ||
          examsRes?.data ||
          []

        setExams(Array.isArray(examList) ? examList : [])

        // Analytics (non blocking)
        Promise.all([
          analyticsApi.studentReport(user.id),
          analyticsApi.weakTopics(user.id),
        ])
          .then(([r, w]) => {
            setReport(r?.data || null)
            setWeakTopics(w?.data?.weak_topics || [])
          })
          .catch(() => { })

      } catch (err) {
        console.error(err)
        toast.error('Could not load dashboard')
      } finally {
        setLoading(false)
      }

    }

    if (user?.id) fetchAll()

  }, [user?.id])


  async function handleStartExam(examId) {

    try {
      setStarting(examId)

      // Navigate to exam interface
      navigate(`/exam/${examId}`)

    } catch (err) {
      toast.error('Unable to open exam')
      setStarting(null)
    }

  }


  if (loading) return (
    <div className="space-y-6">
      <DashboardCardSkeleton count={4} />
      <TableRowSkeleton rows={3} cols={4} />
    </div>
  )


  return (
    <div className="space-y-6">

      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome back, {user?.full_name?.split(' ')[0] || 'Student'} 👋
        </h1>

        <p className="text-slate-500 text-sm mt-1">
          {new Date().toLocaleDateString('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })}
        </p>
      </div>


      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        <StatCard
          label="Available Exams"
          value={exams.length}
          icon={BookOpen}
          color="blue"
          sub="Ready to attempt"
        />

        <StatCard
          label="Attempts Made"
          value={report?.total_attempts ?? 0}
          icon={Clock}
          color="purple"
        />

        <StatCard
          label="Average Score"
          value={report ? `${report.average_percentage?.toFixed(1)}%` : '—'}
          icon={Target}
          color="green"
        />

        <StatCard
          label="Best Score"
          value={report ? `${report.best_percentage?.toFixed(1)}%` : '—'}
          icon={Trophy}
          color="orange"
        />

      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Available Exams */}
        <div className="lg:col-span-2 card">

          <h2 className="font-semibold text-slate-900 mb-4">
            Available Exams
          </h2>

          {exams.length === 0 ? (

            <div className="text-center py-12">

              <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />

              <p className="font-medium text-slate-600">
                No exams available right now
              </p>

              <p className="text-sm text-slate-400 mt-1">
                Your institute admin will publish exams here when ready.
              </p>

            </div>

          ) : (

            <div className="space-y-3">

              {exams.map((exam) => {

                const isStarting = starting === exam.id
                const durationMin = Math.floor((exam.duration_seconds || 0) / 60)

                return (

                  <div
                    key={exam.id}
                    className="flex items-start sm:items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50/30 transition-colors gap-4"
                  >

                    <div className="flex-1 min-w-0">

                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-slate-900 text-sm">
                          {exam.name}
                        </p>

                        <Badge color="green">Live</Badge>
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">

                        <span>⏱ {durationMin} min</span>

                        <span>📝 {exam.question_count || 0} questions</span>

                        {exam.negative_marking > 0 && (
                          <span>⚠ -{exam.negative_marking} negative marking</span>
                        )}

                        {exam.max_attempts > 1 && (
                          <span>🔁 {exam.max_attempts} attempts allowed</span>
                        )}

                      </div>

                      {exam.description && (
                        <p className="text-xs text-slate-400 mt-1 truncate">
                          {exam.description}
                        </p>
                      )}

                    </div>


                    <button
                      onClick={() => handleStartExam(exam.id)}
                      disabled={isStarting}
                      className={clsx(
                        'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0',
                        isStarting
                          ? 'bg-slate-100 text-slate-400 cursor-wait'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      )}
                    >

                      {isStarting ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
                          Opening...
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          Start Exam
                        </>
                      )}

                    </button>

                  </div>

                )

              })}

            </div>

          )}

        </div>


        {/* Weak Topics */}
        <div className="card">

          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-orange-500" />
            <h2 className="font-semibold text-slate-900">
              Topics to Improve
            </h2>
          </div>

          {weakTopics.length === 0 ? (

            <div className="text-center py-8">
              <p className="text-sm text-slate-400">
                Attempt some exams to see AI-powered topic insights.
              </p>
            </div>

          ) : (

            <div className="space-y-4">

              {weakTopics.slice(0, 5).map((t, i) => (

                <div key={i}>

                  <div className="flex justify-between items-center text-xs mb-1">

                    <div>
                      <span className="font-medium text-slate-700">
                        {t.topic}
                      </span>

                      <span className="text-slate-400 ml-1">
                        ({t.subject})
                      </span>
                    </div>

                    <span className="font-semibold text-red-500">
                      {t.accuracy}%
                    </span>

                  </div>

                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">

                    <div
                      className="h-full bg-red-400 rounded-full"
                      style={{ width: `${t.accuracy}%` }}
                    />

                  </div>

                </div>

              ))}

            </div>

          )}

        </div>

      </div>

    </div>
  )
}