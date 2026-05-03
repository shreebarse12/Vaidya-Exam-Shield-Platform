// FILE: src/components/shared/PageLoadingSpinner.jsx
export default function PageLoadingSpinner() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <div className="w-10 h-10 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin" />
      <p className="mt-4 text-sm text-slate-500 dark:text-gray-400">Loading…</p>
    </div>
  )
}
