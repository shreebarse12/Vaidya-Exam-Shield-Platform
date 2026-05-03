# 🛡️ Vaidya Exam-Shield Platform — Technical Documentation (v2)

> AI-Powered Secure Examination System for Indian Coaching Institutes

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Getting Started](#getting-started)
5. [Key Features](#key-features)
6. [Security Model](#security-model)
7. [AI Systems](#ai-systems)
8. [Frontend Architecture](#frontend-architecture)
9. [Backend Architecture](#backend-architecture)
10. [Deployment](#deployment)
11. [Production Hardening (v2)](#production-hardening-v2)

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     React 19 + Vite 5                        │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Landing  │  │ Auth     │  │ Dashboard│  │ Exam         │  │
│  │ Page     │  │ Pages    │  │ Pages    │  │ Interface    │  │
│  └─────────┘  └──────────┘  └──────────┘  └──────────────┘  │
│                Redux Toolkit • React Router v7               │
│       Error Boundary • Code Splitting • Dark Mode            │
└──────────────────────┬───────────────────────────────────────┘
                       │ REST API (JWT Auth)
┌──────────────────────▼───────────────────────────────────────┐
│                    FastAPI 0.111                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │ Auth API │  │ Exam API │  │ Analytics│  │ AI Doubt     │ │
│  │ + Rate   │  │          │  │ API      │  │ Solver API   │ │
│  │ Limiting │  │          │  │          │  │              │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │
│          SQLAlchemy 2.0 (Async) • SlowAPI                    │
└────────┬─────────────┬─────────────┬─────────────────────────┘
         │             │             │
    ┌────▼────┐   ┌────▼────┐  ┌────▼─────┐
    │Postgres │   │ Redis 7 │  │ Celery   │
    │   15    │   │(Cache + │  │  5.4     │
    │         │   │ Timers) │  │(Tasks)   │
    └─────────┘   └─────────┘  └──────────┘
```

---

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 19.x | UI library |
| Vite | 5.x | Build tool & dev server |
| Redux Toolkit | 2.x | State management |
| React Router | 7.x | Client-side routing with RBAC guards |
| Tailwind CSS | 3.x | Utility-first styling (dark mode: `class`) |
| Framer Motion | 11.x | Page transitions & animations |
| Recharts | 2.x | Analytics charts (Line, Area, Radar, Pie, Bar) |
| Lucide React | — | Icon system |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| FastAPI | 0.111 | Async web framework |
| SQLAlchemy | 2.0 | Async ORM |
| PostgreSQL | 15 | Primary database |
| Redis | 7.x | Cache, exam timers, Celery broker |
| Celery | 5.4 | Async task queue (proctoring, email) |
| SlowAPI | 0.1.9 | Rate limiting middleware |

### AI/ML
| Technology | Purpose |
|---|---|
| YOLOv8 (Ultralytics) | Real-time face & object detection for proctoring |
| MediaPipe | Gaze estimation (head pose) |
| LangChain + Groq | LLM-powered doubt solving (Llama 3.3 70B) |

---

## 📁 Project Structure

```
Vaidya-Exam-Shield-Platform/
├── vaidya-backend/
│   ├── app/
│   │   ├── api/v1/         # Route handlers (auth, exams, questions, analytics, doubts)
│   │   ├── core/           # Middleware, security utilities
│   │   ├── db/             # Database session & models
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   ├── services/       # Business logic layer
│   │   └── main.py         # FastAPI app factory + rate limiting
│   ├── requirements.txt
│   └── Dockerfile
│
├── vaidya-frontend/
│   ├── src/
│   │   ├── api/            # Axios API clients
│   │   ├── components/
│   │   │   └── shared/     # UI primitives, layout, error boundary, skeletons
│   │   ├── hooks/          # Custom hooks (useDarkMode)
│   │   ├── pages/
│   │   │   ├── auth/       # Login, Register, VerifyOTP, ForgotPassword
│   │   │   ├── student/    # Dashboard, Analytics, ExamInterface, DoubtSolver
│   │   │   ├── faculty/    # Dashboard, QuestionBank, ExamCreate, Analytics
│   │   │   ├── institute-admin/  # Dashboard, Faculty, Students, Batches
│   │   │   ├── super-admin/      # Dashboard, Tenants, Users, GlobalQBank
│   │   │   ├── Landing.jsx       # Public marketing page
│   │   │   └── NotFound.jsx      # 404 page
│   │   ├── router/         # React Router config with lazy loading
│   │   ├── store/          # Redux slices (auth, exam, notifications)
│   │   └── main.jsx        # App entry with ErrorBoundary
│   ├── tailwind.config.js
│   └── package.json
│
├── docker-compose.yml
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+, Python 3.10+, Docker & Docker Compose

### Quick Start (Docker)
```bash
docker compose up -d --build
```

### Local Development

**Backend:**
```bash
cd vaidya-backend
python -m venv venv && venv\Scripts\activate  # Windows
pip install -r requirements.txt
cp .env.example .env   # Configure your secrets
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd vaidya-frontend
npm install
npm run dev   # → http://localhost:5173
```

---

## ⭐ Key Features

### For Students
- 📝 Take exams with real-time AI proctoring
- 🧠 AI Doubt Solver (LLM-powered tutoring)
- 📊 Performance analytics with score trends & subject mastery radar
- 🏆 View rank and percentile

### For Faculty
- 📚 Question Bank with CSV bulk import
- 📋 Exam creation with section-wise configuration
- 📊 Institute-wide analytics (bar charts, pie charts, pass rates)
- 🏆 Ranking & leaderboard management

### For Institute Admin
- 👥 Faculty & student management
- 🎓 Batch organization
- 👁️ Proctoring review dashboard
- 🎨 Institute branding

### For Super Admin
- 🏢 Multi-tenant management
- 👤 Global user management
- 📝 Global question bank
- 📋 Audit logs

---

## 🔒 Security Model

| Layer | Implementation |
|---|---|
| **Authentication** | JWT access token (15 min) + refresh token (7 days) |
| **Authorization** | 4-role RBAC: student, faculty, institute_admin, super_admin |
| **Rate Limiting** | SlowAPI — login: 10/min, register: 5/min, AI endpoints: 10-30/min |
| **Multi-Tenancy** | `tenant_id` column on all data models with middleware enforcement |
| **Anti-Cheat** | Fullscreen lock, keyboard restriction, tab-switch detection, webcam proctoring |
| **Data Isolation** | Faculty only sees their own questions; students only see their tenant's exams |

---

## 🤖 AI Systems

### Proctoring Pipeline
```
Webcam → OpenCV → YOLOv8 (person/phone) + MediaPipe (gaze) → Violation Score → Auto-submit
```

### Doubt Solver Pipeline
```
Student Question → LangChain → Groq (Llama 3.3 70B) → Streaming Response
Exam Analysis → Fetch attempt → Build analysis prompt → LLM → Personalized guidance
```

---

## 🎨 Frontend Architecture (v2)

### Dark Mode
- Strategy: Tailwind `darkMode: 'class'`
- Hook: `useDarkMode()` — detects system preference, saves to localStorage
- Toggle: Sidebar footer (Sun/Moon icon)
- Coverage: All pages, components, and CSS utilities

### Code Splitting
- All 25+ pages use `React.lazy()` + `<Suspense>`
- Bundle analyzer shows ~60% reduction in initial load

### Error Handling
- Global `<ErrorBoundary>` wraps the entire app
- Shows dev stack traces in development, user-friendly fallback in production
- ExamInterface has its own nested ErrorBoundary

### State Management
```
Redux Store
├── auth         → user, tokens, loading
├── exam         → active exam state, timer, answers
└── notifications → in-app notification items + unread count
```

### Responsive Design
- Sidebar: Hidden on mobile, slide-in with backdrop on hamburger click
- Top navbar: Sticky with notification center + role badge
- All grids: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3/4`

---

## ⚙️ Backend Architecture

### Rate Limiting
```python
# main.py
from slowapi import Limiter
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
app.state.limiter = limiter

# auth.py — per endpoint
@limiter.limit("10/minute")
async def login(request: Request, ...):
```

### API Structure
```
/api/v1/auth/       → register, login, verify-email, refresh, forgot-password
/api/v1/exams/      → CRUD, publish, start, submit
/api/v1/questions/  → CRUD, bulk import, template download
/api/v1/analytics/  → student report, weak topics, ranking, institute stats
/api/v1/doubts/     → ask, analyze-last-exam, analyze-attempt
/api/v1/institute/  → faculty, students, batches management
/api/v1/proctoring/ → WebSocket for real-time frame analysis
```

---

## 🚢 Deployment

### Docker Compose Services
```yaml
services:
  postgres:    # PostgreSQL 15
  redis:       # Redis 7
  backend:     # FastAPI (uvicorn)
  celery:      # Celery worker
  flower:      # Celery monitoring
  frontend:    # React (nginx)
```

### Environment Variables
All secrets (`JWT_SECRET`, `GROQ_API_KEY`, DB credentials) must be in `.env` files — never committed to version control.

---

## 🔄 Production Hardening (v2)

### What's New
| Category | Before | After |
|---|---|---|
| **Dark Mode** | ❌ None | ✅ Full dark mode with system detection |
| **Mobile** | ❌ Fixed 256px sidebar | ✅ Hamburger + slide-in responsive sidebar |
| **Errors** | ❌ White screen crash | ✅ ErrorBoundary + dev stack traces |
| **Loading** | ❌ Generic spinner | ✅ Shimmer skeleton loaders |
| **Bundle** | ❌ Single 800KB chunk | ✅ 25+ lazy-loaded route chunks |
| **404** | ❌ None | ✅ Role-aware 404 page |
| **Landing** | ❌ None | ✅ Full marketing page with pricing |
| **Notifications** | ❌ Toast only | ✅ Redux-driven notification center |
| **Rate Limiting** | ❌ None | ✅ SlowAPI on auth + AI endpoints |
| **Analytics** | ❌ Basic text cards | ✅ Area, Radar, Pie, Bar charts |

---

## 📄 License

Proprietary — Vaidya Technoserve Private Limited
