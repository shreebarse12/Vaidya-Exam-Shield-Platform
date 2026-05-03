// FILE: src/pages/Landing.jsx
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useDarkMode } from '@/hooks/useDarkMode'
import { Sun, Moon, Shield, ChevronRight } from 'lucide-react'
import BrandLogo from '@/components/shared/BrandLogo'

const features = [
  { emoji: '🤖', title: 'AI Proctoring',  desc: 'Real-time face & object detection with YOLOv8. Auto-submit on max violations.' },
  { emoji: '⏱️', title: 'Smart Timer',    desc: 'Redis-backed per-section timers with crash recovery and 30-second auto-save.' },
  { emoji: '🧠', title: 'AI Doubt Solver', desc: 'LLM-powered tutoring with exam mistake analysis and personalized guidance.' },
  { emoji: '📊', title: 'Analytics',       desc: 'Score trends, weak topic analysis, rank & percentile across all attempts.' },
  { emoji: '🛡️', title: 'Anti-Cheat',      desc: 'Deterministic shuffling, keyboard lock, fullscreen enforcement, tab-switch tracking.' },
  { emoji: '🏢', title: 'Multi-Tenant',    desc: 'B2B SaaS with tenant isolation: Institute → Faculty → Student hierarchy.' },
]

const stats = [
  { value: '500+', label: 'Institutes' },
  { value: '1M+',  label: 'Exams Conducted' },
  { value: '99.9%', label: 'Uptime' },
]

const tiers = [
  {
    name: 'Starter', price: '₹999', period: '/mo', highlight: false,
    features: ['Up to 100 students', 'Basic proctoring', '5 exams/month', 'Email support'],
  },
  {
    name: 'Pro', price: '₹2,499', period: '/mo', highlight: true,
    features: ['Up to 1,000 students', 'Advanced AI proctoring', 'Unlimited exams', 'AI Doubt Solver', 'Priority support'],
  },
  {
    name: 'Enterprise', price: 'Custom', period: '', highlight: false,
    features: ['Unlimited students', 'Full AI suite', 'Custom branding', 'Dedicated support', 'SLA guarantee', 'On-premise option'],
  },
]

const stagger = { animate: { transition: { staggerChildren: 0.07 } } }
const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

export default function Landing() {
  const navigate = useNavigate()
  const { isDark, toggle } = useDarkMode()

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-slate-900 dark:text-white transition-colors duration-300">
      {/* ── Navbar ───────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg border-b border-slate-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <BrandLogo compact />
          <div className="flex items-center gap-3">
            <button onClick={toggle} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors" aria-label="Toggle theme">
              {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
            </button>
            <button onClick={() => navigate('/login')} className="text-sm font-medium text-slate-600 dark:text-gray-300 hover:text-blue-600 transition-colors">
              Sign in
            </button>
            <button onClick={() => navigate('/register')} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors">
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-950 dark:to-blue-950" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-32 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-full px-4 py-1.5 mb-6">
              <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">AI-Powered Exam Security</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight mb-6">
              AI-Powered Secure Exams
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                for Coaching Institutes
              </span>
            </h1>
            <p className="max-w-2xl mx-auto text-lg text-slate-600 dark:text-gray-400 mb-10">
              From question creation to AI-analyzed results — Vaidya delivers end-to-end exam management
              with real-time proctoring, smart timers, and personalized doubt solving.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={() => navigate('/register')} className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:shadow-blue-500/30 flex items-center gap-2 justify-center">
                Start Free Trial <ChevronRight className="w-5 h-5" />
              </button>
              <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="px-8 py-3.5 bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 text-slate-700 dark:text-gray-300 font-semibold rounded-2xl hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
                View Demo
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Stats Bar ────────────────────────────────────────────────────────── */}
      <section className="border-y border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-3 gap-4 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400">{s.value}</p>
              <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold mb-3">Everything you need to run exams</h2>
          <p className="text-slate-500 dark:text-gray-400 max-w-xl mx-auto">
            Built for Indian coaching institutes — from NEET to JEE to state-level competitive exams.
          </p>
        </div>
        <motion.div variants={stagger} initial="initial" whileInView="animate" viewport={{ once: true }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <motion.div key={f.title} variants={fadeUp} className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
              <span className="text-3xl">{f.emoji}</span>
              <h3 className="text-lg font-semibold mt-3 mb-2">{f.title}</h3>
              <p className="text-sm text-slate-500 dark:text-gray-400 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────────── */}
      <section className="bg-slate-50 dark:bg-gray-900 border-y border-slate-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3">Simple, transparent pricing</h2>
            <p className="text-slate-500 dark:text-gray-400">Start free. Scale as you grow.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {tiers.map((t) => (
              <div key={t.name} className={`rounded-2xl p-8 flex flex-col ${t.highlight ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20 ring-2 ring-blue-400 scale-105' : 'bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700'}`}>
                <h3 className={`text-lg font-semibold ${t.highlight ? 'text-white' : ''}`}>{t.name}</h3>
                <div className="mt-4 mb-6">
                  <span className="text-4xl font-black">{t.price}</span>
                  {t.period && <span className={`text-sm ${t.highlight ? 'text-blue-200' : 'text-slate-500 dark:text-gray-400'}`}>{t.period}</span>}
                </div>
                <ul className="space-y-3 flex-1 mb-8">
                  {t.features.map((f) => (
                    <li key={f} className={`flex items-center gap-2 text-sm ${t.highlight ? 'text-blue-100' : 'text-slate-600 dark:text-gray-300'}`}>
                      <span className="text-green-400">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <button onClick={() => navigate('/register')} className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors ${t.highlight ? 'bg-white text-blue-600 hover:bg-blue-50' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                  {t.name === 'Enterprise' ? 'Contact Sales' : 'Start Free Trial'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="bg-white dark:bg-gray-950 border-t border-slate-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500 dark:text-gray-400">
            © {new Date().getFullYear()} Vaidya Technoserve. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-slate-500 dark:text-gray-400">
            <a href="#" className="hover:text-blue-600 transition-colors">Privacy</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Terms</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
