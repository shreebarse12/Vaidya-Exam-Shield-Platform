import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { logout, selectUser } from '@/store/authSlice'
import {
  LayoutDashboard, BookOpen, FileText, Users, GraduationCap,
  BarChart3, Shield, Settings, LogOut, ChevronRight, Brain,
  Building2, UserCheck, Layers,
} from 'lucide-react'
import clsx from 'clsx'
import BrandLogo from '@/components/shared/BrandLogo'

// Navigation items per role
const NAV_ITEMS = {
  student: [
    { to: '/student/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
    { to: '/student/analytics',    label: 'My Progress',  icon: BarChart3 },
    { to: '/student/doubt-solver', label: 'AI Doubt Solver', icon: Brain },
  ],
  faculty: [
    { to: '/faculty/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
    { to: '/faculty/questions',    label: 'Question Bank',icon: BookOpen },
    { to: '/faculty/exams/create', label: 'Create Exam',  icon: FileText },
    { to: '/faculty/analytics',    label: 'Analytics',    icon: BarChart3 },
  ],
  institute_admin: [
    { to: '/institute/dashboard',  label: 'Dashboard',    icon: LayoutDashboard },
    { to: '/institute/students',   label: 'Students',     icon: GraduationCap },
    { to: '/institute/faculty',    label: 'Faculty',      icon: UserCheck },
    { to: '/institute/batches',    label: 'Batches',      icon: Layers },
    { to: '/institute/proctoring', label: 'Proctoring',   icon: Shield },
    // Institute admin can also use faculty features
    { to: '/faculty/questions',    label: 'Question Bank',icon: BookOpen },
    { to: '/faculty/exams/create', label: 'Create Exam',  icon: FileText },
  ],
  super_admin: [
    { to: '/admin/dashboard',      label: 'Dashboard',    icon: LayoutDashboard },
    { to: '/admin/tenants',        label: 'Institutes',   icon: Building2 },
    { to: '/admin/users',          label: 'All Users',    icon: Users },
  ],
}

const ROLE_LABELS = {
  student:         'Student Portal',
  faculty:         'Faculty Portal',
  institute_admin: 'Institute Admin',
  super_admin:     'Super Admin',
}

export default function AppLayout({ role }) {
  const dispatch  = useDispatch()
  const navigate  = useNavigate()
  const user      = useSelector(selectUser)
  const navItems  = NAV_ITEMS[role] || []

  function handleLogout() {
    dispatch(logout())
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="border-b border-slate-200 px-4 py-4">
          <BrandLogo compact subtitle={ROLE_LABELS[role]} />
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="p-3 border-t border-slate-200">
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-700 text-xs font-bold">
                {user?.full_name?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900 truncate">
                {user?.full_name || user?.email}
              </div>
              <div className="text-xs text-slate-500 truncate">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
