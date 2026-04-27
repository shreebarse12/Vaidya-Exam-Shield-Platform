import { useEffect, useState } from 'react'
import { analyticsApi } from '@/api/analyticsApi'
import { PageHeader, Spinner } from '@/components/shared/UI'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function FacultyAnalytics() {
  const [data, setData]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    analyticsApi.institute()
      .then((r) => setData(r.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  return (
    <div className="space-y-6">
      <PageHeader title="Institute Analytics" subtitle="Performance summary for all students" />
      <div className="card">
        <h2 className="font-semibold text-slate-900 mb-2">Overview</h2>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="p-4 bg-blue-50 rounded-xl text-center">
            <p className="text-2xl font-bold text-blue-700">{data?.total_exam_attempts ?? 0}</p>
            <p className="text-sm text-blue-500">Total Attempts</p>
          </div>
          <div className="p-4 bg-green-50 rounded-xl text-center">
            <p className="text-2xl font-bold text-green-700">{data?.average_score_percentage ?? 0}%</p>
            <p className="text-sm text-green-500">Average Score</p>
          </div>
        </div>
      </div>
    </div>
  )
}