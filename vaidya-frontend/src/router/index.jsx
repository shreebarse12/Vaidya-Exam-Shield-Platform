// FILE: src/router/index.jsx
import React, { Suspense } from 'react'

// ── Role → Dashboard mapping (used by Login page) ────────────────────────────
const ROLE_HOME = {
  student: '/student/dashboard',
  faculty: '/faculty/dashboard',
  institute_admin: '/admin/dashboard',
  super_admin: '/super-admin/dashboard',
}
export const getRoleHome = (role) => ROLE_HOME[role] || '/login'
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectUser } from '@/store/authSlice'
import { AnimatePresence } from 'framer-motion'

import AppLayout from '@/components/shared/AppLayout'
import ErrorBoundary from '@/components/shared/ErrorBoundary'
import PageLoadingSpinner from '@/components/shared/PageLoadingSpinner'
import PageTransition from '@/components/shared/PageTransition'

// ── Lazy-loaded pages ────────────────────────────────────────────────────────
// Public
const Landing        = React.lazy(() => import('@/pages/Landing'))
const NotFound       = React.lazy(() => import('@/pages/NotFound'))

// Auth
const Login          = React.lazy(() => import('@/pages/auth/Login'))
const Register       = React.lazy(() => import('@/pages/auth/Register'))
const VerifyOTP      = React.lazy(() => import('@/pages/auth/VerifyOTP'))
const ForgotPassword = React.lazy(() => import('@/pages/auth/ForgotPassword'))

// Student
const StudentDashboard  = React.lazy(() => import('@/pages/student/Dashboard'))
const StudentAnalytics  = React.lazy(() => import('@/pages/student/Analytics'))
const AiDoubtSolver     = React.lazy(() => import('@/pages/student/AiDoubtSolver'))
const ExamInterface     = React.lazy(() => import('@/pages/student/ExamInterface'))
const ExamResults       = React.lazy(() => import('@/pages/student/ExamResults'))
const Practice          = React.lazy(() => import('@/pages/student/Practice'))
const Results           = React.lazy(() => import('@/pages/student/Results'))

// Faculty
const FacultyDashboard  = React.lazy(() => import('@/pages/faculty/Dashboard'))
const QuestionBank      = React.lazy(() => import('@/pages/faculty/QuestionBank'))
const ExamCreate        = React.lazy(() => import('@/pages/faculty/ExamCreate'))
const FacultyAnalytics  = React.lazy(() => import('@/pages/faculty/Analytics'))

// Institute Admin
const AdminDashboard    = React.lazy(() => import('@/pages/institute-admin/Dashboard'))
const AdminFaculty      = React.lazy(() => import('@/pages/institute-admin/Faculty'))
const AdminStudents     = React.lazy(() => import('@/pages/institute-admin/Students'))
const AdminBatches      = React.lazy(() => import('@/pages/institute-admin/Batches'))
const ProctoringReview  = React.lazy(() => import('@/pages/institute-admin/ProctoringReview'))
const Subscription      = React.lazy(() => import('@/pages/institute-admin/Subscription'))
const Branding          = React.lazy(() => import('@/pages/institute-admin/Branding'))

// Super Admin
const SuperDashboard    = React.lazy(() => import('@/pages/super-admin/Dashboard'))
const Tenants           = React.lazy(() => import('@/pages/super-admin/Tenants'))
const Users             = React.lazy(() => import('@/pages/super-admin/Users'))
const GlobalQBank       = React.lazy(() => import('@/pages/super-admin/GlobalQBank'))
const AuditLogs         = React.lazy(() => import('@/pages/super-admin/AuditLogs'))


// ── Route guards ─────────────────────────────────────────────────────────────

/** Only renders children if user is NOT logged in */
function GuestOnly() {
  const user = useSelector(selectUser)
  if (user) return <RoleRedirect role={user.role} />
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PageTransition><Outlet /></PageTransition>
    </Suspense>
  )
}

/** Only renders children if user IS logged in */
function RequireAuth({ allowedRoles }) {
  const user = useSelector(selectUser)
  if (!user) return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <RoleRedirect role={user.role} />
  }
  return <Outlet />
}

/** Layout wrapper that adds Suspense + PageTransition around Outlet */
function LayoutWithTransition() {
  return (
    <AppLayout>
      <Suspense fallback={<PageLoadingSpinner />}>
        <PageTransition><Outlet /></PageTransition>
      </Suspense>
    </AppLayout>
  )
}

/** Redirects authenticated users to their role-based dashboard */
function RoleRedirect({ role }) {
  const map = {
    student: '/student/dashboard',
    faculty: '/faculty/dashboard',
    institute_admin: '/admin/dashboard',
    super_admin: '/super-admin/dashboard',
  }
  return <Navigate to={map[role] || '/login'} replace />
}

// ── Router definition ────────────────────────────────────────────────────────
export const router = createBrowserRouter([
  // Public landing
  {
    path: '/',
    element: (
      <Suspense fallback={<PageLoadingSpinner />}>
        <Landing />
      </Suspense>
    ),
  },

  // Auth pages (guest only)
  {
    element: <GuestOnly />,
    children: [
      { path: '/login',           element: <Login /> },
      { path: '/register',        element: <Register /> },
      { path: '/verify-otp',      element: <VerifyOTP /> },
      { path: '/forgot-password', element: <ForgotPassword /> },
    ],
  },

  // Exam interface (full-screen, no sidebar)
  {
    element: <RequireAuth allowedRoles={['student']} />,
    children: [
      {
        path: '/exam/:examId',
        element: (
          <ErrorBoundary>
            <Suspense fallback={<PageLoadingSpinner />}>
              <ExamInterface />
            </Suspense>
          </ErrorBoundary>
        ),
      },
      {
        path: '/exam/results/:attemptId',
        element: (
          <Suspense fallback={<PageLoadingSpinner />}>
            <ExamResults />
          </Suspense>
        ),
      },
    ],
  },

  // Student pages (inside layout)
  {
    element: <RequireAuth allowedRoles={['student']} />,
    children: [
      {
        element: <LayoutWithTransition />,
        children: [
          { path: '/student/dashboard', element: <StudentDashboard /> },
          { path: '/student/analytics', element: <StudentAnalytics /> },
          { path: '/student/doubt',     element: <AiDoubtSolver /> },
          { path: '/student/practice',  element: <Practice /> },
          { path: '/student/results',   element: <Results /> },
        ],
      },
    ],
  },

  // Faculty pages
  {
    element: <RequireAuth allowedRoles={['faculty']} />,
    children: [
      {
        element: <LayoutWithTransition />,
        children: [
          { path: '/faculty/dashboard',    element: <FacultyDashboard /> },
          { path: '/faculty/questions',    element: <QuestionBank /> },
          { path: '/faculty/exams/create', element: <ExamCreate /> },
          { path: '/faculty/analytics',    element: <FacultyAnalytics /> },
        ],
      },
    ],
  },

  // Institute Admin pages
  {
    element: <RequireAuth allowedRoles={['institute_admin']} />,
    children: [
      {
        element: <LayoutWithTransition />,
        children: [
          { path: '/admin/dashboard',   element: <AdminDashboard /> },
          { path: '/admin/faculty',     element: <AdminFaculty /> },
          { path: '/admin/students',    element: <AdminStudents /> },
          { path: '/admin/batches',     element: <AdminBatches /> },
          { path: '/admin/proctoring',  element: <ProctoringReview /> },
          { path: '/admin/subscription',element: <Subscription /> },
          { path: '/admin/branding',    element: <Branding /> },
        ],
      },
    ],
  },

  // Super Admin pages
  {
    element: <RequireAuth allowedRoles={['super_admin']} />,
    children: [
      {
        element: <LayoutWithTransition />,
        children: [
          { path: '/super-admin/dashboard', element: <SuperDashboard /> },
          { path: '/super-admin/tenants',   element: <Tenants /> },
          { path: '/super-admin/users',     element: <Users /> },
          { path: '/super-admin/qbank',     element: <GlobalQBank /> },
          { path: '/super-admin/audit',     element: <AuditLogs /> },
        ],
      },
    ],
  },

  // Catch-all 404
  {
    path: '*',
    element: (
      <Suspense fallback={<PageLoadingSpinner />}>
        <NotFound />
      </Suspense>
    ),
  },
])