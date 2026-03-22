# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Clawkathon** is an AI-powered recruitment platform that automates candidate screening via phone interviews. It uses OpenClaw (AI model) to conduct interviews and ClawdTalk (phone API) for outbound calls.

**Flow:** Job created → Resumes uploaded (PDF parsed) → AI calls candidates → Scores and transcripts captured → Report generated → AI debriefs HR via phone.

## Commands

### Backend (`/backend`)
```bash
npm run dev      # Development with auto-restart (ts-node-dev, port 8000)
npm run build    # Compile TypeScript → ./dist
npm run start    # Run compiled production build
```

### Frontend (`/frontend`)
```bash
npm run dev      # Next.js dev server (port 3000)
npm run build    # Production build
npm run start    # Production server
```

No test runner or linter is configured — TypeScript strict mode is the primary type-safety mechanism.

## Architecture

### Backend (`/backend/src`)
- **`index.ts`** — Express server; mounts routes at `/jobs`, `/jobs/:id/candidates`, `/jobs/:id/calls`, `/calls/:id`; report download at `/jobs/:id/report`
- **`db.ts`** — PostgreSQL connection pool (SQLite in local dev via `recruiter.db`), schema init, and all CRUD queries for `jobs`, `candidates`, `calls` tables
- **`routes/`** — Thin HTTP handlers: validate input, call services, write to DB
- **`services/openclaw.ts`** — Calls OpenClaw API to initiate AI-conducted interviews and HR debrief calls
- **`services/clawdtalk.ts`** — Manages phone calls: initiate, poll until complete, fetch transcripts
- **`services/resume.ts`** — PDF text extraction, candidate info parsing, score computation from transcripts
- **`services/report.ts`** — Generates markdown reports from candidate results (saved to `/backend/reports/`)

### Frontend (`/frontend`)
Next.js App Router. All API calls go through `lib/api.ts` to the backend.

- `app/page.tsx` — Landing page
- `app/jobs/new/page.tsx` — Job creation form (title, description, HR phone, scoring criteria)
- `app/jobs/[id]/page.tsx` — Job detail: candidate list, stats, start-calls button
- `app/jobs/[id]/candidates/[cid]/page.tsx` — Candidate detail: transcript, scores, recommendation
- `components/ScoreBar.tsx` / `StatusBadge.tsx` — Shared UI primitives

### State Machine

**Job status:** `created` → `calling` → `debriefing` → `done`

**Candidate status:** `pending` → `calling` → `completed` | `rescheduled` | `no_answer`

## Environment Variables

**Backend (`backend/.env`):**
| Variable | Purpose |
|---|---|
| `PORT` | Server port (default 8000) |
| `BASE_URL` | Public URL used in report download links |
| `DATABASE_URL` | PostgreSQL connection string (omit to use SQLite) |
| `OPENCLAW_BASE_URL` | OpenClaw API base URL |
| `OPENCLAW_TOKEN` | OpenClaw auth token |
| `CLAWDTALK_BASE_URL` | ClawdTalk service URL |
| `CLAWDTALK_API_KEY` | ClawdTalk API key |

**Frontend (`frontend/.env.local`):**
| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API URL (exposed to browser) |
