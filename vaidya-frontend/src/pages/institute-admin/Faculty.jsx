// Faculty.jsx
import { useEffect, useState, useCallback } from 'react'
import { instituteApi } from "@/api/instituteApi";
import { PageHeader, Modal } from '@/components/shared/UI'
import DataTable from '@/components/shared/DataTable'
import { useForm } from 'react-hook-form'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'

export function Faculty() {
  const [faculty,  setFaculty]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showAdd,  setShowAdd]  = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    instituteApi.listFaculty().then((r) => setFaculty(r.data)).finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const columns = [
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name',  label: 'Last Name' },
    { key: 'email',      label: 'Email' },
    { key: 'phone',      label: 'Phone', render: (v) => v || '—' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Faculty (${faculty.length})`}
        actions={
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Faculty
          </button>
        }
      />
      <DataTable columns={columns} data={faculty} loading={loading} searchable emptyMessage="No faculty added yet." />
      <AddFacultyModal open={showAdd} onClose={() => setShowAdd(false)} onSuccess={() => { setShowAdd(false); fetch() }} />
    </div>
  )
}

function AddFacultyModal({ open, onClose, onSuccess }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm()
  const [saving, setSaving] = useState(false)

  async function onSubmit(data) {
    setSaving(true)
    try {
      await instituteApi.addFaculty(data)
      toast.success('Faculty added')
      reset(); onSuccess()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
    finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Faculty Member">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">First name</label>
            <input {...register('first_name', { required: true })} className="input" />
          </div>
          <div>
            <label className="label">Last name</label>
            <input {...register('last_name', { required: true })} className="input" />
          </div>
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" {...register('email', { required: true })} className="input" />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Adding...' : 'Add Faculty'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default Faculty