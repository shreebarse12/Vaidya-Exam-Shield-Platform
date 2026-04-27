import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectUser } from '@/store/authSlice'

// Auth pages
import Login          from '@/pages/auth/Login'
import Register       from '@/pages/auth/Register'
import VerifyOTP      from '@/pages/auth/VerifyOTP'
import ForgotPassword from '@/pages/auth/ForgotPassword'

// Student pages
import StudentDashboard from '@/pages/student/Dashboard'
import ExamInterface    from '@/pages/student/ExamInterface'
import ExamResults      from '@/pages/student/ExamResults'
import AiDoubtSolver    from '@/pages/student/AiDoubtSolver'
import StudentAnalytics from '@/pages/student/Analytics'

// Faculty pages
import FacultyDashboard from '@/pages/faculty/Dashboard'
import QuestionBank     from '@/pages/faculty/QuestionBank'
import ExamCreate       from '@/pages/faculty/ExamCreate'
import FacultyAnalytics from '@/pages/faculty/Analytics'

// Institute Admin pages
import InstituteDashboard from '@/pages/institute-admin/Dashboard'
import Students           from '@/pages/institute-admin/Students'
import Faculty            from '@/pages/institute-admin/Faculty'
import Batches            from '@/pages/institute-admin/Batches'
import ProctoringReview   from '@/pages/institute-admin/ProctoringReview'

// Super Admin pages
import AdminDashboard from '@/pages/super-admin/Dashboard'
import AdminTenants   from '@/pages/super-admin/Tenants'
import AdminUsers     from '@/pages/super-admin/Users'

// Layout
import AppLayout from '@/components/shared/AppLayout'

// ── Role home map ─────────────────────────────────────────────────────────────
// Defined once — used by RequireAuth and RoleRedirect
export function getRoleHome(role) {
  switch (role) {
    case 'super_admin':     return '/admin/dashboard'
    case 'institute_admin': return '/institute/dashboard'
    case 'faculty':         return '/faculty/dashboard'
    case 'student':         return '/student/dashboard'
    default:                return '/login'
  }
}

// ── Route Guards ───────────────────────────────────────────────────────────────

/**
 * RequireAuth — wraps any route that needs a logged-in user.
 *
 * Fix: removed navigate() call entirely. <Navigate> component is used instead
 * which renders exactly once per decision — no loop possible.
 */
export function RequireAuth({ children, allowedRoles }) {
  const user = useSelector(selectUser)

  // Not logged in → go to login
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Logged in but wrong role → go to their own home
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getRoleHome(user.role)} replace />
  }

  return children
}

/**
 * RoleRedirect — the "/" route.
 * Sends each role to their home screen.
 * Sends unauthenticated users to /login.
 *
 * Fix: pure declarative <Navigate> — no navigate() hook, no effects.
 */
export function RoleRedirect() {
  const user = useSelector(selectUser)
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={getRoleHome(user.role)} replace />
}

/**
 * GuestOnly — wraps auth pages (login, register).
 * If already logged in, redirects to role home.
 * Prevents the navigate() loop in Login.jsx's useEffect.
 *
 * Fix: Auth pages are now wrapped in GuestOnly so Login never
 * even mounts when user is already logged in — the loop cannot start.
 */
function GuestOnly({ children }) {
  const user = useSelector(selectUser)
  if (user) return <Navigate to={getRoleHome(user.role)} replace />
  return children
}

// ── Router ─────────────────────────────────────────────────────────────────────
export const router = createBrowserRouter([

  // ── Root: role-based redirect ──────────────────────────────────────────
  { path: '/', element: <RoleRedirect /> },

  // ── Public auth routes (GuestOnly = redirect away if already logged in) ─
  {
    path: '/login',
    element: <GuestOnly><Login /></GuestOnly>,
  },
  {
    path: '/register',
    element: <GuestOnly><Register /></GuestOnly>,
  },
  {
    path: '/verify-email',
    element: <GuestOnly><VerifyOTP /></GuestOnly>,
  },
  {
    // Forgot password is accessible even while logged in (edge case)
    path: '/forgot-password',
    element: <ForgotPassword />,
  },

  // ── Student routes ──────────────────────────────────────────────────────
  {
    path: '/student',
    element: (
      <RequireAuth allowedRoles={['student']}>
        <AppLayout role="student" />
      </RequireAuth>
    ),
    children: [
      { index: true,              element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard',        element: <StudentDashboard /> },
      { path: 'analytics',        element: <StudentAnalytics /> },
      { path: 'doubt-solver',     element: <AiDoubtSolver /> },
    ],
  },

  // Exam interface: fullscreen, no AppLayout shell
  {
    path: '/exam/:examId',
    element: (
      <RequireAuth allowedRoles={['student']}>
        <ExamInterface />
      </RequireAuth>
    ),
  },
  {
    path: '/exam/results/:attemptId',
    element: (
      <RequireAuth allowedRoles={['student']}>
        <ExamResults />
      </RequireAuth>
    ),
  },

  // ── Faculty routes ──────────────────────────────────────────────────────
  {
    path: '/faculty',
    element: (
      <RequireAuth allowedRoles={['faculty', 'institute_admin', 'super_admin']}>
        <AppLayout role="faculty" />
      </RequireAuth>
    ),
    children: [
      { index: true,              element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard',        element: <FacultyDashboard /> },
      { path: 'questions',        element: <QuestionBank /> },
      { path: 'exams/create',     element: <ExamCreate /> },
      { path: 'analytics',        element: <FacultyAnalytics /> },
    ],
  },

  // ── Institute Admin routes ──────────────────────────────────────────────
  {
    path: '/institute',
    element: (
      <RequireAuth allowedRoles={['institute_admin', 'super_admin']}>
        <AppLayout role="institute_admin" />
      </RequireAuth>
    ),
    children: [
      { index: true,              element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard',        element: <InstituteDashboard /> },
      { path: 'students',         element: <Students /> },
      { path: 'faculty',          element: <Faculty /> },
      { path: 'batches',          element: <Batches /> },
      { path: 'proctoring',       element: <ProctoringReview /> },
    ],
  },

  // ── Super Admin routes ──────────────────────────────────────────────────
  {
    path: '/admin',
    element: (
      <RequireAuth allowedRoles={['super_admin']}>
        <AppLayout role="super_admin" />
      </RequireAuth>
    ),
    children: [
      { index: true,              element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard',        element: <AdminDashboard /> },
      { path: 'tenants',          element: <AdminTenants /> },
      { path: 'users',            element: <AdminUsers /> },
    ],
  },

  // ── 404 fallback ────────────────────────────────────────────────────────
  {
    path: '*',
    element: <RoleRedirect />,
  },
])