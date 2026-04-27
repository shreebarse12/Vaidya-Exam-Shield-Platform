import { useEffect, useState, useCallback } from 'react'
import { instituteApi } from "@/api/instituteApi";
import { PageHeader, Modal } from '@/components/shared/UI'
import DataTable from '@/components/shared/DataTable'
import { useForm } from 'react-hook-form'
import { Plus, Layers } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Batches() {
  const [batches,  setBatches]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showAdd,  setShowAdd]  = useState(false)

  const fetch = useCallback(() => {
    setLoading(true)
    instituteApi.listBatches().then((r) => setBatches(r.data)).finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const columns = [
    { key: 'name',        label: 'Batch Name' },
    { key: 'description', label: 'Description', render: (v) => v || '—' },
    { key: 'faculty_id',  label: 'Faculty',     render: (v) => v ? v.slice(0, 8) + '...' : '—' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Batches (${batches.length})`}
        subtitle="Organise students into groups"
        actions={
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Create Batch
          </button>
        }
      />
      <DataTable columns={columns} data={batches} loading={loading}
        emptyMessage="No batches yet. Create one to organise your students." />
      <CreateBatchModal open={showAdd} onClose={() => setShowAdd(false)}
        onSuccess={() => { setShowAdd(false); fetch() }} />
    </div>
  )
}

function CreateBatchModal({ open, onClose, onSuccess }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm()
  const [saving, setSaving] = useState(false)

  async function onSubmit(data) {
    setSaving(true)
    try {
      await instituteApi.createBatch(data)
      toast.success('Batch created')
      reset(); onSuccess()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
    finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Batch">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Batch name *</label>
          <input {...register('name', { required: true })} className="input" placeholder="NEET Batch A 2026" />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea {...register('description')} rows={2} className="input" placeholder="Optional..." />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Creating...' : 'Create Batch'}
          </button>
        </div>
      </form>
    </Modal>
  )
}