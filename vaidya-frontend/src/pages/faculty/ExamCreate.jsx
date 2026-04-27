import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { examApi } from '@/api/examApi'
import { questionApi } from '@/api/questionApi'
import { PageHeader } from '@/components/shared/UI'
import { CheckSquare, Square, AlertCircle, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const DIFFICULTY_COLORS = {
  easy: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  hard: 'bg-red-100 text-red-700',
}

export default function ExamCreate() {
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      duration_seconds: 10800,
      max_attempts: 1,
      negative_marking: 0.25,
      passing_percentage: 50,
      proctoring_level: 'standard',
      show_answers_after: 'submission',
    }
  })

  const [allQuestions, setAllQuestions] = useState([])
  const [selectedQIds, setSelectedQIds] = useState([])
  const [loading, setLoading] = useState(false)
  const [questionsLoading, setQuestionsLoading] = useState(true)
  const [qFilter, setQFilter] = useState({
    subject: '',
    difficulty: '',
    search: '',
    status: 'all',
  })

  useEffect(() => {
    async function loadQuestions() {
      setQuestionsLoading(true)
      try {
        const pageSize = 100
        const firstRes = await questionApi.list({ page: 1, page_size: pageSize })
        const firstPageQuestions = firstRes?.data?.questions || []
        const totalPages = firstRes?.data?.total_pages || 1

        if (totalPages <= 1) {
          setAllQuestions(firstPageQuestions)
          return
        }

        const remainingResponses = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, index) =>
            questionApi.list({ page: index + 2, page_size: pageSize })
          )
        )

        const remainingQuestions = remainingResponses.flatMap((response) => response?.data?.questions || [])
        setAllQuestions([...firstPageQuestions, ...remainingQuestions])
      } catch (err) {
        const detail = err?.response?.data?.detail
        const message = Array.isArray(detail)
          ? detail.map((item) => item?.msg).filter(Boolean).join(', ')
          : detail

        toast.error(message || 'Could not load questions')
      } finally {
        setQuestionsLoading(false)
      }
    }

    loadQuestions()
  }, [])

  const filteredQuestions = allQuestions.filter((q) => {
    if (qFilter.subject === '__none__') {
      if (q.subject) return false
    } else if (qFilter.subject && q.subject !== qFilter.subject) {
      return false
    }

    if (qFilter.difficulty && q.difficulty !== qFilter.difficulty) return false
    if (qFilter.status === 'published' && q.status !== 'published') return false
    if (qFilter.status === 'draft' && q.status !== 'draft') return false

    if (qFilter.search) {
      const text = (q.question_text || '').replace(/<[^>]+>/g, '').toLowerCase()
      if (!text.includes(qFilter.search.toLowerCase())) return false
    }

    return true
  })

  const subjects = [...new Set(allQuestions.map((q) => q.subject).filter(Boolean))].sort()
  const difficulties = ['easy', 'medium', 'hard']

  const publishedCount = allQuestions.filter((q) => q.status === 'published').length
  const draftCount = allQuestions.filter((q) => q.status === 'draft').length

  function toggleQuestion(id) {
    setSelectedQIds((prev) =>
      prev.includes(id) ? prev.filter((q) => q !== id) : [...prev, id]
    )
  }

  function toggleAll() {
    const visibleIds = filteredQuestions.map((q) => q.id)
    const allSelected = visibleIds.every((id) => selectedQIds.includes(id))

    if (allSelected) {
      setSelectedQIds((prev) => prev.filter((id) => !visibleIds.includes(id)))
    } else {
      setSelectedQIds((prev) => [...new Set([...prev, ...visibleIds])])
    }
  }

  async function onSubmit(data) {
    if (selectedQIds.length === 0) {
      return toast.error('Please select at least one question for the exam')
    }

    const selectedQuestions = allQuestions.filter((q) => selectedQIds.includes(q.id))
    const draftSelected = selectedQuestions.filter((q) => q.status === 'draft')
    if (draftSelected.length > 0) {
      const proceed = confirm(
        `${draftSelected.length} selected question(s) are still in DRAFT status.\n\n` +
        `Draft questions can be included in exams - students will see them.\n\n` +
        `Do you want to continue?`
      )
      if (!proceed) return
    }

    setLoading(true)
    try {
      const payload = {
        name: data.name,
        description: data.description || undefined,
        duration_seconds: parseInt(data.duration_seconds),
        max_attempts: parseInt(data.max_attempts),
        negative_marking: parseFloat(data.negative_marking),
        passing_percentage: data.passing_percentage ? parseFloat(data.passing_percentage) : undefined,
        start_time: data.start_time || null,
        end_time: data.end_time || null,
        question_ids: selectedQIds,
        config: {
          shuffle_questions: !!data.shuffle_questions,
          shuffle_options: !!data.shuffle_options,
          calculator_enabled: !!data.calculator_enabled,
          proctoring_level: data.proctoring_level || 'standard',
          show_answers_after: data.show_answers_after || 'submission',
          sections: [],
        },
      }

      const res = await examApi.create(payload)
      const examId = res?.data?.id

      if (data.publish_now) {
        await examApi.publish(examId)
        toast.success('Exam created and published! Students can now attempt it.')
      } else {
        toast.success('Exam saved as draft. Go to Dashboard to publish it when ready.')
      }

      navigate('/faculty/dashboard')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to create exam')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Create New Exam" subtitle="Build an exam by selecting questions and configuring settings" />

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4">
            <div className="card">
              <h2 className="mb-4 font-semibold text-slate-900">Exam Details</h2>
              <div className="space-y-3">
                <div>
                  <label className="label">Exam name *</label>
                  <input
                    {...register('name', { required: 'Exam name is required' })}
                    className={`input ${errors.name ? 'input-error' : ''}`}
                    placeholder="e.g. NEET Mock Test - Full Syllabus"
                  />
                  {errors.name && <p className="error-text">{errors.name.message}</p>}
                </div>

                <div>
                  <label className="label">Description</label>
                  <textarea
                    {...register('description')}
                    rows={2}
                    className="input"
                    placeholder="Optional description for students..."
                  />
                </div>

                <div>
                  <label className="label">Duration (seconds)</label>
                  <input type="number" {...register('duration_seconds')} className="input" />
                  <p className="mt-0.5 text-xs text-slate-400">
                    1800 = 30 min | 3600 = 1 hr | 10800 = 3 hrs
                  </p>
                </div>

                <div>
                  <label className="label">Negative marking</label>
                  <input type="number" step="0.25" {...register('negative_marking')} className="input" />
                  <p className="mt-0.5 text-xs text-slate-400">
                    Per-question marks come from each question in the question bank.
                  </p>
                </div>

                <div>
                  <label className="label">Passing % (optional)</label>
                  <input type="number" {...register('passing_percentage')} className="input" placeholder="e.g. 50" />
                </div>

                <div>
                  <label className="label">Max attempts per student</label>
                  <input type="number" {...register('max_attempts')} className="input" />
                </div>

                <div>
                  <label className="label">Start Time</label>
                  <input
                    type="datetime-local"
                    {...register('start_time')}
                    className="input"
                  />
                  <p className="mt-0.5 text-xs text-slate-400">
                    Students can start the exam only after this time
                  </p>
                </div>

                <div>
                  <label className="label">End Time</label>
                  <input
                    type="datetime-local"
                    {...register('end_time')}
                    className="input"
                  />
                  <p className="mt-0.5 text-xs text-slate-400">
                    Exam automatically closes after this time
                  </p>
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="mb-4 font-semibold text-slate-900">Proctoring & Options</h2>
              <div className="space-y-3">
                <div>
                  <label className="label">Proctoring level</label>
                  <select {...register('proctoring_level')} className="input">
                    <option value="none">None (no monitoring)</option>
                    <option value="basic">Basic (face detection)</option>
                    <option value="standard">Standard (face + phone detection)</option>
                    <option value="advanced">Advanced (face + phone + audio)</option>
                  </select>
                </div>

                <div>
                  <label className="label">Show answers to students</label>
                  <select {...register('show_answers_after')} className="input">
                    <option value="submission">After they submit</option>
                    <option value="immediately">Immediately after each question</option>
                    <option value="evaluation">Only after manual evaluation</option>
                  </select>
                </div>

                <div className="space-y-2 pt-1">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" defaultChecked {...register('shuffle_questions')} className="rounded" />
                    Randomise question order per student
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" defaultChecked {...register('shuffle_options')} className="rounded" />
                    Randomise option order per student
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" {...register('calculator_enabled')} className="rounded" />
                    Allow scientific calculator
                  </label>
                </div>
              </div>
            </div>

            <div className="card border-2 border-blue-200 bg-blue-50">
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" {...register('publish_now')} className="mt-0.5 rounded" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">Publish immediately</p>
                  <p className="mt-0.5 text-xs text-blue-700">
                    Students can start the exam right away. If unchecked, exam is saved as Draft
                    and you can publish later from Dashboard.
                  </p>
                </div>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || selectedQIds.length === 0}
              className={clsx(
                'btn-primary w-full justify-center py-3 text-base',
                selectedQIds.length === 0 && 'cursor-not-allowed opacity-50'
              )}
            >
              {loading
                ? 'Creating exam...'
                : selectedQIds.length === 0
                  ? 'Select questions to continue'
                  : `Create Exam (${selectedQIds.length} question${selectedQIds.length !== 1 ? 's' : ''})`}
            </button>
          </div>

          <div className="lg:col-span-2">
            <div className="card">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-slate-900">
                    Select Questions
                    {selectedQIds.length > 0 && (
                      <span className="ml-2 text-blue-600">({selectedQIds.length} selected)</span>
                    )}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {publishedCount} published | {draftCount} draft
                    {draftCount > 0 && (
                      <span className="text-amber-600"> | Draft questions are also selectable</span>
                    )}
                  </p>
                </div>
                {filteredQuestions.length > 0 && (
                  <button type="button" onClick={toggleAll} className="text-sm text-blue-600 hover:underline">
                    {filteredQuestions.every((q) => selectedQIds.includes(q.id))
                      ? 'Deselect all visible'
                      : `Select all ${filteredQuestions.length} visible`}
                  </button>
                )}
              </div>

              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <select
                  value={qFilter.subject}
                  onChange={(e) => setQFilter((prev) => ({ ...prev, subject: e.target.value }))}
                  className="input text-sm"
                >
                  <option value="">All subjects ({allQuestions.length})</option>
                  {subjects.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject} ({allQuestions.filter((q) => q.subject === subject).length})
                    </option>
                  ))}
                  <option value="__none__">No subject ({allQuestions.filter((q) => !q.subject).length})</option>
                </select>

                <select
                  value={qFilter.difficulty}
                  onChange={(e) => setQFilter((prev) => ({ ...prev, difficulty: e.target.value }))}
                  className="input text-sm"
                >
                  <option value="">All difficulties</option>
                  {difficulties.map((difficulty) => (
                    <option key={difficulty} value={difficulty}>
                      {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} ({allQuestions.filter((q) => q.difficulty === difficulty).length})
                    </option>
                  ))}
                </select>

                <select
                  value={qFilter.status}
                  onChange={(e) => setQFilter((prev) => ({ ...prev, status: e.target.value }))}
                  className="input text-sm"
                >
                  <option value="all">All statuses</option>
                  <option value="published">Published only ({publishedCount})</option>
                  <option value="draft">Draft only ({draftCount})</option>
                </select>

                <input
                  value={qFilter.search}
                  onChange={(e) => setQFilter((prev) => ({ ...prev, search: e.target.value }))}
                  placeholder="Search questions..."
                  className="input text-sm"
                />
              </div>

              {publishedCount === 0 && allQuestions.length > 0 && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                  <p className="text-xs text-amber-700">
                    All your questions are in Draft status. You can still select them for this exam,
                    or go to <strong>Question Bank</strong> and publish them first.
                  </p>
                </div>
              )}

              <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                {questionsLoading ? (
                  <div className="py-12 text-center">
                    <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                    <p className="text-sm text-slate-400">Loading questions...</p>
                  </div>
                ) : allQuestions.length === 0 ? (
                  <div className="py-12 text-center">
                    <AlertCircle className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                    <p className="font-medium text-slate-600">No questions in your question bank</p>
                    <p className="mt-1 mb-4 text-sm text-slate-400">
                      Create questions first before making an exam
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate('/faculty/questions')}
                      className="btn-primary text-sm"
                    >
                      Go to Question Bank
                    </button>
                  </div>
                ) : filteredQuestions.length === 0 ? (
                  <div className="py-8 text-center">
                    <Info className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                    <p className="text-sm text-slate-500">No questions match the current filters</p>
                    <button
                      type="button"
                      onClick={() => setQFilter({ subject: '', difficulty: '', search: '', status: 'all' })}
                      className="mt-2 text-sm text-blue-600 hover:underline"
                    >
                      Clear all filters
                    </button>
                  </div>
                ) : (
                  filteredQuestions.map((q) => {
                    const selected = selectedQIds.includes(q.id)
                    const isDraft = q.status === 'draft'

                    return (
                      <div
                        key={q.id}
                        onClick={() => toggleQuestion(q.id)}
                        className={clsx(
                          'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all',
                          selected
                            ? 'border-blue-400 bg-blue-50 shadow-sm'
                            : 'border-slate-200 hover:border-blue-200 hover:bg-slate-50'
                        )}
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          {selected
                            ? <CheckSquare className="h-5 w-5 text-blue-600" />
                            : <Square className="h-5 w-5 text-slate-400" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p
                            className="line-clamp-2 text-sm leading-snug text-slate-800"
                            dangerouslySetInnerHTML={{
                              __html: (q.question_text || '').replace(/<[^>]+>/g, ' ').trim() || 'No text'
                            }}
                          />
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {q.subject && (
                              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                                {q.subject}
                              </span>
                            )}
                            {q.topic && (
                              <span className="text-xs text-slate-400">{q.topic}</span>
                            )}
                            {q.difficulty && (
                              <span className={clsx('rounded-full px-2 py-0.5 text-xs', DIFFICULTY_COLORS[q.difficulty])}>
                                {q.difficulty}
                              </span>
                            )}
                            <span className="text-xs text-slate-400">+{q?.marks || 4} marks</span>
                            {isDraft && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                                Draft
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {filteredQuestions.length > 0 && (
                <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span>Showing {filteredQuestions.length} of {allQuestions.length} questions</span>
                  {selectedQIds.length > 0 && (
                    <span className="font-medium text-blue-600">
                      {selectedQIds.length} selected {'|'} Total marks: {allQuestions
                        .filter((q) => selectedQIds.includes(q.id))
                        .reduce((sum, q) => sum + (q?.marks || 4), 0)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
