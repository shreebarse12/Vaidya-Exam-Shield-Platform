import { useState, useRef } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { authApi } from '@/api/authApi'
import { Shield } from 'lucide-react'
import toast from 'react-hot-toast'

export default function VerifyOTP() {
  const [searchParams] = useSearchParams()
  const navigate  = useNavigate()
  const email     = searchParams.get('email') || ''
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const inputs = useRef([])

  function handleChange(index, value) {
    if (!/^\d?$/.test(value)) return        // Only digits
    const next = [...otp]
    next[index] = value
    setOtp(next)
    // Auto-advance to next box
    if (value && index < 5) inputs.current[index + 1]?.focus()
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setOtp(pasted.split(''))
      inputs.current[5]?.focus()
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const otpStr = otp.join('')
    if (otpStr.length !== 6) return toast.error('Enter all 6 digits')

    setLoading(true)
    try {
      await authApi.verifyEmail({ email, otp: otpStr })
      toast.success('Email verified! You can now log in.')
      navigate('/login')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid OTP')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
        <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Verify your email</h1>
        <p className="text-sm text-slate-500 mt-2 mb-8">
          We sent a 6-digit OTP to <strong>{email}</strong>
        </p>

        <form onSubmit={handleSubmit}>
          {/* 6-digit OTP input */}
          <div className="flex gap-3 justify-center mb-6" onPaste={handlePaste}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => (inputs.current[i] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="w-12 h-14 text-center text-xl font-bold border-2 border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
              />
            ))}
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
            {loading ? 'Verifying...' : 'Verify email'}
          </button>
        </form>

        <p className="text-sm text-slate-500 mt-6">
          <Link to="/login" className="text-blue-600 hover:underline">Back to login</Link>
        </p>
      </div>
    </div>
  )
}