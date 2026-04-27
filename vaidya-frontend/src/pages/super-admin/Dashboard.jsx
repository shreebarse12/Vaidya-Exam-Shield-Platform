import { useEffect, useState } from 'react'
import { adminApi } from '@/api/analyticsApi'
import { StatCard, Spinner, PageHeader, Badge } from '@/components/shared/UI'
import DataTable from '@/components/shared/DataTable'
import { Building2, Users, GraduationCap, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AdminDashboard() {
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.dashboard().then((r) => setStats(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  const plans = stats?.subscriptions_by_plan || {}

  return (
    <div className="space-y-6">
      <PageHeader title="Super Admin Dashboard" subtitle="Platform-wide overview" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Active Institutes" value={stats?.total_active_institutes ?? 0} icon={Building2}      color="blue" />
        <StatCard label="Total Students"    value={stats?.total_students ?? 0}          icon={GraduationCap}  color="green" />
        <StatCard label="Total Faculty"     value={stats?.total_faculty ?? 0}           icon={Users}          color="purple" />
      </div>

      {Object.keys(plans).length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-slate-900 mb-4">Active Subscriptions by Plan</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.entries(plans).map(([plan, count]) => (
              <div key={plan} className="p-4 bg-slate-50 rounded-xl text-center">
                <p className="text-2xl font-bold text-slate-900">{count}</p>
                <p className="text-xs text-slate-500 mt-1">{plan}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}