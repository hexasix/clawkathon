# Clawtalk AI Recruiter

An AI-powered recruitment platform that automates candidate screening via phone interviews. The system calls candidates, conducts structured interviews using an AI voice agent, scores them against your job criteria, and delivers a debrief report directly to the HR manager's phone.

**Flow:** Create job → Upload resumes → AI calls candidates → Scores & transcripts captured → Report generated → AI debriefs HR via phone

## Tech Stack

- **Backend** — Node.js + Express + TypeScript, PostgreSQL
- **Frontend** — Next.js 15 (App Router) + Tailwind CSS
- **AI Voice** — OpenClaw API (conducts phone interviews)
- **Phone** — ClawdTalk API (outbound call management)

---

## Prerequisites

- Node.js 18+
- npm
- PostgreSQL 14+

---

## Setup

### 1. Create the database

```bash
psql -U postgres -c "CREATE DATABASE recruiter;"
```

The tables (`jobs`, `candidates`, `calls`) are created automatically on first startup — no migration step needed.

### 2. Clone the repo



```bash
git clone https://github.com/PesseJinkman/clawtalk-ai-recruiter.git
cd clawtalk-ai-recruiter
```

### 3. Backend environment

Create `backend/.env`:

```env
# Server
PORT=8000
BASE_URL=http://localhost:8000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/recruiter

# OpenClaw — AI voice agent service
OPENCLAW_BASE_URL=http://your-openclaw-host
OPENCLAW_TOKEN=your_openclaw_token

# ClawdTalk — outbound phone call service
CLAWDTALK_BASE_URL=http://your-clawdtalk-host
CLAWDTALK_API_KEY=your_clawdtalk_api_key
```

### 4. Frontend environment

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 5. Install dependencies

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

---

## Running the project

Open two terminal tabs:

```bash
# Terminal 1 — Backend (port 8000)
cd backend && npm run dev

# Terminal 2 — Frontend (port 3000)
cd frontend && npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

---

## Production Build

```bash
# Backend
cd backend
npm run build
npm run start

# Frontend
cd frontend
npm run build
npm run start
```

---

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/jobs` | Create a new job |
| `GET` | `/jobs` | List all jobs |
| `GET` | `/jobs/:id` | Get job details |
| `POST` | `/jobs/:id/candidates` | Upload candidate resume (PDF) |
| `GET` | `/jobs/:id/candidates` | List candidates for a job |
| `POST` | `/jobs/:id/calls` | Start AI screening calls |
| `GET` | `/calls/:id` | Get call status & transcript |
| `POST` | `/calls/:id/reschedule` | Reschedule a call |
| `GET` | `/jobs/:id/report` | Download screening report (Markdown) |
| `GET` | `/health` | Health check |

---

## Project Structure

```
clawtalk-ai-recruiter/
├── backend/
│   └── src/
│       ├── index.ts          # Express server entry point
│       ├── db.ts             # Database connection & queries
│       ├── routes/           # HTTP route handlers
│       └── services/
│           ├── openclaw.ts   # AI interview orchestration
│           ├── clawdtalk.ts  # Phone call management
│           ├── resume.ts     # PDF parsing & scoring
│           └── report.ts     # Markdown report generation
└── frontend/
    └── app/
        ├── page.tsx                          # Landing page
        ├── jobs/new/page.tsx                 # Create job form
        ├── jobs/[id]/page.tsx                # Job detail & candidate list
        └── jobs/[id]/candidates/[cid]/page.tsx  # Candidate detail & transcript
```
