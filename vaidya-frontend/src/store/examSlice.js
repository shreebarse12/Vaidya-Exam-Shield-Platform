import { createSlice } from '@reduxjs/toolkit'

/**
 * examSlice holds ALL state during an active exam.
 * This is the most critical piece of frontend state.
 *
 * When the student is taking an exam, this slice tracks:
 * - All questions
 * - All answers (saved here + synced to server every 30s)
 * - Timer state per section
 * - Current question index
 * - Proctoring flag count
 * - "Marked for review" set
 */

const examSlice = createSlice({
  name: 'exam',
  initialState: {
    // Active exam metadata
    attemptId:       null,
    examId:          null,
    examName:        '',
    durationSeconds: 0,
    sections:        [],
    config:          {},
    startedAt:       null,

    // Questions (no correct answers)
    questions:       [],          // [{id, question_text, options, ...}]
    currentIndex:    0,           // which question student is viewing

    // Answers: {questionId: selectedOption or null}
    answers:         {},

    // Marked for review: Set stored as array for Redux serialization
    markedForReview: [],

    // Timer
    timeRemainingSeconds: 0,
    currentSection:       null,

    // Status
    isSubmitted:     false,
    isSubmitting:    false,
    result:          null,        // filled after submission

    // Proctoring
    proctoringFlags: 0,
    tabSwitchCount:  0,
  },
  reducers: {
    // Called when student clicks "Start Exam"
    initExam(state, action) {
      const { attempt_id, exam_id, exam_name, duration_seconds,
              sections, questions, config, started_at, saved_answers } = action.payload

      state.attemptId          = attempt_id
      state.examId             = exam_id
      state.examName           = exam_name
      state.durationSeconds    = duration_seconds
      state.sections           = sections
      state.questions          = questions
      state.config             = config
      state.startedAt          = started_at
      state.currentIndex       = 0
      state.timeRemainingSeconds = duration_seconds
      state.isSubmitted        = false
      state.isSubmitting       = false
      state.result             = null
      state.proctoringFlags    = 0
      state.tabSwitchCount     = 0
      state.markedForReview    = []

      // Restore saved answers if resuming
      state.answers = saved_answers || {}

      // Set first section
      if (sections && sections.length > 0) {
        state.currentSection = sections[0].name
      }
    },

    // Student selects an answer option
    setAnswer(state, action) {
      const { questionId, answer } = action.payload
      state.answers[questionId] = answer
    },

    // Clear answer for a question
    clearAnswer(state, action) {
      state.answers[action.payload] = null
    },

    // Navigate to a specific question by index
    goToQuestion(state, action) {
      state.currentIndex = action.payload
    },

    goToNext(state) {
      if (state.currentIndex < state.questions.length - 1) {
        state.currentIndex += 1
      }
    },

    goToPrev(state) {
      if (state.currentIndex > 0) {
        state.currentIndex -= 1
      }
    },

    // Toggle "mark for review"
    toggleMarkForReview(state, action) {
      const qId = action.payload
      const idx = state.markedForReview.indexOf(qId)
      if (idx === -1) {
        state.markedForReview.push(qId)
      } else {
        state.markedForReview.splice(idx, 1)
      }
    },

    // Timer tick — called every second
    tickTimer(state) {
      if (state.timeRemainingSeconds > 0) {
        state.timeRemainingSeconds -= 1
      }
    },

    // Sync timer from server (WebSocket timer:sync event)
    syncTimer(state, action) {
      state.timeRemainingSeconds = action.payload
    },

    setCurrentSection(state, action) {
      state.currentSection = action.payload
    },

    // Proctoring events
    incrementProctoringFlag(state) {
      state.proctoringFlags += 1
    },

    incrementTabSwitch(state) {
      state.tabSwitchCount += 1
    },

    setSubmitting(state, action) {
      state.isSubmitting = action.payload
    },

    setResult(state, action) {
      state.isSubmitted  = true
      state.isSubmitting = false
      state.result       = action.payload
    },

    // Reset everything when exam ends
    resetExam(state) {
      state.attemptId          = null
      state.examId             = null
      state.examName           = ''
      state.questions          = []
      state.answers            = {}
      state.markedForReview    = []
      state.currentIndex       = 0
      state.isSubmitted        = false
      state.isSubmitting       = false
      state.result             = null
      state.proctoringFlags    = 0
      state.tabSwitchCount     = 0
    },
  },
})

export const {
  initExam, setAnswer, clearAnswer,
  goToQuestion, goToNext, goToPrev,
  toggleMarkForReview, tickTimer, syncTimer,
  setCurrentSection, incrementProctoringFlag,
  incrementTabSwitch, setSubmitting, setResult, resetExam,
} = examSlice.actions

// Selectors
export const selectAttemptId       = (s) => s.exam.attemptId
export const selectExamName        = (s) => s.exam.examName
export const selectQuestions       = (s) => s.exam.questions
export const selectCurrentQuestion = (s) => s.exam.questions[s.exam.currentIndex]
export const selectCurrentIndex    = (s) => s.exam.currentIndex
export const selectAnswers         = (s) => s.exam.answers
export const selectMarkedForReview = (s) => s.exam.markedForReview
export const selectTimeRemaining   = (s) => s.exam.timeRemainingSeconds
export const selectExamResult      = (s) => s.exam.result
export const selectIsSubmitted     = (s) => s.exam.isSubmitted
export const selectIsSubmitting    = (s) => s.exam.isSubmitting
export const selectProctoringFlags = (s) => s.exam.proctoringFlags
export const selectTabSwitchCount  = (s) => s.exam.tabSwitchCount

export default examSlice.reducer