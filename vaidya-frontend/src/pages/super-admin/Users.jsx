import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '@/api/analyticsApi'
import { PageHeader, Badge, Spinner } from '@/components/shared/UI'
import DataTable from '@/components/shared/DataTable'
import { format } from 'date-fns'

const ROLE_COLORS = {
  super_admin:     'red',
  institute_admin: 'purple',
  faculty:         'blue',
  student:         'green',
}

export default function AdminUsers() {
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState('')

  const fetch = useCallback(() => {
    setLoading(true)
    adminApi.listUsers({ role: roleFilter || undefined, page_size: 100 })
      .then((r) => setUsers(r.data))
      .finally(() => setLoading(false))
  }, [roleFilter])

  useEffect(() => { fetch() }, [fetch])

  const columns = [
    {
      key: 'email', label: 'Email',
      render: (v, row) => (
        <div>
          <p className="font-medium text-slate-800 text-sm">{v}</p>
          <p className="text-xs text-slate-400">{row.full_name || '—'}</p>
        </div>
      ),
    },
    {
      key: 'role', label: 'Role',
      render: (v) => <Badge color={ROLE_COLORS[v] || 'gray'}>{v?.replace('_', ' ')}</Badge>,
    },
    {
      key: 'tenant_id', label: 'Tenant',
      render: (v) => v ? v.slice(0, 8) + '...' : <span className="text-slate-400">—</span>,
    },
    {
      key: 'is_active', label: 'Active',
      render: (v) => <Badge color={v ? 'green' : 'red'}>{v ? 'Yes' : 'No'}</Badge>,
    },
    {
      key: 'last_login', label: 'Last Login',
      render: (v) => v ? format(new Date(v), 'dd MMM yyyy') : <span className="text-slate-400">Never</span>,
    },
    {
      key: 'created_at', label: 'Joined',
      render: (v) => v ? format(new Date(v), 'dd MMM yyyy') : '—',
    },
  ]

  const roles = ['', 'super_admin', 'institute_admin', 'faculty', 'student']

  return (
    <div className="space-y-6">
      <PageHeader
        title={`All Users (${users.length})`}
        subtitle="Every registered user across the platform"
      />

      {/* Role filter tabs */}
      <div className="card flex flex-wrap gap-2">
        {roles.map((r) => (
          <button
            key={r}
            onClick={() => setRoleFilter(r)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              roleFilter === r
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {r === '' ? 'All Roles' : r.replace('_', ' ')}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={users}
        loading={loading}
        searchable
        emptyMessage="No users found."
      />
    </div>
  )
}