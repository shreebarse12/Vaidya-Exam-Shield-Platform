// FILE: src/pages/NotFound.jsx
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { selectUser } from '@/store/authSlice'
import { Home, ArrowLeft } from 'lucide-react'

const roleHome = {
  student: '/student/dashboard',
  faculty: '/faculty/dashboard',
  institute_admin: '/admin/dashboard',
  super_admin: '/super-admin/dashboard',
}

export default function NotFound() {
  const user = useSelector(selectUser)
  const navigate = useNavigate()
  const homePath = user ? (roleHome[user.role] || '/') : '/login'

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full text-center">
        {/* Inline SVG illustration */}
        <svg viewBox="0 0 200 120" className="w-48 h-auto mx-auto mb-8" aria-hidden="true">
          <rect x="10" y="30" width="180" height="80" rx="12" fill="currentColor" className="text-slate-100 dark:text-gray-800" />
          <circle cx="60" cy="60" r="8" fill="currentColor" className="text-blue-300 dark:text-blue-700" />
          <circle cx="140" cy="60" r="8" fill="currentColor" className="text-blue-300 dark:text-blue-700" />
          <path d="M75 85 Q100 75 125 85" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-slate-400 dark:text-gray-500" />
          <rect x="85" y="10" width="30" height="25" rx="4" fill="currentColor" className="text-amber-300 dark:text-amber-600" />
          <line x1="100" y1="35" x2="100" y2="30" stroke="currentColor" strokeWidth="2" className="text-slate-300 dark:text-gray-600" />
        </svg>

        <h1 className="text-7xl font-black text-slate-900 dark:text-white mb-3">404</h1>
        <p className="text-xl font-semibold text-slate-700 dark:text-gray-300 mb-2">
          Oops! This page doesn't exist.
        </p>
        <p className="text-sm text-slate-500 dark:text-gray-400 mb-8">
          The page you're looking for may have been moved or deleted.
        </p>

        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
          <button
            onClick={() => navigate(homePath)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Home className="w-4 h-4" />
            Go Home
          </button>
        </div>
      </div>
    </div>
  )
}
