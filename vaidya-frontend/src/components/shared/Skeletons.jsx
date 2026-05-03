// FILE: src/components/shared/Skeletons.jsx

// ── Shimmer base ─────────────────────────────────────────────────────────────
function Shimmer({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700 ${className}`} />
}

// ── Dashboard Stat Card Skeleton ──────────────────────────────────────────────
export function DashboardCardSkeleton({ count = 3 }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card flex items-center gap-4">
          <Shimmer className="w-12 h-12 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Shimmer className="h-3 w-20" />
            <Shimmer className="h-6 w-16" />
            <Shimmer className="h-2 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Table Row Skeleton ────────────────────────────────────────────────────────
export function TableRowSkeleton({ rows = 5, cols = 5 }) {
  return (
    <div className="card overflow-hidden">
      {/* Header shimmer */}
      <div className="flex gap-4 p-4 border-b border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800">
        {Array.from({ length: cols }).map((_, i) => (
          <Shimmer key={i} className="h-3 flex-1" />
        ))}
      </div>
      {/* Row shimmers */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 p-4 border-b border-slate-100 dark:border-gray-700/50">
          {Array.from({ length: cols }).map((_, j) => (
            <Shimmer key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Question Card Skeleton ────────────────────────────────────────────────────
export function QuestionCardSkeleton({ count = 6 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card flex items-start gap-3 p-4">
          <Shimmer className="w-5 h-5 rounded flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <Shimmer className="h-4 w-full" />
            <Shimmer className="h-3 w-3/4" />
            <div className="flex gap-2 mt-2">
              <Shimmer className="h-5 w-16 rounded-full" />
              <Shimmer className="h-5 w-12 rounded-full" />
              <Shimmer className="h-5 w-14 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Analytics Chart Skeleton ──────────────────────────────────────────────────
export function AnalyticsChartSkeleton() {
  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <Shimmer className="h-5 w-32" />
        <Shimmer className="h-8 w-28 rounded-lg" />
      </div>
      <div className="flex items-end gap-2 h-48">
        {Array.from({ length: 12 }).map((_, i) => (
          <Shimmer
            key={i}
            className="flex-1 rounded-t"
            style={{ height: `${30 + Math.random() * 70}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Shimmer key={i} className="h-3 w-8" />
        ))}
      </div>
    </div>
  )
}
