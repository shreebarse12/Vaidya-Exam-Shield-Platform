// FILE: src/components/shared/UI.jsx
import { X } from 'lucide-react'
import clsx from 'clsx'

// ── Stat Card ─────────────────────────────────────────────────────────────────
export function StatCard({ label, value, icon: Icon, color = 'blue', sub }) {
  const colors = {
    blue:   { bg: 'bg-blue-50 dark:bg-blue-900/20',   icon: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' },
    green:  { bg: 'bg-green-50 dark:bg-green-900/20',  icon: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', icon: 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', icon: 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400' },
    red:    { bg: 'bg-red-50 dark:bg-red-900/20',    icon: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' },
  }
  const c = colors[color] || colors.blue

  return (
    <div className="card flex items-center gap-4">
      <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', c.icon)}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm text-slate-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{value ?? '—'}</p>
        {sub && <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={clsx('relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full', sizes[size])}>
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500 dark:text-gray-400" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

// ── Page Header ───────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="text-center py-16">
      {Icon && (
        <div className="w-16 h-16 bg-slate-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Icon className="w-8 h-8 text-slate-400 dark:text-gray-500" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">{description}</p>}
      {action}
    </div>
  )
}

// ── Loading Spinner ───────────────────────────────────────────────────────────
export function Spinner({ className = '' }) {
  return (
    <div className={clsx('flex items-center justify-center py-12', className)}>
      <div className="w-8 h-8 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin" />
    </div>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ children, color = 'gray' }) {
  const colors = {
    green:  'badge-green',
    red:    'badge-red',
    yellow: 'badge-yellow',
    blue:   'badge-blue',
    gray:   'badge-gray',
  }
  return <span className={clsx('badge', colors[color] || 'badge-gray')}>{children}</span>
}