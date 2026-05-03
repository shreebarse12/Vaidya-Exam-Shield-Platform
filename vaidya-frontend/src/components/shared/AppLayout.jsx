// FILE: src/components/shared/AppLayout.jsx
import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { selectUser, logout } from '@/store/authSlice'
import { useDarkMode } from '@/hooks/useDarkMode'
import NotificationCenter from '@/components/shared/NotificationCenter'
import BrandLogo from '@/components/shared/BrandLogo'
import clsx from 'clsx'
import {
  LayoutDashboard, BookOpen, FileText, BarChart3, Brain,
  Settings, Users, Building2, CreditCard, Palette, Eye,
  Shield, Globe, ClipboardList, LogOut, Menu, X, Sun, Moon,
  GraduationCap,
} from 'lucide-react'

// ── Navigation config per role ────────────────────────────────────────────────
const NAV = {
  student: [
    { to: '/student/dashboard', label: 'Dashboard',     icon: LayoutDashboard },
    { to: '/student/analytics', label: 'My Analytics',   icon: BarChart3 },
    { to: '/student/doubt',     label: 'AI Doubt Solver', icon: Brain },
    { to: '/student/results',   label: 'Results',        icon: FileText },
    { to: '/student/practice',  label: 'Practice',       icon: GraduationCap },
  ],
  faculty: [
    { to: '/faculty/dashboard',     label: 'Dashboard',     icon: LayoutDashboard },
    { to: '/faculty/questions',     label: 'Question Bank', icon: BookOpen },
    { to: '/faculty/exams/create',  label: 'Create Exam',   icon: FileText },
    { to: '/faculty/analytics',     label: 'Analytics',     icon: BarChart3 },
  ],
  institute_admin: [
    { to: '/admin/dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
    { to: '/admin/faculty',     label: 'Faculty',     icon: Users },
    { to: '/admin/students',    label: 'Students',    icon: Users },
    { to: '/admin/batches',     label: 'Batches',     icon: Building2 },
    { to: '/admin/proctoring',  label: 'Proctoring',  icon: Eye },
    { to: '/admin/subscription',label: 'Subscription',icon: CreditCard },
    { to: '/admin/branding',    label: 'Branding',    icon: Palette },
  ],
  super_admin: [
    { to: '/super-admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/super-admin/tenants',   label: 'Tenants',   icon: Building2 },
    { to: '/super-admin/users',     label: 'Users',     icon: Users },
    { to: '/super-admin/qbank',     label: 'Global QBank', icon: Globe },
    { to: '/super-admin/audit',     label: 'Audit Logs',  icon: ClipboardList },
  ],
}

export default function AppLayout() {
  const user = useSelector(selectUser)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { isDark, toggle: toggleTheme } = useDarkMode()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const links = NAV[user?.role] || []

  function handleLogout() {
    dispatch(logout())
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex bg-slate-100 dark:bg-gray-950 transition-colors duration-300">
      {/* ── Mobile backdrop ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r border-slate-200 dark:border-gray-800 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-label="Sidebar navigation"
      >
        {/* Logo + close */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-gray-800">
          <BrandLogo compact />
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5 text-slate-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Main navigation">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              <link.icon className="w-5 h-5 flex-shrink-0" />
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar footer: theme toggle + logout */}
        <div className="p-3 border-t border-slate-200 dark:border-gray-800 space-y-1">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle dark mode"
          >
            {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
            {isDark ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Log Out
          </button>
        </div>
      </aside>

      {/* ── Main content area ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top navbar */}
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-gray-800">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3">
            <div className="flex items-center gap-3">
              {/* Hamburger — mobile only */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Open sidebar"
                aria-expanded={sidebarOpen}
                aria-controls="sidebar-nav"
              >
                <Menu className="w-5 h-5 text-slate-600 dark:text-gray-300" />
              </button>
              <h2 className="text-sm font-medium text-slate-500 dark:text-gray-400 hidden sm:block">
                {user?.full_name || user?.email || ''}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <NotificationCenter />
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-gray-800 rounded-xl text-xs text-slate-600 dark:text-gray-400">
                <Shield className="w-3.5 h-3.5" />
                {user?.role?.replace('_', ' ')}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
