import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Bot, FileSearch, Send, User } from 'lucide-react'
import { format } from 'date-fns'

import { doubtApi } from '@/api/doubtApi'
import { PageHeader } from '@/components/shared/UI'

const INTRO_MESSAGE = {
  role: 'assistant',
  content: "Hi! I'm your AI tutor. Ask me any doubt from Physics, Chemistry, Biology, Maths, or any exam topic. You can also ask me to analyze your last exam mistakes.",
}

export default function AiDoubtSolver() {
  const location = useLocation()
  const analyzeAttemptId = location.state?.analyzeAttemptId
  const analyzeExamName = location.state?.examName

  const [messages, setMessages] = useState([INTRO_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [autoAnalysisDone, setAutoAnalysisDone] = useState(false)
  const [examOptions, setExamOptions] = useState([])
  const [selectedAttemptId, setSelectedAttemptId] = useState(analyzeAttemptId || '')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    async function loadStudentExams() {
      try {
        const res = await doubtApi.listStudentExams()
        const exams = res?.data?.exams || []
        setExamOptions(exams)

        if (!analyzeAttemptId && exams.length > 0 && !selectedAttemptId) {
          setSelectedAttemptId(exams[0].attempt_id)
        }
      } catch (err) {
        const detail = err?.response?.data?.detail
        if (typeof detail === 'string') {
          setErrorText(detail)
        }
      }
    }

    loadStudentExams()
  }, [])

  useEffect(() => {
    if (!analyzeAttemptId || autoAnalysisDone) return
    setAutoAnalysisDone(true)
    handleAnalyzeAttempt(analyzeAttemptId, analyzeExamName)
  }, [analyzeAttemptId, analyzeExamName, autoAnalysisDone])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setErrorText('')

    try {
      const res = await doubtApi.ask({
        question: text,
        history: messages.slice(-6),
      })
      setMessages((prev) => [...prev, { role: 'assistant', content: res.data.answer }])
    } catch (err) {
      const detail = err?.response?.data?.detail
      setErrorText(typeof detail === 'string' ? detail : '')
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please try again in a moment.",
      }])
    } finally {
      setLoading(false)
    }
  }

  async function handleAnalyzeLastExam() {
    if (loading) return

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: 'Analyze my last exam and explain my wrong answers.' },
    ])
    setLoading(true)
    setErrorText('')

    try {
      const res = await doubtApi.analyzeLastExam()
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `I analyzed your latest exam "${res.data.exam_name}". You had ${res.data.wrong_count} wrong question(s).\n\n${res.data.answer}`,
      }])
    } catch (err) {
      const detail = err?.response?.data?.detail
      setErrorText(typeof detail === 'string' ? detail : '')
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: typeof detail === 'string'
          ? detail
          : "I couldn't analyze your last exam right now.",
      }])
    } finally {
      setLoading(false)
    }
  }

  async function handleAnalyzeAttempt(attemptId, examName) {
    if (!attemptId || loading) return

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: examName ? `Analyze my mistakes from ${examName}.` : 'Analyze this exam attempt for me.' },
    ])
    setLoading(true)
    setErrorText('')

    try {
      const res = await doubtApi.analyzeAttempt(attemptId)
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `I analyzed "${res.data.exam_name}". You had ${res.data.wrong_count} wrong question(s).\n\n${res.data.answer}`,
      }])
    } catch (err) {
      const detail = err?.response?.data?.detail
      setErrorText(typeof detail === 'string' ? detail : '')
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: typeof detail === 'string'
          ? detail
          : "I couldn't analyze that exam attempt right now.",
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <PageHeader title="AI Doubt Solver" subtitle="Ask any exam-related question or analyze your past exam mistakes" />

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={selectedAttemptId}
          onChange={(e) => setSelectedAttemptId(e.target.value)}
          className="input min-w-[18rem]"
        >
          <option value="">Select an exam to analyze</option>
          {examOptions.map((exam) => (
            <option key={exam.attempt_id} value={exam.attempt_id}>
              {exam.exam_name}
              {exam.submitted_at ? ` - ${format(new Date(exam.submitted_at), 'dd MMM yyyy')}` : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            const exam = examOptions.find((item) => item.attempt_id === selectedAttemptId)
            handleAnalyzeAttempt(selectedAttemptId, exam?.exam_name)
          }}
          disabled={loading || !selectedAttemptId}
          className="btn-secondary gap-2 disabled:opacity-40"
        >
          <FileSearch className="h-4 w-4" />
          Analyze Selected Exam
        </button>
        {analyzeAttemptId && (
          <button
            type="button"
            onClick={() => handleAnalyzeAttempt(analyzeAttemptId, analyzeExamName)}
            disabled={loading}
            className="btn-primary gap-2 disabled:opacity-40"
          >
            <FileSearch className="h-4 w-4" />
            Analyze This Exam
          </button>
        )}
      </div>

      {errorText && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {errorText}
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto pb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
              msg.role === 'assistant' ? 'bg-blue-100' : 'bg-slate-200'
            }`}>
              {msg.role === 'assistant'
                ? <Bot className="h-4 w-4 text-blue-600" />
                : <User className="h-4 w-4 text-slate-600" />}
            </div>
            <div className={`max-w-2xl rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'assistant'
                ? 'border border-slate-200 bg-white text-slate-800'
                : 'bg-blue-600 text-white'
            }`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
              <Bot className="h-4 w-4 text-blue-600" />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-2 w-2 rounded-full bg-blue-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="Ask your doubt here... (Press Enter to send)"
          className="flex-1 resize-none border-0 text-sm text-slate-800 outline-none placeholder-slate-400"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          className="btn-primary flex-shrink-0 px-3 py-2 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
