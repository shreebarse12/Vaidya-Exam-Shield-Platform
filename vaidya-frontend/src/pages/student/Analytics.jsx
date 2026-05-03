// FILE: src/pages/student/Analytics.jsx
import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { selectUser } from '@/store/authSlice'
import { analyticsApi } from '@/api/analyticsApi'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  AreaChart, Area,
} from 'recharts'
import { PageHeader } from '@/components/shared/UI'
import { AnalyticsChartSkeleton, DashboardCardSkeleton } from '@/components/shared/Skeletons'
import { TrendingUp, TrendingDown, Target, Award } from 'lucide-react'

export default function StudentAnalytics() {
  const user    = useSelector(selectUser)
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

  if (loading) return (
    <div className="space-y-6">
      <DashboardCardSkeleton count={3} />
      <AnalyticsChartSkeleton />
    </div>
  )

  const trendData = report?.score_trend?.map((t) => ({
    date: t.date,
    score: parseFloat(t.percentage?.toFixed(1)),
  })) || []

  // Radar data for subject mastery
  const radarData = report?.subject_scores?.map((s) => ({
    subject: s.subject,
    score: s.accuracy || s.percentage || 0,
    fullMark: 100,
  })) || []

  return (
    <div className="space-y-6">
      <PageHeader title="My Analytics" subtitle="Your performance across all exams" />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
            <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-gray-400">Exams Taken</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{report?.total_exams ?? 0}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-gray-400">Average Score</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{report?.average_percentage ?? 0}%</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
            <Award className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-gray-400">Best Score</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{report?.best_score ?? 0}%</p>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Score trend chart — Area style */}
        <div className="card">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" /> Score Trend
          </h2>
          {trendData.length > 1 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-gray-700" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip />
                <Area type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#scoreGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-slate-400 dark:text-gray-500 py-16 text-sm">Complete more exams to see your trend.</p>
          )}
        </div>

        {/* Radar chart — Subject Mastery */}
        {radarData.length > 2 && (
          <div className="card">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-500" /> Subject Mastery
            </h2>
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Radar dataKey="score" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.25} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Weak topics */}
      <div className="card">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-red-500" /> Topics to Improve
        </h2>
        {weakTopics.length === 0 ? (
          <p className="text-slate-400 dark:text-gray-500 text-sm text-center py-8">No weak topics identified yet.</p>
        ) : (
          <div className="space-y-4">
            {weakTopics.map((t, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700 dark:text-gray-300">{t.subject} — {t.topic}</span>
                    <span className="text-red-500 dark:text-red-400 font-semibold">{t.accuracy}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${t.accuracy}%`,
                        background: `linear-gradient(90deg, #ef4444 0%, #f59e0b ${Math.min(t.accuracy * 2, 100)}%)`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">{t.total_questions_attempted} questions attempted</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}