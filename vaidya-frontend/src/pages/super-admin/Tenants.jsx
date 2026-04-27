import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '@/api/analyticsApi'
import { PageHeader, Badge, Modal, Spinner } from '@/components/shared/UI'
import DataTable from '@/components/shared/DataTable'
import { CheckCircle, XCircle, Eye } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

export default function AdminTenants() {
  const [tenants,  setTenants]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [detail,   setDetail]   = useState(null)  // selected tenant for detail modal
  const [statusFilter, setStatusFilter] = useState('')

  const fetch = useCallback(() => {
    setLoading(true)
    adminApi.listTenants({ status: statusFilter || undefined })
      .then((r) => setTenants(r.data))
      .finally(() => setLoading(false))
  }, [statusFilter])

  useEffect(() => { fetch() }, [fetch])

  async function handleApprove(id) {
    try {
      await adminApi.approveTenant(id)
      toast.success('Institute approved and activated')
      fetch()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
  }

  async function handleSuspend(id) {
    if (!confirm('Suspend this institute? Their admin will lose access immediately.')) return
    try {
      await adminApi.updateTenantStatus(id, 'suspended')
      toast.success('Institute suspended')
      fetch()
    } catch { toast.error('Failed') }
  }

  async function handleActivate(id) {
    try {
      await adminApi.updateTenantStatus(id, 'active')
      toast.success('Institute re-activated')
      fetch()
    } catch { toast.error('Failed') }
  }

  const STATUS_COLOR = {
    active:    'green',
    pending:   'yellow',
    suspended: 'red',
    deleted:   'gray',
  }

  const columns = [
    { key: 'name',              label: 'Institute Name' },
    { key: 'contact_email',     label: 'Email',            render: (v) => v || '—' },
    { key: 'subscription_tier', label: 'Plan',             render: (v) => <Badge color="blue">{v}</Badge> },
    {
      key: 'status', label: 'Status',
      render: (v) => <Badge color={STATUS_COLOR[v] || 'gray'}>{v}</Badge>,
    },
    {
      key: 'created_at', label: 'Registered',
      render: (v) => v ? format(new Date(v), 'dd MMM yyyy') : '—',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Institutes (${tenants.length})`}
        subtitle="Manage all coaching institutes on the platform"
      />

      {/* Filter bar */}
      <div className="card flex gap-3">
        {['', 'pending', 'active', 'suspended'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === s
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={tenants}
        loading={loading}
        searchable
        actions={(row) => (
          <div className="flex gap-1">
            <button
              onClick={() => setDetail(row)}
              className="p-1.5 hover:bg-blue-50 rounded text-blue-500"
              title="View details"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            {row.status === 'pending' && (
              <button
                onClick={() => handleApprove(row.id)}
                className="p-1.5 hover:bg-green-50 rounded text-green-600"
                title="Approve"
              >
                <CheckCircle className="w-3.5 h-3.5" />
              </button>
            )}
            {row.status === 'active' && (
              <button
                onClick={() => handleSuspend(row.id)}
                className="p-1.5 hover:bg-red-50 rounded text-red-500"
                title="Suspend"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            )}
            {row.status === 'suspended' && (
              <button
                onClick={() => handleActivate(row.id)}
                className="p-1.5 hover:bg-green-50 rounded text-green-500"
                title="Re-activate"
              >
                <CheckCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
        emptyMessage="No institutes found."
      />

      {/* Detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Institute Details">
        {detail && (
          <div className="space-y-3 text-sm">
            {[
              { label: 'Name',         value: detail.name },
              { label: 'Email',        value: detail.contact_email || '—' },
              { label: 'GSTIN',        value: detail.gstin || '—' },
              { label: 'Plan',         value: detail.subscription_tier },
              { label: 'Status',       value: detail.status },
              { label: 'Registered',   value: detail.created_at ? format(new Date(detail.created_at), 'dd MMM yyyy') : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between py-2 border-b border-slate-100 last:border-0">
                <span className="text-slate-500">{label}</span>
                <span className="font-medium text-slate-900">{value}</span>
              </div>
            ))}
            <div className="flex gap-2 pt-4">
              {detail.status === 'pending' && (
                <button
                  onClick={() => { handleApprove(detail.id); setDetail(null) }}
                  className="btn-primary flex-1 justify-center"
                >
                  Approve Institute
                </button>
              )}
              {detail.status === 'active' && (
                <button
                  onClick={() => { handleSuspend(detail.id); setDetail(null) }}
                  className="btn-danger flex-1 justify-center"
                >
                  Suspend
                </button>
              )}
              {detail.status === 'suspended' && (
                <button
                  onClick={() => { handleActivate(detail.id); setDetail(null) }}
                  className="btn-primary flex-1 justify-center"
                >
                  Re-activate
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}