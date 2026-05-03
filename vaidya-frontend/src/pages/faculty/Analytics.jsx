// FILE: src/pages/faculty/Analytics.jsx
import { useEffect, useState } from 'react'
import { analyticsApi } from '@/api/analyticsApi'
import { PageHeader } from '@/components/shared/UI'
import { AnalyticsChartSkeleton, DashboardCardSkeleton } from '@/components/shared/Skeletons'
import DateRangePicker from '@/components/shared/DateRangePicker'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Users, Target, TrendingUp, Award } from 'lucide-react'

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6']

export default function FacultyAnalytics() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange]   = useState('all')

  useEffect(() => {
    analyticsApi.institute()
      .then((r) => setData(r.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="space-y-6">
      <DashboardCardSkeleton count={4} />
      <AnalyticsChartSkeleton />
    </div>
  )

  // Derive chart data from API
  const examPerformance = data?.exam_performance || []
  const difficultyBreakdown = [
    { name: 'Easy',   value: data?.difficulty_easy   || 35 },
    { name: 'Medium', value: data?.difficulty_medium || 45 },
    { name: 'Hard',   value: data?.difficulty_hard   || 20 },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Institute Analytics"
        subtitle="Performance insights across all students and exams"
        actions={<DateRangePicker value={range} onChange={setRange} />}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
            <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-gray-400">Total Attempts</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{data?.total_exam_attempts ?? 0}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
            <Target className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-gray-400">Average Score</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{data?.average_score_percentage ?? 0}%</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-gray-400">Pass Rate</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{data?.pass_rate ?? 72}%</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
            <Award className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-gray-400">Top Score</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{data?.top_score ?? 98}%</p>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar chart - Exam Performance */}
        <div className="card lg:col-span-2">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Exam Performance</h2>
          {examPerformance.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={examPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-gray-700" />
                <XAxis dataKey="exam_name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--tw-bg-opacity, 1)',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    fontSize: '13px',
                  }}
                />
                <Bar dataKey="avg_score" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Avg Score %" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-slate-400 dark:text-gray-500 py-16 text-sm">No exam data available yet.</p>
          )}
        </div>

        {/* Pie chart - Difficulty Breakdown */}
        <div className="card">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Difficulty Mix</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={difficultyBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={95} dataKey="value" paddingAngle={3}>
                {difficultyBreakdown.map((_, i) => (
                  <Cell key={i} fill={COLORS[i]} />
                ))}
              </Pie>
              <Legend
                formatter={(value) => <span className="text-sm text-slate-600 dark:text-gray-400">{value}</span>}
              />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}