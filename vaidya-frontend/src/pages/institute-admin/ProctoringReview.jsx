import { useEffect, useState } from 'react'
import { AlertTriangle, Camera, Shield } from 'lucide-react'
import { format } from 'date-fns'

import { instituteApi } from '@/api/instituteApi'
import { PageHeader, Spinner } from '@/components/shared/UI'

function SeverityBadge({ severity }) {
  const classes = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-blue-100 text-blue-700',
  }

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${classes[severity] || 'bg-slate-100 text-slate-700'}`}>
      {severity || 'unknown'}
    </span>
  )
}

export default function ProctoringReview() {
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadFlaggedAttempts() {
      try {
        const res = await instituteApi.listFlaggedAttempts()
        setAttempts(Array.isArray(res.data) ? res.data : [])
      } catch {
        setAttempts([])
      } finally {
        setLoading(false)
      }
    }

    loadFlaggedAttempts()
  }, [])

  if (loading) return <Spinner />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proctoring Review"
        subtitle="Review flagged exam attempts from AI proctoring"
      />

      {attempts.length === 0 ? (
        <div className="card py-16 text-center">
          <Shield className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <h3 className="mb-1 font-semibold text-slate-700">No flagged attempts</h3>
          <p className="text-sm text-slate-400">
            When AI proctoring detects suspicious activity, attempts will appear here for review.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {attempts.map((attempt) => (
            <div key={attempt.attempt_id} className="card space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{attempt.exam_name}</h3>
                  <p className="text-sm text-slate-500">
                    {attempt.student_name} ({attempt.student_email})
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Submitted {attempt.submitted_at ? format(new Date(attempt.submitted_at), 'dd MMM yyyy, hh:mm a') : 'N/A'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                    Status: {attempt.status}
                  </span>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700">
                    Warnings: {attempt.warning_count}
                  </span>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700">
                    Score: {attempt.percentage != null ? `${attempt.percentage.toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {attempt.logs.map((log) => (
                  <div key={log.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span className="font-medium text-slate-800">{log.event_type}</span>
                        <SeverityBadge severity={log.severity} />
                      </div>

                      <p className="text-xs text-slate-400">
                        {log.timestamp ? format(new Date(log.timestamp), 'dd MMM yyyy, hh:mm:ss a') : 'N/A'}
                      </p>
                    </div>

                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="mt-3 rounded-lg bg-slate-50 p-3">
                        <p className="mb-2 text-xs font-semibold text-slate-600">Detection details</p>
                        <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-slate-600">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>
                    )}

                    {(log.snapshot_url || log.audio_url) && (
                      <div className="mt-3 flex flex-wrap gap-3">
                        {log.snapshot_url && (
                          <a
                            href={log.snapshot_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                          >
                            <Camera className="h-4 w-4" />
                            View snapshot
                          </a>
                        )}
                        {log.audio_url && (
                          <a
                            href={log.audio_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                          >
                            View audio clip
                          </a>
                        )}
                      </div>
                    )}

                    {log.review_note && (
                      <p className="mt-3 text-sm text-slate-600">
                        Review note: {log.review_note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
