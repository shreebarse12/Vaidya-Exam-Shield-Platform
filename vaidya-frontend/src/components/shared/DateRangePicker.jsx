// FILE: src/components/shared/DateRangePicker.jsx
import { useState } from 'react'
import { Calendar } from 'lucide-react'
import clsx from 'clsx'

const PRESETS = [
  { label: 'Last 7 days',    value: '7d' },
  { label: 'Last 30 days',   value: '30d' },
  { label: 'Last 3 months',  value: '3m' },
  { label: 'All time',       value: 'all' },
]

export default function DateRangePicker({ value = 'all', onChange }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Calendar className="w-4 h-4 text-slate-400 dark:text-gray-500" />
      {PRESETS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange?.(p.value)}
          className={clsx(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            value === p.value
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-600'
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
