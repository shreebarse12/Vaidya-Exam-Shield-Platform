import clsx from 'clsx'

function CrestMark({ className }) {
  return (
    <svg viewBox="0 0 160 160" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="crestFill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>
      </defs>

      <path
        d="M57 22l8 12 15-10 15 10 8-12 6 24H51l6-24zm15 9l8-6 8 6-3 6H75l-3-6z"
        fill="url(#crestFill)"
      />
      <path
        d="M48 48c-17 12-28 32-28 53 0 25 15 46 39 57"
        fill="none"
        stroke="url(#crestFill)"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M112 48c17 12 28 32 28 53 0 25-15 46-39 57"
        fill="none"
        stroke="url(#crestFill)"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M44 64l-10 16m17-4L38 97m22-8l-12 23m25-10l-9 24"
        fill="none"
        stroke="url(#crestFill)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M116 64l10 16m-17-4 13 21m-22-8 12 23m-25-10 9 24"
        fill="none"
        stroke="url(#crestFill)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M60 121c7 10 33 10 40 0"
        fill="none"
        stroke="url(#crestFill)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <text
        x="80"
        y="98"
        textAnchor="middle"
        fill="url(#crestFill)"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="46"
        fontWeight="700"
      >
        VT
      </text>
    </svg>
  )
}

export default function BrandLogo({
  className,
  compact = false,
  light = false,
  subtitle,
}) {
  const titleColor = light ? 'text-white' : 'text-slate-900'
  const subColor = light ? 'text-slate-300' : 'text-slate-500'

  return (
    <div className={clsx('flex items-center gap-3', className)}>
      <div className={clsx(
        'flex items-center justify-center rounded-2xl border shadow-lg',
        light ? 'border-white/20 bg-slate-950' : 'border-slate-200 bg-slate-950',
        compact ? 'h-12 w-12' : 'h-20 w-20'
      )}>
        <CrestMark className={compact ? 'h-10 w-10' : 'h-16 w-16'} />
      </div>

      <div className={compact ? 'min-w-0' : ''}>
        <p className={clsx(
          'font-semibold tracking-[0.22em] uppercase',
          titleColor,
          compact ? 'text-[11px]' : 'text-sm'
        )}>
          Vaidya Technoserve
        </p>
        {!compact && (
          <p className={clsx('mt-1 text-xs uppercase tracking-[0.35em]', subColor)}>
            Exam Shield Platform
          </p>
        )}
        {subtitle ? (
          <p className={clsx('mt-1 text-xs', subColor)}>{subtitle}</p>
        ) : null}
      </div>
    </div>
  )
}
