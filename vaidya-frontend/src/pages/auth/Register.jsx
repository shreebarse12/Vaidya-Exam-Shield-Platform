import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { registerThunk, selectAuthLoading, selectAuthError, clearError } from '@/store/authSlice'
import { Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { useEffect } from 'react'
import BrandLogo from '@/components/shared/BrandLogo'

export default function Register() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const loading  = useSelector(selectAuthLoading)
  const error    = useSelector(selectAuthError)
  const [showPwd, setShowPwd] = useState(false)

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: { role: 'student' }
  })
  const role = watch('role')

  useEffect(() => {
    if (error) toast.error(error)
    return () => dispatch(clearError())
  }, [error, dispatch])

  async function onSubmit(data) {
    const result = await dispatch(registerThunk(data))
    if (registerThunk.fulfilled.match(result)) {
      toast.success('Account created! Check your email for the OTP.')
      navigate(`/verify-email?email=${encodeURIComponent(data.email)}`)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl dark:shadow-2xl dark:border dark:border-gray-800 w-full max-w-md p-8">
        <div className="text-center mb-8">
          <BrandLogo className="justify-center" subtitle="Create your account" />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Role selector */}
          <div>
            <label className="label">I am a</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'student',         label: 'Student' },
                { value: 'faculty',         label: 'Faculty' },
                { value: 'institute_admin', label: 'Institute' },
              ].map((r) => (
                <label
                  key={r.value}
                  className={`flex items-center justify-center py-2 rounded-lg border text-sm font-medium cursor-pointer transition-colors ${
                    role === r.value
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-400 hover:border-blue-300 dark:hover:border-blue-600'
                  }`}
                >
                  <input type="radio" {...register('role')} value={r.value} className="sr-only" />
                  {r.label}
                </label>
              ))}
            </div>
          </div>

          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">First name</label>
              <input
                {...register('first_name', { required: 'Required' })}
                className={`input ${errors.first_name ? 'input-error' : ''}`}
                placeholder="Rahul"
              />
              {errors.first_name && <p className="error-text">{errors.first_name.message}</p>}
            </div>
            <div>
              <label className="label">Last name</label>
              <input
                {...register('last_name', { required: 'Required' })}
                className={`input ${errors.last_name ? 'input-error' : ''}`}
                placeholder="Sharma"
              />
              {errors.last_name && <p className="error-text">{errors.last_name.message}</p>}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="label">Email address</label>
            <input
              type="email"
              {...register('email', { required: 'Email is required' })}
              className={`input ${errors.email ? 'input-error' : ''}`}
              placeholder="you@example.com"
            />
            {errors.email && <p className="error-text">{errors.email.message}</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="label">Phone <span className="text-slate-400">(optional)</span></label>
            <input
              type="tel"
              {...register('phone')}
              className="input"
              placeholder="+91 9876543210"
            />
          </div>

          {/* Institute name — only for institute_admin */}
          {role === 'institute_admin' && (
            <div>
              <label className="label">Institute name</label>
              <input
                {...register('institute_name', { required: role === 'institute_admin' ? 'Required for institutes' : false })}
                className={`input ${errors.institute_name ? 'input-error' : ''}`}
                placeholder="ABC Coaching Institute"
              />
              {errors.institute_name && <p className="error-text">{errors.institute_name.message}</p>}
            </div>
          )}

          {/* Password */}
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                {...register('password', {
                  required: 'Password is required',
                  minLength: { value: 8, message: 'At least 8 characters' },
                })}
                className={`input pr-10 ${errors.password ? 'input-error' : ''}`}
                placeholder="Min 8 chars, 1 upper, 1 number, 1 special"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="error-text">{errors.password.message}</p>}
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        {role === 'institute_admin' && (
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Institute registrations require Super Admin approval before you can log in.
            </p>
          </div>
        )}

        <p className="text-center text-sm text-slate-500 dark:text-gray-400 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
