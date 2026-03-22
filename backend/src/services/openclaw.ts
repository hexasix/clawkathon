import axios from 'axios';
import type { Candidate, Job } from '../db';

const OPENCLAW_BASE_URL = process.env.OPENCLAW_BASE_URL || 'http://localhost:18789';
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN || '';

const client = axios.create({
  baseURL: OPENCLAW_BASE_URL,
  headers: {
    Authorization: `Bearer ${OPENCLAW_TOKEN}`,
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

/**
 * Build voice assistant instructions and greeting for a candidate interview.
 * Pure function — no API calls.
 */
export function buildInterviewInstructions(candidate: Candidate, job: Job): {
  instructions: string;
  greeting: string;
} {
  const criteria = job.scoring_criteria as Record<string, unknown>;
  const skills = Array.isArray(criteria.skills) ? (criteria.skills as string[]).join(', ') : 'N/A';

  const instructions = `You are a professional AI phone recruiter conducting a screening interview.

Position: ${job.title}

Job Description:
${job.jd}

Candidate: ${candidate.name}
Resume (excerpt):
${candidate.resume_text.slice(0, 1500)}

Scoring Criteria:
- Required experience: ${criteria.experience_years ?? 'N/A'} years
- Key skills: ${skills}
- Max salary budget: ${criteria.max_salary ? `$${criteria.max_salary}` : 'flexible'}

Interview guidelines:
- Introduce yourself as an AI recruiter from the hiring team
- Keep responses short and conversational (1-2 sentences) — this is a phone call
- Ask ONE question at a time
- Follow up dynamically on interesting answers
- Cover: years of experience, relevant skills, salary expectations, availability/notice period
- After 5-8 exchanges when you have enough info, politely wrap up and thank the candidate`;

  const greeting = `Hi ${candidate.name}, this is an AI recruiter calling about the ${job.title} position. Do you have a few minutes for a quick screening call?`;

  return { instructions, greeting };
}

/**
 * Tell OpenClaw to call the HR manager with the recruiting debrief.
 */
export async function callHrWithDebrief(params: {
  job: Job;
  totalCandidates: number;
  completedCandidates: Candidate[];
  reportUrl: string;
}): Promise<void> {
  const { job, totalCandidates, completedCandidates, reportUrl } = params;
  const sorted = [...completedCandidates].sort((a, b) => ((b.scores?.overall ?? 0) - (a.scores?.overall ?? 0)));
  const recommended = sorted.filter(c => c.recommendation === 'advance');
  const top = sorted[0];

  const prompt = `Send an SMS to the HR manager at ${job.hr_phone} with the following recruiting debrief. Send it exactly as written, no changes:

"${job.title} Screening Complete
Candidates reached: ${completedCandidates.length}/${totalCandidates}
Recommended: ${recommended.length}

${top ? `#1 ${top.name} — ${top.scores?.overall?.toFixed(1)}/10: ${top.summary}` : 'No strong candidates identified.'}
${recommended.slice(1).map((c, i) => `#${i + 2} ${c.name} — ${c.scores?.overall?.toFixed(1)}/10: ${c.summary}`).join('\n')}

Full report: ${reportUrl}"`;


  await client.post('/v1/chat/completions', {
    model: 'openclaw:recruiter',
    messages: [{ role: 'user', content: prompt }],
    stream: false,
    user: `hr-debrief-${job.id}`,
  });
}
