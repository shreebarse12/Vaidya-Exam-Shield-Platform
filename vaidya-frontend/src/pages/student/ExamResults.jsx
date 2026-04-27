import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectExamResult } from '@/store/examSlice'
import { analyticsApi } from '@/api/analyticsApi'
import { Trophy, Target, Clock, Users, ChevronDown, ChevronUp, CheckCircle, XCircle } from 'lucide-react'
import { Spinner } from '@/components/shared/UI'
import clsx from 'clsx'

export default function ExamResults() {
  const { attemptId } = useParams()
  const navigate = useNavigate()
  // Try Redux first (fresh submit), fall back to API
  const reduxResult = useSelector(selectExamResult)
  const [result, setResult] = useState(reduxResult)
  const [ranking, setRanking] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [loading, setLoading] = useState(!reduxResult)

  useEffect(() => {
    if (!result) {
      // Fetch result from API (when visiting results page directly)
      // For now, redirect to dashboard if no result in state
      navigate('/student/dashboard')
      return
    }
    // Fetch ranking
    analyticsApi.ranking(result.exam_id, { student_id: result.attempt_id })
      .then((r) => setRanking(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [result])

  if (loading || !result) return <Spinner />

  const passed = result.passing_percentage
    ? result.percentage >= result.passing_percentage
    : null

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Score Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <div className={clsx(
            'w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4',
            passed === true  ? 'bg-green-100'  :
            passed === false ? 'bg-red-100'    :
                               'bg-blue-100'
          )}>
            <Trophy className={clsx(
              'w-10 h-10',
              passed === true  ? 'text-green-500'  :
              passed === false ? 'text-red-500'    :
                                 'text-blue-500'
            )} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-1">
            {result.percentage?.toFixed(1)}%
          </h1>
          <p className="text-slate-500 text-sm mb-1">{result.exam_name}</p>
          {passed !== null && (
            <span className={clsx('badge text-sm px-3 py-1',
              passed ? 'badge-green' : 'badge-red'
            )}>
              {passed ? 'Passed' : 'Failed'}
            </span>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: Target,  label: 'Score',      value: `${result.score?.toFixed(0)} / ${result.max_score}`, color: 'text-blue-600' },
            { icon: Trophy,  label: 'Rank',        value: result.rank ? `#${result.rank}` : '—',                color: 'text-purple-600' },
            { icon: Users,   label: 'Percentile',  value: result.percentile ? `${result.percentile?.toFixed(1)}%ile` : '—', color: 'text-green-600' },
            { icon: Clock,   label: 'Time Taken',  value: result.time_taken_seconds ? `${Math.floor(result.time_taken_seconds / 60)}m` : '—', color: 'text-orange-600' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="card text-center py-4">
              <Icon className={clsx('w-6 h-6 mx-auto mb-1', color)} />
              <p className="text-xl font-bold text-slate-900">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>

        {/* Section-wise breakdown */}
        {result.section_scores && Object.keys(result.section_scores).length > 0 && (
          <div className="card">
            <h2 className="font-semibold text-slate-900 mb-4">Section-wise Breakdown</h2>
            <div className="space-y-3">
              {Object.entries(result.section_scores).map(([section, data]) => {
                const pct = data.max_score > 0 ? (data.score / data.max_score) * 100 : 0
                return (
                  <div key={section}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-slate-700">{section}</span>
                      <span className={pct >= 60 ? 'text-green-600' : 'text-red-500'}>
                        {data.score?.toFixed(0)} / {data.max_score} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={clsx('h-full rounded-full', pct >= 60 ? 'bg-green-500' : 'bg-red-400')}
                        style={{ width: `${Math.max(0, pct)}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      ✓ {data.correct}  ✗ {data.wrong}  — {data.unattempted} unattempted
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Question-wise review */}
        {result.questions && result.questions.length > 0 && (
          <div className="card">
            <h2 className="font-semibold text-slate-900 mb-4">Question Review</h2>
            <div className="space-y-2">
              {result.questions.map((q, i) => (
                <div key={q.question_id} className="border border-slate-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpanded((p) => ({ ...p, [i]: !p[i] }))}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      {q.is_correct
                        ? <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                        : <XCircle    className="w-5 h-5 text-red-500 flex-shrink-0" />
                      }
                      <span className="text-sm text-slate-700 line-clamp-1"
                        dangerouslySetInnerHTML={{ __html: `Q${i + 1}: ${q.question_text}` }}
                      />
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={clsx('text-sm font-semibold',
                        q.marks_awarded > 0 ? 'text-green-600' :
                        q.marks_awarded < 0 ? 'text-red-500'   : 'text-slate-400'
                      )}>
                        {q.marks_awarded > 0 ? '+' : ''}{q.marks_awarded}
                      </span>
                      {expanded[i] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </button>

                  {expanded[i] && (
                    <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50">
                      <div className="space-y-2 mt-3">
                        {q.options?.map((opt) => (
                          <div key={opt.key} className={clsx(
                            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                            opt.key === q.correct_answer ? 'bg-green-100 text-green-800 font-medium' :
                            opt.key === q.student_answer && !q.is_correct ? 'bg-red-100 text-red-700' :
                            'text-slate-600'
                          )}>
                            <span className="font-bold w-5">{opt.key}</span>
                            <span dangerouslySetInnerHTML={{ __html: opt.text }} />
                            {opt.key === q.correct_answer && <span className="ml-auto text-green-600 text-xs">✓ Correct</span>}
                            {opt.key === q.student_answer && !q.is_correct && <span className="ml-auto text-red-500 text-xs">Your answer</span>}
                          </div>
                        ))}
                      </div>
                      {q.explanation && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                          <p className="text-xs font-semibold text-blue-800 mb-1">Explanation</p>
                          <p className="text-sm text-blue-700"
                            dangerouslySetInnerHTML={{ __html: q.explanation }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => navigate('/student/dashboard')} className="btn-secondary flex-1 justify-center">
            Back to Dashboard
          </button>
          <button
            onClick={() => navigate('/student/doubt-solver', {
              state: {
                analyzeAttemptId: result.attempt_id,
                examName: result.exam_name,
              },
            })}
            className="btn-secondary flex-1 justify-center"
          >
            Analyze Mistakes With AI
          </button>
          <button onClick={() => navigate('/student/analytics')} className="btn-primary flex-1 justify-center">
            View Full Analytics
          </button>
        </div>
      </div>
    </div>
  )
}
