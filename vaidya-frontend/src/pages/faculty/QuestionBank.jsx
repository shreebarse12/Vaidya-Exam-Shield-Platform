import { useEffect, useState, useCallback } from 'react'
import { questionApi } from '@/api/questionApi'
import { PageHeader, Modal, Spinner, Badge } from '@/components/shared/UI'
import DataTable from '@/components/shared/DataTable'
import { Plus, Upload, Download, Pencil, Trash2, Eye } from 'lucide-react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const DIFFICULTY_COLORS = { easy: 'green', medium: 'yellow', hard: 'red' }

export default function QuestionBank() {
  const [questions, setQuestions] = useState([])
  const [total,     setTotal]     = useState(0)
  const [loading,   setLoading]   = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editQ,      setEditQ]     = useState(null)
  const [filters,    setFilters]   = useState({ subject: '', difficulty: '', status: '', search: '' })

  const fetchQuestions = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page: 1, page_size: 50, ...filters }
      const res = await questionApi.list(params)
      setQuestions(res.data.questions || [])
      setTotal(res.data.total || 0)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { fetchQuestions() }, [fetchQuestions])

  async function handleDelete(id) {
    if (!confirm('Archive this question?')) return
    try {
      await questionApi.delete(id)
      toast.success('Question archived')
      fetchQuestions()
    } catch { toast.error('Failed to archive') }
  }

  async function downloadTemplate() {
    const res = await questionApi.downloadTemplate()
    const url = URL.createObjectURL(new Blob([res.data]))
    const a   = document.createElement('a')
    a.href = url; a.download = 'question_template.csv'; a.click()
  }

  async function handleBulkUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await questionApi.bulkImport(fd)
      const { successful, failed, errors } = res.data
      toast.success(`Imported ${successful} questions${failed > 0 ? `, ${failed} failed` : ''}`)
      if (errors.length > 0) console.warn('Import errors:', errors)
      fetchQuestions()
    } catch { toast.error('Import failed') }
    e.target.value = ''
  }

  const columns = [
    {
      key: 'question_text', label: 'Question',
      render: (val) => <span className="line-clamp-2 text-sm" dangerouslySetInnerHTML={{ __html: val }} />,
    },
    { key: 'subject',    label: 'Subject',    render: (v) => v || '—' },
    { key: 'topic',      label: 'Topic',      render: (v) => v || '—' },
    {
      key: 'difficulty', label: 'Difficulty',
      render: (v) => v ? <Badge color={DIFFICULTY_COLORS[v]}>{v}</Badge> : '—',
    },
    {
      key: 'status', label: 'Status',
      render: (v) => <Badge color={v === 'published' ? 'green' : 'gray'}>{v}</Badge>,
    },
    { key: 'marks', label: 'Marks', render: (v) => `+${v}` },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Question Bank (${total})`}
        subtitle="Create and manage your question library"
        actions={
          <>
            <button onClick={downloadTemplate} className="btn-secondary">
              <Download className="w-4 h-4" /> Template
            </button>
            <label className="btn-secondary cursor-pointer">
              <Upload className="w-4 h-4" /> Bulk Import
              <input type="file" accept=".csv" onChange={handleBulkUpload} className="sr-only" />
            </label>
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Add Question
            </button>
          </>
        }
      />

      {/* Filters */}
      <div className="card flex flex-wrap gap-3">
        {[
          { key: 'subject',    placeholder: 'Subject',    options: ['Physics', 'Chemistry', 'Biology', 'Maths'] },
          { key: 'difficulty', placeholder: 'Difficulty', options: ['easy', 'medium', 'hard'] },
          { key: 'status',     placeholder: 'Status',     options: ['draft', 'published', 'archived'] },
        ].map(({ key, placeholder, options }) => (
          <select
            key={key}
            value={filters[key]}
            onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
            className="input w-auto text-sm"
          >
            <option value="">All {placeholder}s</option>
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        <input
          placeholder="Search questions..."
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          className="input text-sm flex-1 min-w-48"
        />
      </div>

      <DataTable
        columns={columns}
        data={questions}
        loading={loading}
        actions={(row) => (
          <div className="flex gap-1">
            <button onClick={() => setEditQ(row)} className="p-1.5 hover:bg-blue-50 rounded text-blue-500">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => handleDelete(row.id)} className="p-1.5 hover:bg-red-50 rounded text-red-500">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        emptyMessage="No questions found. Create one or import from CSV."
      />

      {/* Create/Edit Modal */}
      <QuestionFormModal
        open={showCreate || !!editQ}
        onClose={() => { setShowCreate(false); setEditQ(null) }}
        initialData={editQ}
        onSuccess={() => { setShowCreate(false); setEditQ(null); fetchQuestions() }}
      />
    </div>
  )
}

// ── Question Form Modal ────────────────────────────────────────────────────────
function QuestionFormModal({ open, onClose, initialData, onSuccess }) {
  const isEdit = !!initialData
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({
    defaultValues: initialData ? {
      question_text: initialData.question_text,
      subject: initialData.subject,
      topic: initialData.topic,
      difficulty: initialData.difficulty,
      marks: initialData.marks,
      negative_marks: initialData.negative_marks,
      status: initialData.status,
    } : { marks: 4, negative_marks: 1, difficulty: 'medium', status: 'draft' }
  })
  const [options, setOptions]       = useState(
    initialData?.options || [
      { key: 'A', text: '' }, { key: 'B', text: '' },
      { key: 'C', text: '' }, { key: 'D', text: '' },
    ]
  )
  const [correctAnswer, setCorrectAnswer] = useState(
    initialData?.correct_answer?.answer || 'A'
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      reset(initialData ? {
        question_text: initialData.question_text,
        subject: initialData.subject, topic: initialData.topic,
        difficulty: initialData.difficulty, marks: initialData.marks,
        negative_marks: initialData.negative_marks, status: initialData.status,
      } : { marks: 4, negative_marks: 1, difficulty: 'medium', status: 'draft' })
      setOptions(initialData?.options || [
        { key: 'A', text: '' }, { key: 'B', text: '' },
        { key: 'C', text: '' }, { key: 'D', text: '' },
      ])
      setCorrectAnswer(initialData?.correct_answer?.answer || 'A')
    }
  }, [open, initialData])

  async function onSubmit(data) {
    setSaving(true)
    try {
      const payload = {
        ...data,
        question_type: 'mcq',
        options,
        correct_answer: { answer: correctAnswer },
        marks: parseFloat(data.marks),
        negative_marks: parseFloat(data.negative_marks),
      }
      if (isEdit) {
        await questionApi.update(initialData.id, payload)
        toast.success('Question updated')
      } else {
        await questionApi.create(payload)
        toast.success('Question created')
      }
      onSuccess()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Question' : 'New Question'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Question text</label>
          <textarea
            {...register('question_text', { required: 'Required' })}
            rows={3} className={`input ${errors.question_text ? 'input-error' : ''}`}
            placeholder="Enter question text (HTML supported for formatting)"
          />
          {errors.question_text && <p className="error-text">{errors.question_text.message}</p>}
        </div>

        {/* Options */}
        <div>
          <label className="label">Options (select correct answer)</label>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={opt.key} className="flex items-center gap-2">
                <button type="button" onClick={() => setCorrectAnswer(opt.key)}
                  className={clsx(
                    'w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold border-2 transition-colors',
                    correctAnswer === opt.key
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-slate-300 text-slate-500 hover:border-green-400'
                  )}>
                  {opt.key}
                </button>
                <input
                  value={opt.text}
                  onChange={(e) => {
                    const next = [...options]
                    next[i] = { ...opt, text: e.target.value }
                    setOptions(next)
                  }}
                  className="input text-sm"
                  placeholder={`Option ${opt.key}`}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-1">Click the letter to set correct answer (currently: {correctAnswer})</p>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Subject</label>
            <input {...register('subject')} className="input" placeholder="Physics" />
          </div>
          <div>
            <label className="label">Topic</label>
            <input {...register('topic')} className="input" placeholder="Mechanics" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Difficulty</label>
            <select {...register('difficulty')} className="input">
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div>
            <label className="label">Marks</label>
            <input type="number" step="0.5" {...register('marks')} className="input" />
          </div>
          <div>
            <label className="label">Negative</label>
            <input type="number" step="0.25" {...register('negative_marks')} className="input" />
          </div>
        </div>

        <div>
          <label className="label">Status</label>
          <select {...register('status')} className="input">
            <option value="draft">Draft (not visible in exams)</option>
            <option value="published">Published (available in exams)</option>
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Create Question'}
          </button>
        </div>
      </form>
    </Modal>
  )
}