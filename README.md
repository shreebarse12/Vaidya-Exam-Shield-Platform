# Vaidya Exam-Shield Platform

AI-powered secure examination platform for coaching institutes, faculty teams, and students.

This project combines:
- a FastAPI backend for authentication, exams, institute management, analytics, subscriptions, and AI services
- a React + Vite frontend for student, faculty, institute-admin, and super-admin portals
- Redis and Celery for timers, queues, and background processing
- AI-assisted proctoring and doubt-solving features

## Features

- Role-based portals for `student`, `faculty`, `institute_admin`, and `super_admin`
- Question bank and exam creation workflow
- Secure exam attempt flow with auto-save and timer management
- Live proctoring with WebSocket monitoring
- YOLOv8-based object detection for proctoring
- AI doubt solver using Groq + LangChain
- Exam mistake analysis from previous attempts
- Rank generation and rank publishing after exam end time
- Institute-level analytics and proctoring review
- Docker-based local development stack

## Tech Stack

### Backend

- FastAPI
- SQLAlchemy async + PostgreSQL
- Redis
- Celery + Flower
- LangChain + Groq
- OpenCV + MediaPipe + Ultralytics YOLOv8

### Frontend

- React
- Vite
- Redux Toolkit
- React Router
- Tailwind CSS

## Repository Structure

```text
Vaidya-Exam-Shield-Platform2/
|-- docker-compose.yml
|-- README.md
|-- vaidya-backend/
|   |-- app/
|   |-- migrations/
|   |-- requirements.txt
|   `-- dockerfile
`-- vaidya-frontend/
    |-- src/
    |-- package.json
    `-- Dockerfile
```

## Main Backend Modules

- `app/api/v1/auth.py`: authentication and token flows
- `app/api/v1/questions.py`: question bank APIs
- `app/api/v1/exams.py`: exam lifecycle, publish, submit, and rank publish
- `app/api/v1/institute.py`: institute admin APIs
- `app/api/v1/analytics.py`: student and institute analytics, rankings
- `app/api/v1/proctoring_ws.py`: live proctoring WebSocket
- `app/api/v1/doubts.py`: AI doubt solver and exam analysis
- `app/tasks/`: Celery workers for background tasks

## Main Frontend Areas

- `src/pages/student/`: student dashboard, exam, results, AI doubt solver
- `src/pages/faculty/`: question bank, exam creation, analytics, ranking
- `src/pages/institute-admin/`: institute management, proctoring, ranking review
- `src/pages/super-admin/`: platform-wide admin views

## Prerequisites

Install these before running locally:

- Python `3.11+`
- Node.js `20+`
- PostgreSQL `15+`
- Redis `7+`
- Docker Desktop if you want the containerized setup

## Environment Variables

### Backend

Create `vaidya-backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/vaidya_db
REDIS_URL=redis://localhost:6379
JWT_SECRET_KEY=change-this-in-real-use
FRONTEND_URL=http://localhost:5173

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-south-1
S3_BUCKET_NAME=vaidya-assets

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=

AWS_SES_SENDER_EMAIL=noreply@vaidya.in
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
```

### Frontend

Create `vaidya-frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
VITE_RAZORPAY_KEY_ID=rzp_test_your_key_here
```

## Local Development

### 1. Start the backend

```powershell
cd C:\Users\Lenovo\Desktop\Vaidya-Exam-Shield-Platform2\vaidya-backend
python -m venv ..\venv
..\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend runs on:
- API: `http://localhost:8000`
- Docs: `http://localhost:8000/docs`

### 2. Start the frontend

Open a second terminal:

```powershell
cd C:\Users\Lenovo\Desktop\Vaidya-Exam-Shield-Platform2\vaidya-frontend
npm install
npm run dev
```

Frontend runs on:
- App: `http://localhost:5173`

### 3. Optional Celery worker

Open another terminal:

```powershell
cd C:\Users\Lenovo\Desktop\Vaidya-Exam-Shield-Platform2\vaidya-backend
..\venv\Scripts\activate
celery -A app.tasks.proctoring_tasks.celery_app worker --loglevel=info --concurrency=4 -Q proctoring,results,email,celery
```

### 4. Optional Flower dashboard

```powershell
cd C:\Users\Lenovo\Desktop\Vaidya-Exam-Shield-Platform2\vaidya-backend
..\venv\Scripts\activate
celery -A app.tasks.proctoring_tasks.celery_app flower --port=5555 --broker=redis://localhost:6379
```

## Docker Setup

From the project root:

```powershell
docker compose up --build
```

Services:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- Swagger docs: `http://localhost:8000/docs`
- Flower: `http://localhost:5555`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

Stop the stack:

```powershell
docker compose down
```

## Proctoring Notes

- Live proctoring uses a WebSocket connection from the exam interface
- Tab switch and fullscreen violations generate warnings
- AI detection can flag face/object events such as phone or book detection
- Auto-submit is triggered once warning count reaches the configured limit

For Docker on Windows, Docker Desktop should be running with a healthy WSL 2 backend.

## AI Notes

### Doubt Solver

- Uses Groq via LangChain
- Supports normal question-answer chat
- Supports analysis of wrong questions from past exam attempts

### Ranking

- Ranks are calculated from submitted exam attempts
- Faculty and institute admin can review rankings internally
- Students should only see rankings after they are published

## Useful Commands

### Frontend

```powershell
cd vaidya-frontend
npm run dev
npm run build
```

### Backend

```powershell
cd vaidya-backend
uvicorn app.main:app --reload
python -m compileall .\app
```

### Docker

```powershell
docker compose config
docker compose up --build
docker compose down
```

## Security Notes

- Do not commit `.env` files
- Keep `JWT_SECRET_KEY`, `GROQ_API_KEY`, AWS credentials, and payment secrets in environment variables only
- Review proctoring and AI settings before using this in production

## Current Status

This repository is set up for active development and includes:
- full-stack app structure
- Docker-based local orchestration
- AI doubt solver integration
- proctoring pipeline
- ranking and rank publishing flow


