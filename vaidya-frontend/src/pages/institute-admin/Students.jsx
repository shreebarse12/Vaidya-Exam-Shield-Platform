import { useEffect, useState, useCallback } from 'react'
import { instituteApi } from "@/api/instituteApi";
import { PageHeader, Modal, Badge } from '@/components/shared/UI'
import DataTable from '@/components/shared/DataTable'
import { useForm } from 'react-hook-form'
import { Plus, Upload, UserX } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Students() {
  const [students, setStudents] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showAdd,  setShowAdd]  = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const r = await instituteApi.listStudents()
      setStudents(r.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  async function handleDeactivate(id) {
    if (!confirm('Deactivate this student?')) return
    try {
      await instituteApi.deactivateStudent(id)
      toast.success('Student deactivated')
      fetch()
    } catch { toast.error('Failed') }
  }

  async function handleBulkUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    try {
      const r = await instituteApi.bulkImportStudents(fd)
      toast.success(`Imported ${r.data.successful} students`)
      fetch()
    } catch { toast.error('Import failed') }
    e.target.value = ''
  }

  const columns = [
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name',  label: 'Last Name' },
    { key: 'email',      label: 'Email' },
    { key: 'phone',      label: 'Phone', render: (v) => v || '—' },
    {
      key: 'is_active', label: 'Status',
      render: (v) => <Badge color={v ? 'green' : 'red'}>{v ? 'Active' : 'Inactive'}</Badge>
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Students (${students.length})`}
        actions={
          <>
            <label className="btn-secondary cursor-pointer">
              <Upload className="w-4 h-4" /> Bulk Import
              <input type="file" accept=".csv" onChange={handleBulkUpload} className="sr-only" />
            </label>
            <button onClick={() => setShowAdd(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Add Student
            </button>
          </>
        }
      />

      <DataTable
        columns={columns}
        data={students}
        loading={loading}
        searchable
        actions={(row) => (
          <button onClick={() => handleDeactivate(row.id)}
            className="p-1.5 hover:bg-red-50 rounded text-red-500" title="Deactivate">
            <UserX className="w-3.5 h-3.5" />
          </button>
        )}
        emptyMessage="No students yet. Add one or import from CSV."
      />

      <AddStudentModal open={showAdd} onClose={() => setShowAdd(false)} onSuccess={() => { setShowAdd(false); fetch() }} />
    </div>
  )
}

function AddStudentModal({ open, onClose, onSuccess }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm()
  const [saving, setSaving] = useState(false)

  async function onSubmit(data) {
    setSaving(true)
    try {
      await instituteApi.addStudent(data)
      toast.success('Student added. Default password: Welcome@123')
      reset()
      onSuccess()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Student">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">First name</label>
            <input {...register('first_name', { required: true })} className={`input ${errors.first_name ? 'input-error' : ''}`} />
          </div>
          <div>
            <label className="label">Last name</label>
            <input {...register('last_name', { required: true })} className={`input ${errors.last_name ? 'input-error' : ''}`} />
          </div>
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" {...register('email', { required: true })} className={`input ${errors.email ? 'input-error' : ''}`} />
        </div>
        <div>
          <label className="label">Phone (optional)</label>
          <input type="tel" {...register('phone')} className="input" />
        </div>
        <div className="p-3 bg-amber-50 rounded-lg text-xs text-amber-700">
          Student will receive default password: <strong>Welcome@123</strong>. They must change it on first login.
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Adding...' : 'Add Student'}
          </button>
        </div>
      </form>
    </Modal>
  )
}