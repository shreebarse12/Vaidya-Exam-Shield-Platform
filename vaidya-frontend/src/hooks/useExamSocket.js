import { useEffect, useRef, useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { incrementProctoringFlag, incrementTabSwitch } from '@/store/examSlice'
import toast from 'react-hot-toast'

/**
 * Custom hook that manages the proctoring WebSocket connection.
 *
 * Handles:
 * - Connection and reconnection
 * - Sending camera frames (every 1s)
 * - Sending audio chunks (every 10s)
 * - Sending tab-switch events
 * - Receiving flags and warnings from server
 * - Auto-submit signal from server
 */
export function useExamSocket({ attemptId, onAutoSubmit }) {
  const dispatch    = useDispatch()
  const wsRef       = useRef(null)
  const reconnectRef= useRef(null)
  const pingRef     = useRef(null)

  const token = localStorage.getItem('access_token')

  // Send a message to the server
  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  // Send a camera frame for proctoring analysis
  const sendFrame = useCallback((frameBase64) => {
    send({
      type: 'face_frame',
      frame: frameBase64,
      timestamp: new Date().toISOString(),
    })
  }, [send])

  // Send audio chunk for keyword detection
  const sendAudio = useCallback((audioBase64) => {
    send({
      type: 'audio_chunk',
      audio: audioBase64,
      timestamp: new Date().toISOString(),
    })
  }, [send])

  // Report tab switch to server
  const reportTabSwitch = useCallback(() => {
    dispatch(incrementTabSwitch())
    send({ type: 'tab_switch', timestamp: new Date().toISOString() })
  }, [dispatch, send])

  // Report fullscreen exit
  const reportFullscreenExit = useCallback(() => {
    send({ type: 'fullscreen_exit', timestamp: new Date().toISOString() })
  }, [send])

  useEffect(() => {
    if (!attemptId || !token) return

    function connect() {
      const wsUrl = `${import.meta.env.VITE_WS_URL || 'ws://localhost:8000'}/api/v1/proctoring/ws/${attemptId}?token=${token}`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[Proctoring] WebSocket connected')
        // Keep-alive ping every 30 seconds
        pingRef.current = setInterval(() => send({ type: 'ping' }), 30000)
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)

          if (msg.type === 'flag') {
            dispatch(incrementProctoringFlag())
            const severity = msg.severity
            const message  = msg.message || 'Proctoring warning'

            if (severity === 'high') {
              toast.error(message, { duration: 6000, icon: '⚠️' })
            } else {
              toast(message, { duration: 4000, icon: '👁️' })
            }
          }

          if (msg.type === 'auto_submit') {
            toast.error(msg.reason, { duration: 8000 })
            // Signal the exam interface to auto-submit
            onAutoSubmit?.()
          }
        } catch {
          // Ignore malformed messages
        }
      }

      ws.onclose = () => {
        console.log('[Proctoring] WebSocket disconnected — reconnecting in 3s...')
        clearInterval(pingRef.current)
        // Reconnect after 3 seconds
        reconnectRef.current = setTimeout(connect, 3000)
      }

      ws.onerror = (err) => {
        console.warn('[Proctoring] WebSocket error:', err)
        ws.close()
      }
    }

    connect()

    // ── Tab visibility change listener ─────────────────────────────────────
    function handleVisibilityChange() {
      if (document.hidden) {
        reportTabSwitch()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // ── Fullscreen exit listener ────────────────────────────────────────────
    function handleFullscreenChange() {
      if (!document.fullscreenElement) {
        reportFullscreenExit()
      }
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      clearInterval(pingRef.current)
      clearTimeout(reconnectRef.current)
      wsRef.current?.close()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [attemptId, token])

  return { sendFrame, sendAudio, reportTabSwitch, reportFullscreenExit }
}