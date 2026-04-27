import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { selectUser } from '@/store/authSlice'
import { analyticsApi } from '@/api/analyticsApi'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { Spinner, PageHeader } from '@/components/shared/UI'
import { TrendingUp, TrendingDown } from 'lucide-react'

export default function StudentAnalytics() {
  const user   = useSelector(selectUser)
  const [report, setReport]       = useState(null)
  const [weakTopics, setWeakTopics] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    Promise.all([
      analyticsApi.studentReport(user.id),
      analyticsApi.weakTopics(user.id),
    ]).then(([r, w]) => {
      setReport(r.data)
      setWeakTopics(w.data.weak_topics || [])
    }).finally(() => setLoading(false))
  }, [user.id])

  if (loading) return <Spinner />

  const trendData = report?.score_trend?.map((t) => ({
    date: t.date,
    score: parseFloat(t.percentage?.toFixed(1)),
  })) || []

  return (
    <div className="space-y-6">
      <PageHeader title="My Analytics" subtitle="Your performance across all exams" />

      {/* Score trend chart */}
      <div className="card">
        <h2 className="font-semibold text-slate-900 mb-4">Score Trend</h2>
        {trendData.length > 1 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-slate-400 py-8 text-sm">Complete more exams to see your trend.</p>
        )}
      </div>

      {/* Weak topics */}
      <div className="card">
        <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-red-500" /> Topics to Improve
        </h2>
        {weakTopics.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">No weak topics identified yet.</p>
        ) : (
          <div className="space-y-4">
            {weakTopics.map((t, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">{t.subject} — {t.topic}</span>
                    <span className="text-red-500 font-semibold">{t.accuracy}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${t.accuracy}%` }} />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{t.total_questions_attempted} questions attempted</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}