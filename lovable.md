# Lovable Prompt — Clawkathon Frontend

Build a **Next.js App Router** frontend for **Clawkathon**, an AI-powered recruitment platform that automates candidate screening via phone interviews. The AI calls candidates, scores them, and debriefs HR.

Use **Tailwind CSS** throughout. Keep the design clean and professional — white cards on gray-50 backgrounds, blue as the primary action color (`blue-600`), consistent rounded corners and subtle shadows.

---

## API Integration

All API calls go to `process.env.NEXT_PUBLIC_API_URL` (default: `http://localhost:8000`). Create a `lib/api.ts` with typed fetch helpers. All responses follow REST conventions; on error, parse JSON for `{ error: string }` and fall back to `res.statusText`.

---

## Data Types (`lib/types.ts`)

```ts
type JobStatus = 'created' | 'calling' | 'debriefing' | 'done'
type CandidateStatus = 'pending' | 'calling' | 'completed' | 'rescheduled' | 'no_answer'
type Recommendation = 'advance' | 'maybe' | 'reject'

interface ScoringCriteria {
  experience_years?: number
  skills?: string[]
  max_salary?: number
}

interface JobStats {
  total: number
  pending: number
  calling: number
  completed: number
  rescheduled: number
  no_answer: number
  advance: number
}

interface Job {
  id: string
  title: string
  jd: string
  hr_phone: string
  scoring_criteria: ScoringCriteria
  status: JobStatus
  created_at: string
  stats?: JobStats
}

interface Scores {
  communication: number
  experience_fit: number
  salary_expectation: number
  availability: number
  overall: number
}

interface TranscriptEntry {
  role: 'ai' | 'candidate'
  text: string
  timestamp: string
  sequence: number
}

interface Call {
  id: string
  candidate_id: string
  job_id: string
  status: string
  transcript: TranscriptEntry[]
  scheduled_at?: string
  completed_at?: string
  created_at: string
}

interface Candidate {
  id: string
  job_id: string
  name: string
  phone: string
  email?: string
  resume_text?: string
  status: CandidateStatus
  scores?: Scores
  summary?: string
  recommendation?: Recommendation
  created_at: string
  calls?: Call[]
}
```

---

## API Endpoints

```
GET    /jobs                                          → Job[]
POST   /jobs                                          body: { title, jd, hr_phone, scoring_criteria } → Job
GET    /jobs/:id                                      → Job
GET    /jobs/:id/report                               (file download URL)
POST   /jobs/:id/calls/start                          → { message, calls: { candidate_id, call_id }[] }
GET    /jobs/:id/candidates                           → Candidate[]
POST   /jobs/:id/candidates  (FormData: files + phones[]) → { created: Candidate[] }
GET    /jobs/:id/candidates/:cid                      → Candidate
POST   /jobs/:id/candidates/:cid/call                 → { candidate_id, call_id }
```

---

## Shared Components

### `StatusBadge`
Pill badge with `rounded-full` shape and color-coded by type:

- **Job status**: `created` → gray, `calling` → blue, `debriefing` → yellow, `done` → green
- **Candidate status**: `pending` → gray, `calling` → blue, `completed` → green, `rescheduled` → yellow, `no_answer` → red
- **Recommendation**: `advance` → green, `maybe` → yellow, `reject` → red

Display the value with underscores replaced by spaces (e.g. `no_answer` → "no answer").

### `ScoreBar`
Horizontal progress bar for a score out of 10. Shows label + value on top, colored bar below:
- ≥ 7 → green
- 5–6.9 → yellow
- < 5 → red

---

## Pages

### 1. Landing Page — `/`

**Fetch**: `GET /jobs` on load.

**Layout**:
- Header: "Clawkathon" title on the left, "Create a Job" button (blue) on the right linking to `/jobs/new`
- Responsive grid of job cards (1 col → 2 col → 3 col)
- Each card links to `/jobs/:id` and shows:
  - Job title (bold)
  - `StatusBadge` for job status
  - Stats: total candidates, completed calls, candidates advancing
  - Creation date (formatted)
- Empty state: centered message with a "Create your first job" CTA button

---

### 2. Create Job Page — `/jobs/new`

**Form fields**:
- **Job Title** — text input, required
- **Job Description** — textarea (6 rows), required
- **HR Phone Number** — text input, required (phone number format)
- **Scoring Criteria** (optional section, clearly labeled):
  - Min. Years Experience — number input
  - Max Salary ($) — number input
  - Required Skills — text input (comma-separated), parsed into `string[]` before submission

**Behavior**:
- Submit button shows "Creating..." while loading, disabled during request
- On success, redirect to `/jobs/:id`
- Show inline error message on failure

**Submit payload**:
```json
{
  "title": "...",
  "jd": "...",
  "hr_phone": "...",
  "scoring_criteria": {
    "experience_years": 3,
    "max_salary": 120000,
    "skills": ["React", "TypeScript"]
  }
}
```

---

### 3. Job Detail Page — `/jobs/:id`

**Fetch**: `GET /jobs/:id` + `GET /jobs/:id/candidates` on load. Poll both every 4 seconds while job status is `calling` or `debriefing`.

**Layout**:

**Header section**:
- Job title (large, bold)
- HR phone number (gray subtext)
- `StatusBadge` for job status
- "Download Report" button — visible only when status is `done`, links to `GET /jobs/:id/report`

**Live indicator**: Pulsing blue dot + "Live" text when status is `calling` or `debriefing`

**Stats grid** (4 columns):
- Total Candidates
- Currently Calling
- Completed
- Advancing (green text)

**Resume Upload section** (card):
- Multi-file input (accepts PDF, DOCX)
- For each selected file, show a text input for the candidate's phone number (labeled with the filename)
- "Upload X Resume(s)" button — disabled while loading
- Sends as `FormData` with `files[]` and `phones[]` arrays to `POST /jobs/:id/candidates`
- Show success/error message after upload

**Start Calls section**:
- "Start Calls (N pending)" button — shown when there are pending candidates and job is not already calling
- Triggers `POST /jobs/:id/calls/start`
- Show loading state and inline error if it fails

**Candidates table**:

| Column | Content |
|---|---|
| Name | Bold name, gray phone number below |
| Status | `StatusBadge` (candidate type) |
| Score | `X.X / 10` or `—` if no score |
| Recommendation | `StatusBadge` (recommendation type) or `—` |
| Actions | "Call" button for pending/rescheduled candidates; "View" link to candidate detail |

- Hover effect on rows (`hover:bg-gray-50`)
- "Call" button triggers `POST /jobs/:id/candidates/:cid/call`

---

### 4. Candidate Detail Page — `/jobs/:id/candidates/:cid`

**Fetch**: `GET /jobs/:id/candidates/:cid` on load.

**Layout**:

**Back link**: "← Back to [Job Title]" at the top

**Header**:
- Candidate name (large, bold)
- Phone and email (gray subtext)
- `StatusBadge` (candidate type)
- `StatusBadge` (recommendation type) if recommendation exists

**Scores section** (shown only if scores exist):
- Large overall score: `X.X / 10` prominently displayed
- Four `ScoreBar` components:
  - Experience Fit
  - Communication
  - Salary Expectation
  - Availability

**Summary section** (shown only if summary exists):
- Section heading "Summary"
- Plain text paragraph

**Transcript section** (shown only if transcript exists and call is completed):
- Section heading "Call Transcript"
- Chat-bubble UI:
  - **AI recruiter messages**: left-aligned, gray bubble (`bg-gray-100`), role label "AI Recruiter"
  - **Candidate messages**: right-aligned, blue bubble (`bg-blue-600 text-white`), role label "Candidate"
- Messages rendered in sequence order
- Fallback: "No transcript available yet." if call is not completed or transcript is empty

---

## Design Guidelines

- **Primary action**: `bg-blue-600 hover:bg-blue-700 text-white` buttons with `rounded-lg` and `px-4 py-2`
- **Inputs**: `border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500`
- **Cards**: `bg-white rounded-lg border border-gray-200 p-6`
- **Page background**: `bg-gray-50 min-h-screen`
- **Disabled state**: `opacity-50 cursor-not-allowed`
- **Error messages**: red text below forms or buttons
- **Loading states**: button text changes (e.g. "Uploading...", "Creating...", "Starting...")
- **Animations**: `animate-pulse` for live indicator, `transition-colors` / `transition-shadow` for hover effects

---

## State Machine Context

**Job:** `created` → `calling` → `debriefing` → `done`

**Candidate:** `pending` → `calling` → `completed` | `rescheduled` | `no_answer`

Use these states to drive all conditional UI (which buttons show, when to poll, when to show report download, etc.).
