import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      jd TEXT NOT NULL,
      hr_phone TEXT NOT NULL,
      scoring_criteria JSONB NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'created',
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES jobs(id),
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      resume_text TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      scores JSONB,
      summary TEXT,
      recommendation TEXT,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS calls (
      id TEXT PRIMARY KEY,
      candidate_id TEXT NOT NULL REFERENCES candidates(id),
      job_id TEXT NOT NULL REFERENCES jobs(id),
      clawdtalk_call_id TEXT,
      status TEXT NOT NULL DEFAULT 'initiated',
      transcript JSONB NOT NULL DEFAULT '[]',
      scheduled_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL
    );
  `);

}

// --- Types ---

export interface Job {
  id: string;
  title: string;
  jd: string;
  hr_phone: string;
  scoring_criteria: Record<string, unknown>;
  status: 'created' | 'calling' | 'debriefing' | 'done';
  created_at: string;
}

export interface Candidate {
  id: string;
  job_id: string;
  name: string;
  phone: string;
  email?: string;
  resume_text: string;
  status: 'pending' | 'calling' | 'completed' | 'rescheduled' | 'no_answer';
  scores?: Record<string, number>;
  summary?: string;
  recommendation?: 'advance' | 'maybe' | 'reject';
  created_at: string;
}

export interface TranscriptEntry {
  role: 'ai' | 'candidate';
  text: string;
  timestamp: string;
  sequence: number;
}

export interface Call {
  id: string;
  candidate_id: string;
  job_id: string;
  clawdtalk_call_id?: string;
  status: 'initiated' | 'in_progress' | 'completed' | 'failed' | 'rescheduled';
  transcript: TranscriptEntry[];
  scheduled_at?: string;
  completed_at?: string;
  created_at: string;
}

// --- Jobs ---

export async function createJob(job: Job): Promise<Job> {
  const { rows } = await pool.query(
    `INSERT INTO jobs (id, title, jd, hr_phone, scoring_criteria, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [job.id, job.title, job.jd, job.hr_phone, job.scoring_criteria, job.status, job.created_at]
  );
  return rows[0];
}

export async function getJobById(id: string): Promise<Job | null> {
  const { rows } = await pool.query(`SELECT * FROM jobs WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function updateJobStatus(id: string, status: Job['status']): Promise<void> {
  await pool.query(`UPDATE jobs SET status = $1 WHERE id = $2`, [status, id]);
}

export async function getAllJobs(): Promise<Job[]> {
  const { rows } = await pool.query(`SELECT * FROM jobs ORDER BY created_at DESC`);
  return rows;
}

// --- Candidates ---

export async function createCandidate(c: Candidate): Promise<Candidate> {
  const { rows } = await pool.query(
    `INSERT INTO candidates (id, job_id, name, phone, email, resume_text, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [c.id, c.job_id, c.name, c.phone, c.email ?? null, c.resume_text, c.status, c.created_at]
  );
  return rows[0];
}

export async function getCandidateById(id: string): Promise<Candidate | null> {
  const { rows } = await pool.query(`SELECT * FROM candidates WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function getCandidatesByJobId(jobId: string): Promise<Candidate[]> {
  const { rows } = await pool.query(
    `SELECT * FROM candidates WHERE job_id = $1
     ORDER BY COALESCE((scores->>'overall')::float, -1) DESC`,
    [jobId]
  );
  return rows;
}

export async function getPendingCandidates(jobId: string): Promise<Candidate[]> {
  const { rows } = await pool.query(
    `SELECT * FROM candidates WHERE job_id = $1 AND status = 'pending'`,
    [jobId]
  );
  return rows;
}

export async function updateCandidateStatus(id: string, status: Candidate['status']): Promise<void> {
  await pool.query(`UPDATE candidates SET status = $1 WHERE id = $2`, [status, id]);
}

export async function updateCandidateScores(
  id: string,
  scores: Record<string, number>,
  summary: string,
  recommendation: string
): Promise<void> {
  await pool.query(
    `UPDATE candidates SET scores = $1, summary = $2, recommendation = $3, status = 'completed' WHERE id = $4`,
    [scores, summary, recommendation, id]
  );
}

export async function allCandidatesDone(jobId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status = 'completed') AS completed
     FROM candidates WHERE job_id = $1`,
    [jobId]
  );
  const { total, completed } = rows[0];
  return Number(total) > 0 && Number(total) === Number(completed);
}

// --- Calls ---

export async function createCall(call: Call): Promise<Call> {
  const { rows } = await pool.query(
    `INSERT INTO calls (id, candidate_id, job_id, clawdtalk_call_id, status, transcript, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [call.id, call.candidate_id, call.job_id, call.clawdtalk_call_id ?? null, call.status, JSON.stringify(call.transcript ?? []), call.created_at]
  );
  return rows[0];
}

export async function getCallById(id: string): Promise<Call | null> {
  const { rows } = await pool.query(`SELECT * FROM calls WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function getCallByClawdtalkId(clawdtalkCallId: string): Promise<Call | null> {
  const { rows } = await pool.query(`SELECT * FROM calls WHERE clawdtalk_call_id = $1`, [clawdtalkCallId]);
  return rows[0] ?? null;
}

export async function getCallsByJobId(jobId: string): Promise<Call[]> {
  const { rows } = await pool.query(`SELECT * FROM calls WHERE job_id = $1`, [jobId]);
  return rows;
}

export async function getCallsByCandidateId(candidateId: string): Promise<Call[]> {
  const { rows } = await pool.query(`SELECT * FROM calls WHERE candidate_id = $1`, [candidateId]);
  return rows;
}

export async function setCallClawdtalkId(id: string, clawdtalkCallId: string): Promise<void> {
  await pool.query(
    `UPDATE calls SET clawdtalk_call_id = $1, status = 'in_progress' WHERE id = $2`,
    [clawdtalkCallId, id]
  );
}

export async function updateCallStatus(id: string, status: Call['status']): Promise<void> {
  await pool.query(`UPDATE calls SET status = $1 WHERE id = $2`, [status, id]);
}

export async function updateCallTranscript(id: string, transcript: TranscriptEntry[]): Promise<void> {
  await pool.query(`UPDATE calls SET transcript = $1 WHERE id = $2`, [JSON.stringify(transcript), id]);
}

export async function completeCall(id: string): Promise<void> {
  await pool.query(
    `UPDATE calls SET status = 'completed', completed_at = NOW() WHERE id = $1`,
    [id]
  );
}

export async function rescheduleCall(id: string, scheduledAt: string): Promise<void> {
  await pool.query(
    `UPDATE calls SET status = 'rescheduled', scheduled_at = $1 WHERE id = $2`,
    [scheduledAt, id]
  );
}
