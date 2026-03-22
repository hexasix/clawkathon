# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Clawkathon** is an AI-powered recruitment platform that automates candidate screening via phone interviews. It uses OpenClaw (AI model) to conduct interviews and ClawdTalk (phone API) for outbound calls.

**Flow:** Job created → Resumes uploaded (PDF/DOCX parsed) → AI calls candidates → Scores and transcripts captured → Report generated → AI debriefs HR via phone.

## Commands

### Backend (`/backend`)
```bash
npm run dev      # Development with auto-restart (ts-node-dev, port 8000)
npm run build    # Compile TypeScript → ./dist
npm run start    # Run compiled production build
```

### Frontend (`/frontend`)
```bash
npm run dev      # Vite dev server (port 8080)
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # ESLint
npm run test     # Run tests once (vitest)
npm run test:watch  # Vitest in watch mode
```

Backend uses TypeScript strict mode. Frontend has looser TypeScript settings (`noImplicitAny: false`, `strictNullChecks: false`).

## Architecture

### Backend (`/backend/src`)
- **`index.ts`** — Express server; mounts routes at `/jobs`, `/jobs/:id/candidates`, `/jobs/:id/calls`, `/calls/:id`; report download at `GET /jobs/:id/report`; health check at `GET /health`
- **`db.ts`** — PostgreSQL pool (via `pg`), schema init, and all CRUD queries for `jobs`, `candidates`, `calls` tables
- **`routes/`** — Thin HTTP handlers: validate input, call services, write to DB
- **`services/openclaw.ts`** — Builds AI recruiter prompts, calls OpenClaw chat API for candidate info extraction, scoring, report generation, and HR debrief SMS
- **`services/clawdtalk.ts`** — Creates voice assistants, initiates outbound calls, polls for completion (5s interval, 20min timeout), fetches transcripts
- **`services/resume.ts`** — PDF/DOCX text extraction; extracts structured candidate info (name, email, phone, experience, skills) and scores on 5 dimensions via OpenClaw
- **`services/report.ts`** — Generates markdown reports via OpenClaw; saves to `/backend/reports/{jobId}.md`

### Call Orchestration (`routes/calls.ts`)

`POST /jobs/:id/calls/start` triggers `runCall()` per candidate (background, non-blocking):
1. Build interview instructions → 2. Create voice assistant (ClawdTalk) → 3. Initiate outbound call → 4. Poll until complete → 5. Get transcript → 6. Score candidate (OpenClaw) → 7. When all done: generate report + call HR

### Frontend (`/frontend/src`)
Vite + React + React Router v6. All API calls go through `src/lib/api.ts`. Uses TanStack Query, shadcn/ui, and Tailwind CSS.

- `pages/LandingPage.tsx` — Job listings with stats
- `pages/CreateJobPage.tsx` — Job creation form (title, description, HR phone, scoring criteria)
- `pages/JobDetailPage.tsx` — Candidate upload, start-calls button, candidates table; auto-refreshes every 4s when job is `calling` or `debriefing`
- `pages/CandidateDetailPage.tsx` — Transcript (chat bubbles), score bars, recommendation
- `lib/types.ts` — All shared TypeScript types (Job, Candidate, Call, TranscriptEntry, etc.)
- `components/ScoreBar.tsx` / `StatusBadge.tsx` — Shared UI primitives

### State Machine

**Job:** `created` → `calling` → `debriefing` → `done`

**Candidate:** `pending` → `calling` → `completed` | `rescheduled` | `no_answer`

**Call:** `initiated` → `in_progress` → `completed` | `failed` | `rescheduled`

### Scoring Dimensions
Candidates are scored 0–10 on: `communication`, `experience_fit`, `salary_expectation`, `availability`, `overall`. Recommendation is one of: `advance | maybe | reject`.

## Environment Variables

**Backend (`backend/.env`):**
| Variable | Purpose |
|---|---|
| `PORT` | Server port (default 8000) |
| `BASE_URL` | Public URL used in report download links |
| `DATABASE_URL` | PostgreSQL connection string |
| `OPENCLAW_BASE_URL` | OpenClaw API base URL |
| `OPENCLAW_TOKEN` | OpenClaw auth token |
| `CLAWDTALK_BASE_URL` | ClawdTalk service URL |
| `CLAWDTALK_API_KEY` | ClawdTalk API key |

**Frontend (`frontend/.env`):**
| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend API URL (exposed to browser) |
