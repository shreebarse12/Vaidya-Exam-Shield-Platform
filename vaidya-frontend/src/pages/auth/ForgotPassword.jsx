import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '@/api/authApi'
import { Shield, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState('email') // 'email' | 'reset'
  const [email, setEmailVal] = useState('')
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm()

  async function sendOTP({ email: e }) {
    setLoading(true)
    try {
      await authApi.forgotPassword({ email: e })
      setEmailVal(e)
      toast.success('OTP sent if this email is registered.')
      setStep('reset')
    } catch {
      toast.error('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  async function resetPassword({ otp, new_password }) {
    setLoading(true)
    try {
      await authApi.resetPassword({ email, otp, new_password })
      toast.success('Password reset! Please log in.')
      navigate('/login')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Reset failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {step === 'email' ? 'Forgot password' : 'Reset password'}
            </h1>
            <p className="text-sm text-slate-500">
              {step === 'email' ? 'Enter your email to receive an OTP' : `OTP sent to ${email}`}
            </p>
          </div>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleSubmit(sendOTP)} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                {...register('email', { required: 'Email required' })}
                className={`input ${errors.email ? 'input-error' : ''}`}
                placeholder="you@example.com"
              />
              {errors.email && <p className="error-text">{errors.email.message}</p>}
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit(resetPassword)} className="space-y-4">
            <div>
              <label className="label">OTP</label>
              <input
                {...register('otp', { required: 'OTP required', minLength: { value: 6, message: 'Enter 6-digit OTP' } })}
                className={`input tracking-widest text-center text-lg ${errors.otp ? 'input-error' : ''}`}
                placeholder="000000"
                maxLength={6}
              />
              {errors.otp && <p className="error-text">{errors.otp.message}</p>}
            </div>
            <div>
              <label className="label">New password</label>
              <input
                type="password"
                {...register('new_password', { required: 'Password required', minLength: { value: 8, message: 'Min 8 chars' } })}
                className={`input ${errors.new_password ? 'input-error' : ''}`}
                placeholder="Min 8 chars, 1 upper, 1 number, 1 special"
              />
              {errors.new_password && <p className="error-text">{errors.new_password.message}</p>}
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? 'Resetting...' : 'Reset password'}
            </button>
            <button type="button" onClick={() => setStep('email')}
              className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-700">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          </form>
        )}

        <p className="text-center text-sm text-slate-500 mt-6">
          <Link to="/login" className="text-blue-600 hover:underline">Back to login</Link>
        </p>
      </div>
    </div>
  )
}