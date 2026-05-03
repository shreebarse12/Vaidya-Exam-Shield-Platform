// FILE: src/components/shared/NotificationCenter.jsx
import { useState, useRef, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Bell, Check, Trash2, PartyPopper } from 'lucide-react'
import { selectNotifications, selectUnreadCount, markAsRead, markAllAsRead, clearAll } from '@/store/notificationSlice'
import clsx from 'clsx'

function timeAgo(dateStr) {
  const now = Date.now()
  const diff = now - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const typeIcons = {
  success: '✅',
  warning: '⚠️',
  info:    '🔔',
  exam:    '📝',
  rank:    '🏆',
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const dispatch = useDispatch()
  const items = useSelector(selectNotifications)
  const unread = useSelector(selectUnreadCount)

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="relative p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-slate-600 dark:text-gray-300" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[380px] max-h-[480px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-gray-700 flex flex-col z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-gray-700">
            <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
              Notifications {unread > 0 && <span className="text-blue-500 ml-1">({unread})</span>}
            </h3>
            <div className="flex gap-1">
              {unread > 0 && (
                <button
                  onClick={() => dispatch(markAllAsRead())}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <Check className="w-3 h-3" /> Mark all read
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="py-12 text-center">
                <PartyPopper className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-gray-600" />
                <p className="text-sm text-slate-500 dark:text-gray-400">No notifications yet 🎉</p>
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => dispatch(markAsRead(n.id))}
                  className={clsx(
                    'w-full flex items-start gap-3 px-4 py-3 text-left border-b border-slate-100 dark:border-gray-700/50 hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors',
                    !n.read && 'bg-blue-50/50 dark:bg-blue-900/10'
                  )}
                >
                  <span className="text-lg flex-shrink-0 mt-0.5">
                    {typeIcons[n.type] || n.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={clsx(
                      'text-sm leading-snug',
                      n.read ? 'text-slate-600 dark:text-gray-400' : 'text-slate-900 dark:text-white font-medium'
                    )}>
                      {n.title}
                    </p>
                    {n.message && (
                      <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                    )}
                    <p className="text-[10px] text-slate-400 dark:text-gray-600 mt-1">{timeAgo(n.timestamp)}</p>
                  </div>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-200 dark:border-gray-700">
              <button
                onClick={() => dispatch(clearAll())}
                className="text-xs text-red-500 hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
