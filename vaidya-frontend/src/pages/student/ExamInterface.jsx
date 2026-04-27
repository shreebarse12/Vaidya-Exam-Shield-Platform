import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  initExam, setAnswer, clearAnswer, goToQuestion, goToNext, goToPrev,
  toggleMarkForReview, tickTimer, setSubmitting, setResult, resetExam,
  selectQuestions, selectCurrentQuestion, selectCurrentIndex,
  selectAnswers, selectMarkedForReview, selectTimeRemaining,
  selectIsSubmitting, selectAttemptId, selectProctoringFlags,
} from '@/store/examSlice'
import { examApi } from '@/api/examApi'
import { useExamSocket } from '@/hooks/useExamSocket'
import { useAutoSave } from '@/hooks/useAutoSave'
import {
  ChevronLeft, ChevronRight, Flag, RotateCcw,
  Clock, Camera, AlertTriangle, CheckCircle,
} from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import BrandLogo from '@/components/shared/BrandLogo'

// ── Timer Display ─────────────────────────────────────────────────────────────
function TimerDisplay({ seconds }) {
  const h  = Math.floor(seconds / 3600)
  const m  = Math.floor((seconds % 3600) / 60)
  const s  = seconds % 60
  const fmt = (n) => String(n).padStart(2, '0')
  const isWarning = seconds < 300   // last 5 min
  const isDanger  = seconds < 60    // last 1 min

  return (
    <div className={clsx(
      'flex items-center gap-2 font-mono text-lg font-bold px-3 py-1.5 rounded-lg',
      isDanger  ? 'bg-red-100 text-red-700 animate-pulse' :
      isWarning ? 'bg-yellow-100 text-yellow-700' :
                  'bg-slate-100 text-slate-700'
    )}>
      <Clock className="w-4 h-4" />
      {h > 0 ? `${fmt(h)}:` : ''}{fmt(m)}:{fmt(s)}
    </div>
  )
}

// ── Question Palette ──────────────────────────────────────────────────────────
function QuestionPalette({ questions, answers, markedForReview, currentIndex, onGoTo }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {questions.map((q, i) => {
        const answered = answers[q.id] != null
        const marked   = markedForReview.includes(q.id)
        const current  = i === currentIndex
        return (
          <button
            key={q.id}
            onClick={() => onGoTo(i)}
            className={clsx('q-bubble',
              current  ? 'q-bubble-current' : '',
              marked   ? 'q-bubble-marked'   :
              answered ? 'q-bubble-answered' :
                         'q-bubble-unanswered'
            )}
          >
            {i + 1}
          </button>
        )
      })}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ExamInterface() {
  const { examId }   = useParams()
  const navigate     = useNavigate()
  const dispatch     = useDispatch()
  const videoRef     = useRef(null)
  const canvasRef    = useRef(null)

  const questions      = useSelector(selectQuestions)
  const currentQ       = useSelector(selectCurrentQuestion)
  const currentIndex   = useSelector(selectCurrentIndex)
  const answers        = useSelector(selectAnswers)
  const markedForReview= useSelector(selectMarkedForReview)
  const timeRemaining  = useSelector(selectTimeRemaining)
  const isSubmitting   = useSelector(selectIsSubmitting)
  const attemptId      = useSelector(selectAttemptId)
  const proctoringFlags = useSelector(selectProctoringFlags)

  const [loading,    setLoading]    = useState(true)
  const [showConfirm,setShowConfirm]= useState(false)
  const [cameraOn,   setCameraOn]   = useState(false)

  // Auto-save every 30 seconds
  useAutoSave({ attemptId, answers, enabled: !!attemptId })

  // WebSocket for proctoring
  const { sendFrame } = useExamSocket({
    attemptId,
    onAutoSubmit: () => handleSubmit(true),
  })

  // ── Start exam on mount ──────────────────────────────────────────────────
  useEffect(() => {
    async function startExam() {
      try {
        const res = await examApi.start(examId)
        dispatch(initExam(res.data))

        // Enter fullscreen
        document.documentElement.requestFullscreen?.().catch(() => {})
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Could not start exam')
        navigate('/student/dashboard')
      } finally {
        setLoading(false)
      }
    }
    startExam()

    // Block keyboard shortcuts
    function blockShortcuts(e) {
      const blocked = [
        e.ctrlKey && 'cvxpCVXP'.includes(e.key),
        e.metaKey && 'cvxpCVXP'.includes(e.key),
        e.key === 'F12',
        e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key),
      ]
      if (blocked.some(Boolean)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    // Disable right-click
    const noCtxMenu = (e) => e.preventDefault()
    document.addEventListener('keydown', blockShortcuts)
    document.addEventListener('contextmenu', noCtxMenu)

    return () => {
      document.removeEventListener('keydown', blockShortcuts)
      document.removeEventListener('contextmenu', noCtxMenu)
      dispatch(resetExam())
      document.exitFullscreen?.().catch(() => {})
    }
  }, [examId])

  // ── Timer countdown ──────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || isSubmitting) return
    const timer = setInterval(() => {
      dispatch(tickTimer())
    }, 1000)
    return () => clearInterval(timer)
  }, [loading, isSubmitting, dispatch])

  // Auto-submit when timer hits 0
  useEffect(() => {
    if (timeRemaining === 0 && attemptId && !isSubmitting) {
      toast('Time up! Submitting your exam...', { icon: '⏰' })
      handleSubmit(true)
    }
  }, [timeRemaining])

  // ── Camera init for proctoring ───────────────────────────────────────────
  useEffect(() => {
    if (!attemptId) return
    navigator.mediaDevices?.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setCameraOn(true)
        }
        // Capture frame every 1 second and send to WebSocket
        const interval = setInterval(() => {
          if (!canvasRef.current || !videoRef.current) return
          const ctx = canvasRef.current.getContext('2d')
          ctx.drawImage(videoRef.current, 0, 0, 160, 120)
          const frame = canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1]
          sendFrame(frame)
        }, 1000)
        return () => clearInterval(interval)
      })
      .catch(() => toast('Camera access denied — proctoring may flag your attempt', { icon: '⚠️' }))
  }, [attemptId])

  // ── Submit handler ───────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (autoSubmit = false) => {
    if (!attemptId || isSubmitting) return
    if (!autoSubmit && !showConfirm) {
      setShowConfirm(true)
      return
    }

    dispatch(setSubmitting(true))
    setShowConfirm(false)

    try {
      const res = await examApi.submit({
        attempt_id: attemptId,
        answers,
        time_spent_seconds: undefined,
      })
      dispatch(setResult(res.data))
      // Clean up local storage
      localStorage.removeItem(`exam_answers_${attemptId}`)
      navigate(`/exam/results/${attemptId}`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Submission failed')
      dispatch(setSubmitting(false))
    }
  }, [attemptId, answers, isSubmitting, showConfirm, dispatch, navigate])

  function handleSelectOption(optionKey) {
    if (!currentQ) return
    dispatch(setAnswer({ questionId: currentQ.id, answer: optionKey }))
  }

  function handleClearResponse() {
    if (!currentQ) return
    dispatch(clearAnswer(currentQ.id))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium">Loading exam...</p>
        </div>
      </div>
    )
  }

  const answeredCount = Object.values(answers).filter(Boolean).length
  const selectedOption = currentQ ? answers[currentQ.id] : null
  const isMarked = currentQ ? markedForReview.includes(currentQ.id) : false

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col select-none" style={{ userSelect: 'none' }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <BrandLogo compact light subtitle={`${questions.length} Questions`} />

        <TimerDisplay seconds={timeRemaining} />

        <div className="flex items-center gap-3">
          <div className={clsx(
            'flex items-center gap-1.5 rounded-full px-2 py-1 text-xs',
            proctoringFlags >= 8 ? 'bg-red-900/50 text-red-300' : 'bg-amber-900/40 text-amber-300'
          )}>
            <AlertTriangle className="w-3 h-3" />
            Warnings {proctoringFlags}/10
          </div>

          {/* Camera indicator */}
          <div className={clsx('flex items-center gap-1.5 text-xs px-2 py-1 rounded-full',
            cameraOn ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
          )}>
            <Camera className="w-3 h-3" />
            {cameraOn ? 'Camera on' : 'Camera off'}
          </div>

          <button
            onClick={() => setShowConfirm(true)}
            disabled={isSubmitting}
            className="btn-primary bg-green-600 hover:bg-green-700 text-sm py-1.5"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Exam'}
          </button>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Question area */}
        <div className="flex-1 flex flex-col overflow-y-auto exam-scroll p-6">
          {currentQ ? (
            <>
              {/* Question number + section */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                  Q {currentIndex + 1} / {questions.length}
                </span>
                {currentQ.section_name && (
                  <span className="text-xs text-blue-400 bg-blue-900/40 px-2 py-0.5 rounded">
                    {currentQ.section_name}
                  </span>
                )}
                {isMarked && (
                  <span className="text-xs text-yellow-400 bg-yellow-900/40 px-2 py-0.5 rounded flex items-center gap-1">
                    <Flag className="w-3 h-3" /> Marked
                  </span>
                )}
              </div>

              {/* Question text */}
              <div className="text-base leading-relaxed text-slate-100 mb-6"
                dangerouslySetInnerHTML={{ __html: currentQ.question_text }}
              />

              {/* Question image */}
              {currentQ.image_url && (
                <img src={currentQ.image_url} alt="Question" className="max-w-md rounded-lg mb-6 border border-slate-600" />
              )}

              {/* MCQ Options */}
              {currentQ.options && (
                <div className="space-y-3">
                  {currentQ.options.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => handleSelectOption(opt.key)}
                      className={clsx(
                        'w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3',
                        selectedOption === opt.key
                          ? 'border-blue-500 bg-blue-900/40 text-blue-200'
                          : 'border-slate-600 bg-slate-800/50 text-slate-300 hover:border-slate-400 hover:bg-slate-800'
                      )}
                    >
                      <span className={clsx(
                        'flex-shrink-0 w-7 h-7 rounded-full border flex items-center justify-center text-sm font-bold',
                        selectedOption === opt.key
                          ? 'border-blue-400 bg-blue-500 text-white'
                          : 'border-slate-500 text-slate-400'
                      )}>
                        {opt.key}
                      </span>
                      <span className="pt-0.5" dangerouslySetInnerHTML={{ __html: opt.text }} />
                    </button>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-3 mt-8 flex-wrap">
                <button onClick={handleClearResponse}
                  className="btn-secondary text-xs py-1.5 border-slate-600 text-slate-400 hover:text-white">
                  <RotateCcw className="w-3.5 h-3.5" /> Clear response
                </button>
                <button
                  onClick={() => dispatch(toggleMarkForReview(currentQ.id))}
                  className={clsx('btn-secondary text-xs py-1.5', isMarked ? 'border-yellow-500 text-yellow-400' : 'border-slate-600 text-slate-400')}
                >
                  <Flag className="w-3.5 h-3.5" /> {isMarked ? 'Unmark' : 'Mark for review'}
                </button>

                <div className="flex-1" />

                <button onClick={() => dispatch(goToPrev())} disabled={currentIndex === 0}
                  className="btn-secondary text-xs py-1.5 border-slate-600 text-slate-400 disabled:opacity-30">
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                <button onClick={() => dispatch(goToNext())} disabled={currentIndex === questions.length - 1}
                  className="btn-primary text-xs py-1.5">
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="text-center text-slate-400 py-20">No questions loaded.</div>
          )}
        </div>

        {/* Right sidebar: palette + camera */}
        <div className="w-72 bg-slate-800 border-l border-slate-700 flex flex-col flex-shrink-0">
          {/* Mini camera feed */}
          <div className="p-3 border-b border-slate-700">
            <video ref={videoRef} autoPlay muted playsInline
              className="w-full h-28 object-cover rounded-lg bg-slate-900" />
            <canvas ref={canvasRef} width={160} height={120} className="hidden" />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 p-3 border-b border-slate-700 text-center">
            <div>
              <p className="text-green-400 font-bold text-lg">{answeredCount}</p>
              <p className="text-xs text-slate-500">Answered</p>
            </div>
            <div>
              <p className="text-yellow-400 font-bold text-lg">{markedForReview.length}</p>
              <p className="text-xs text-slate-500">Marked</p>
            </div>
            <div>
              <p className="text-slate-400 font-bold text-lg">{questions.length - answeredCount}</p>
              <p className="text-xs text-slate-500">Skipped</p>
            </div>
          </div>

          {/* Question palette */}
          <div className="flex-1 overflow-y-auto p-3">
            <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Questions</p>
            <QuestionPalette
              questions={questions}
              answers={answers}
              markedForReview={markedForReview}
              currentIndex={currentIndex}
              onGoTo={(i) => dispatch(goToQuestion(i))}
            />
          </div>

          {/* Legend */}
          <div className="p-3 border-t border-slate-700 space-y-1.5">
            {[
              { color: 'bg-green-500',  label: 'Answered' },
              { color: 'bg-yellow-400', label: 'Marked for review' },
              { color: 'bg-white border border-slate-500', label: 'Not answered' },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-2 text-xs text-slate-400">
                <div className={clsx('w-3 h-3 rounded-full', l.color)} />
                {l.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Submit Confirmation Modal ─────────────────────────────────────── */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 text-slate-900">
            <div className="text-center mb-6">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <h2 className="text-xl font-bold mb-2">Submit Exam?</h2>
              <p className="text-sm text-slate-500">
                You have answered <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> questions.
                {questions.length - answeredCount > 0 && (
                  <span className="text-red-500"> {questions.length - answeredCount} unanswered.</span>
                )}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="btn-secondary flex-1 justify-center">
                Continue Exam
              </button>
              <button onClick={() => handleSubmit(true)} disabled={isSubmitting}
                className="btn-primary flex-1 justify-center bg-green-600 hover:bg-green-700">
                <CheckCircle className="w-4 h-4" />
                {isSubmitting ? 'Submitting...' : 'Yes, Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
