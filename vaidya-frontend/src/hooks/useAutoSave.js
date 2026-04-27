import { useEffect, useRef } from 'react'
import { examApi } from '@/api/examApi'

/**
 * Auto-saves exam answers every 30 seconds.
 * Also saves to localStorage as a fallback (in case of network failure).
 */
export function useAutoSave({ attemptId, answers, enabled = true }) {
  const saveRef    = useRef(null)
  const answersRef = useRef(answers)

  // Keep a ref to latest answers so the interval always uses fresh data
  answersRef.current = answers

  useEffect(() => {
    if (!enabled || !attemptId) return

    async function save() {
      const currentAnswers = answersRef.current

      // 1. Save to localStorage immediately (instant, always works)
      localStorage.setItem(`exam_answers_${attemptId}`, JSON.stringify(currentAnswers))

      // 2. Sync to server
      try {
        await examApi.saveAnswers({ attempt_id: attemptId, answers: currentAnswers })
      } catch (err) {
        // Network issue — localStorage backup will be used on resume
        console.warn('[AutoSave] Server sync failed, answers saved locally:', err.message)
      }
    }

    // Save every 30 seconds
    saveRef.current = setInterval(save, 30000)

    // Also save immediately on mount (in case of page refresh resume)
    save()

    return () => clearInterval(saveRef.current)
  }, [attemptId, enabled])

  // Expose a manual save trigger for when student answers a question
  function saveNow() {
    localStorage.setItem(`exam_answers_${attemptId}`, JSON.stringify(answersRef.current))
  }

  return { saveNow }
}