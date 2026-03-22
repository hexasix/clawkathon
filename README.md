# Clawcruiter — Openclaw-Powered Recruitment Platform

An end-to-end AI recruitment platform built for the **Clawkathon** hackathon. It automates candidate screening via real phone calls: upload resumes, and the system calls every candidate, conducts a structured voice interview, scores them against your job criteria, generates a ranked report, and texts the HR manager a debrief — all without a human in the loop.

**Live:** [http://45.63.77.206:8080/](http://45.63.77.206:8080/)

**Youtube:** [https://www.youtube.com/watch?v=THe2YdNID_M](https://www.youtube.com/watch?v=THe2YdNID_M)

**Flow:** Create job → Upload resumes → AI calls candidates → Scores & transcripts captured → Report generated → HR debriefed via SMS

---

## What We Built

Most recruitment tools just help you track candidates. We automated the screening call itself.

When you click "Start Calls", the system:
1. Reads each candidate's resume to understand their background
2. Dials their phone number via ClawdTalk
3. Conducts a structured 5–8 question interview using an OpenClaw voice agent
4. Waits for the call to end, fetches the transcript
5. Scores the candidate on 6 dimensions using a weighted formula
6. When all calls are done: generates a ranked Markdown report and SMSes the HR manager the top candidates with a download link

No scheduling. No manual notes. No missed candidates.

---

## How It Works — The Full Stack

### OpenClaw (AI Backend)

[OpenClaw](https://openclaw.ai) is a locally-running AI agent gateway. It exposes a local HTTP API (`http://localhost:18789`) that is OpenAI-compatible — the backend calls it exactly like a chat completions endpoint.

OpenClaw runs two agents for this project:

#### Recruiter Agent (`openclaw agents: recruiter`)

A dedicated agent configured in `~/.openclaw/openclaw.json` with its own workspace at `~/.openclaw/workspace-recruiter/`. It is governed by three persona files:

- **`SOUL.md`** — defines the agent's identity, tone, and hard behavioral limits. The agent introduces itself as "a Virtual AI Recruiter calling on behalf of the hiring team". It keeps calls to 1–2 sentences per turn, covers experience → skills → salary → availability in order, and never promises next steps or reveals scores.
- **`TOOLS.md`** — operational defaults: voice is `Rime.ArcanaV3.astra`, model is `openai/gpt-4o`, calls are business-hours-only (9–5 PST), candidates are called in batches staggered 90 seconds apart, and HR debrief is SMS-only.
- **`AGENTS.md`** — session startup instructions, memory conventions, group chat etiquette, and heartbeat behavior.

The recruiter agent's model is `openai-codex/gpt-5.4` (OpenClaw's routed model identifier).

#### Main Agent

The default OpenClaw agent handles general chat, WhatsApp/Discord channels, and acts as the conversational hub. The recruiter agent is scoped only to recruitment tasks.

### ClawTalk Plugin (`openclaw.json` → `plugins.entries.clawtalk`)

ClawTalk is installed as an OpenClaw plugin (`clawtalk@0.1.6`):

```bash
openclaw plugins install clawtalk
```

The plugin gives the OpenClaw agent a real phone number. It connects to `https://clawdtalk.com` via a persistent WebSocket and registers 20 tools into the agent.

**How it's configured for this project:**

```json
{
  "plugins": {
    "entries": {
      "clawtalk": {
        "enabled": true,
        "config": {
          "apiKey": "<your-clawdtalk-api-key>",
          "server": "https://clawdtalk.com",
          "agentId": "recruiter",
          "agentName": "Recruiter"
        }
      }
    }
  }
}
```

The `agentId: "recruiter"` routes all inbound calls and SMS through the recruiter agent's workspace, not the main agent. `agentName: "Recruiter"` is the identity the voice agent uses on calls.

**Key ClawTalk capabilities used:**

| Feature | How we use it |
|---------|--------------|
| Outbound calls | Backend calls `POST /v1/calls` to dial each candidate |
| Voice assistants | `POST /v1/assistants` creates a scoped AI agent per call with custom interview instructions |
| Call polling | `GET /v1/calls/:id` polled every 5s until terminal state |
| Transcripts | `GET /v1/calls/:id/assistant-data` returns structured messages + AI insights |
| SMS | HR debrief sent via ClawTalk SMS after all calls complete |

ClawTalk is powered by Telnyx under the hood and handles SIP, PSTN, STIR/SHAKEN verification, and TTS.

### Backend (Node.js + TypeScript + PostgreSQL)

Express server on port 8000. All business logic lives in `backend/src/services/`:

**`openclaw.ts`** — Builds the per-candidate interview prompt. Injects job title, job description, and resume text into a structured system prompt that instructs the voice agent to conduct a professional screening interview. Also implements `callHrWithDebrief()` which formats and sends the SMS summary.

**`clawdtalk.ts`** — Thin HTTP client over the ClawdTalk REST API:
- `createVoiceAssistant()` — creates a new assistant with the interview instructions
- `initiateOutboundCall()` — dials the candidate
- `waitForCallToEnd()` — polls every 5 seconds, 20-minute timeout
- `getCallTranscript()` — fetches and normalises the conversation into `TranscriptEntry[]`
- `deleteAssistant()` — cleans up after the call

**`resume.ts`** — Parses PDF (via `pdf-parse`) and DOCX (via `mammoth`) into raw text, then calls OpenClaw to extract structured candidate data (name, email, phone, years of experience, skills, current role). Also runs initial resume-based scoring.

**`report.ts`** — After all calls complete, calls OpenClaw to write a Markdown report with an executive summary, ranked shortlist, maybe candidates, and recommended next steps. Saves to `backend/reports/{jobId}.md`.

**`promptUtils.ts`** — Sanitizes all user-provided text before interpolation into AI prompts (strips control characters, collapses excessive newlines, enforces length limits). Also robustly extracts JSON from LLM responses and validates/clamps scoring output.

#### Scoring Formula

Candidates are scored 0–10 on six dimensions. The overall score is computed deterministically — the AI's stated overall score is discarded and recomputed:

```
overall = (experience_fit  × 0.25)
        + (skills_match    × 0.25)
        + (communication   × 0.15)
        + (motivation_fit  × 0.15)
        + (salary_expectation × 0.10)
        + (availability    × 0.10)
```

Recommendations: `overall >= 7.0` → **advance**, `>= 5.0` → **maybe**, `< 5.0` → **reject**.

#### State Machines

**Job:** `created` → `calling` → `debriefing` → `done`

**Candidate:** `pending` → `calling` → `completed` | `rescheduled` | `no_answer`

**Call:** `initiated` → `in_progress` → `completed` | `failed` | `rescheduled`

#### Database Schema

Three PostgreSQL tables, auto-created on first startup:

- **`jobs`** — id, title, jd, hr_phone, scoring_criteria (JSONB), status, created_at
- **`candidates`** — id, job_id, name, phone, email, resume_text, status, scores (JSONB), summary, recommendation, created_at
- **`calls`** — id, candidate_id, job_id, clawdtalk_call_id, status, transcript (JSONB), scheduled_at, completed_at, created_at

### Frontend (Vite + React + shadcn/ui)

Four pages, all under `frontend/src/pages/`:

- **`LandingPage`** — Job board with quick stats (active jobs, total candidates, advancing count)
- **`CreateJobPage`** — Job creation form: title, description, HR phone, min experience, max salary, required skills
- **`JobDetailPage`** — Resume upload (multi-file PDF/DOCX), "Start Calls" button, candidates table with live status. Auto-refreshes every 4 seconds while the job is in `calling` or `debriefing` state.
- **`CandidateDetailPage`** — Full candidate view: score bars for each dimension, AI summary, red flags, resume text, and the interview transcript rendered as chat bubbles (AI left, candidate right).

---

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- [OpenClaw](https://openclaw.ai) installed and running locally
- A [ClawdTalk](https://clawdtalk.com) account with an API key

### 1. Clone the repo

```bash
git clone https://github.com/PesseJinkman/clawtalk-ai-recruiter.git
cd clawtalk-ai-recruiter
```

### 2. Set up OpenClaw

OpenClaw must be running locally. Install the ClawTalk plugin and configure the recruiter agent:

```bash
# Install ClawTalk plugin
openclaw plugins install clawtalk

# Verify the plugin is healthy
openclaw clawtalk doctor
```

Add the recruiter agent and ClawTalk plugin config to `~/.openclaw/openclaw.json`:

```json
{
  "agents": {
    "list": [
      {
        "id": "recruiter",
        "name": "recruiter",
        "workspace": "/path/to/workspace-recruiter",
        "agentDir": "/path/to/agents/recruiter/agent",
        "model": "openai-codex/gpt-5.4"
      }
    ]
  },
  "plugins": {
    "entries": {
      "clawtalk": {
        "enabled": true,
        "config": {
          "apiKey": "your-clawdtalk-api-key",
          "server": "https://clawdtalk.com",
          "agentId": "recruiter",
          "agentName": "Recruiter"
        }
      }
    }
  },
  "gateway": {
    "mode": "local",
    "auth": {
      "mode": "token",
      "token": "your-openclaw-token"
    },
    "http": {
      "endpoints": {
        "chatCompletions": {
          "enabled": true
        }
      }
    }
  }
}
```

Restart the gateway after changes:

```bash
openclaw gateway restart
```

### 3. Create the database

```bash
psql -U postgres -c "CREATE DATABASE recruiter;"
```

Tables are created automatically on first startup.

### 4. Backend environment

Create `backend/.env`:

```env
PORT=8000
BASE_URL=http://localhost:8000

DATABASE_URL=postgresql://user:password@localhost:5432/recruiter

# OpenClaw — local AI gateway
OPENCLAW_BASE_URL=http://localhost:18789
OPENCLAW_TOKEN=your_openclaw_token

# ClawdTalk — phone call service
CLAWDTALK_BASE_URL=https://clawdtalk.com
CLAWDTALK_API_KEY=your_clawdtalk_api_key
```

### 5. Frontend environment

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
```

### 6. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

---

## Running the Project

```bash
# Terminal 1 — Backend (port 8000)
cd backend && npm run dev

# Terminal 2 — Frontend (port 8080)
cd frontend && npm run dev
```

Open [http://localhost:8080](http://localhost:8080).

---

## Production Build

```bash
# Backend
cd backend && npm run build && npm run start

# Frontend
cd frontend && npm run build && npm run preview
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/jobs` | Create a job |
| `GET` | `/jobs` | List all jobs |
| `GET` | `/jobs/:id` | Get job details with stats |
| `POST` | `/jobs/:id/candidates` | Upload resume (PDF/DOCX) |
| `GET` | `/jobs/:id/candidates` | List candidates |
| `GET` | `/jobs/:id/candidates/:cid` | Candidate detail with transcript |
| `POST` | `/jobs/:id/candidates/:cid/call` | Call a single candidate |
| `POST` | `/jobs/:id/calls/start` | Start AI screening for all pending candidates |
| `GET` | `/jobs/:id/calls` | List calls for a job |
| `GET` | `/calls/:id` | Call status and transcript |
| `POST` | `/calls/:id/reschedule` | Reschedule a call |
| `GET` | `/jobs/:id/report` | Download screening report (Markdown) |
| `GET` | `/health` | Health check |

---

## Project Structure

```
clawkathon/
├── backend/
│   └── src/
│       ├── index.ts              # Express server, route mounting
│       ├── db.ts                 # PostgreSQL pool, schema, CRUD
│       ├── routes/
│       │   ├── jobs.ts           # Job endpoints
│       │   ├── candidates.ts     # Resume upload, candidate endpoints
│       │   └── calls.ts          # Call orchestration (runCall)
│       └── services/
│           ├── openclaw.ts       # AI prompt building, HR SMS debrief
│           ├── clawdtalk.ts      # ClawdTalk REST client (calls, transcripts)
│           ├── resume.ts         # PDF/DOCX parsing, candidate scoring
│           ├── report.ts         # Markdown report generation
│           └── promptUtils.ts    # Input sanitization, JSON extraction, score validation
├── frontend/
│   └── src/
│       ├── lib/
│       │   ├── api.ts            # All API call functions
│       │   └── types.ts          # Shared TypeScript types
│       ├── pages/
│       │   ├── LandingPage.tsx
│       │   ├── CreateJobPage.tsx
│       │   ├── JobDetailPage.tsx
│       │   └── CandidateDetailPage.tsx
│       └── components/
│           ├── ScoreBar.tsx      # Score visualization
│           └── StatusBadge.tsx   # Status indicators
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL (`pg`) |
| AI Gateway | OpenClaw (local, OpenAI-compatible API) |
| AI Model | openai-codex/gpt-5.4 via OpenClaw |
| Phone / Voice | ClawdTalk (powered by Telnyx) via ClawTalk OpenClaw plugin |
| Resume Parsing | pdf-parse, mammoth |
| Frontend | Vite, React, React Router v6 |
| UI | shadcn/ui, Tailwind CSS, Radix UI |
| Data Fetching | TanStack Query |
| Forms | react-hook-form + zod |
