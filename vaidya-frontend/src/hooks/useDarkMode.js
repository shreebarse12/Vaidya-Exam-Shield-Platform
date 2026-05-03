// FILE: src/hooks/useDarkMode.js
import { useState, useEffect } from 'react'

const STORAGE_KEY = 'vaidya-theme'

export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    // 1. Check localStorage for saved preference
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'dark') return true
    if (saved === 'light') return false
    // 2. Fall back to system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const root = document.documentElement
    if (isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light')
  }, [isDark])

  // Listen for system preference changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => {
      // Only auto-switch if user hasn't set a manual preference
      if (!localStorage.getItem(STORAGE_KEY)) {
        setIsDark(e.matches)
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const toggle = () => setIsDark((prev) => !prev)

  return { isDark, toggle }
}
