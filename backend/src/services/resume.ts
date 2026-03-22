import pdfParse from 'pdf-parse';
import axios from 'axios';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require('mammoth') as { extractRawText(opts: { buffer: Buffer }): Promise<{ value: string }> };

const client = axios.create({
  baseURL: process.env.OPENCLAW_BASE_URL || 'http://localhost:18789',
  headers: {
    Authorization: `Bearer ${process.env.OPENCLAW_TOKEN || ''}`,
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

async function ask(prompt: string): Promise<string> {
  const response = await client.post('/v1/chat/completions', {
    model: 'openclaw:recruiter',
    messages: [{ role: 'user', content: prompt }],
    stream: false,
  });
  return response.data.choices?.[0]?.message?.content ?? '';
}

export async function parsePdf(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return data.text;
}

export async function parseDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export async function extractCandidateInfo(resumeText: string): Promise<{
  name?: string;
  email?: string;
  phone?: string;
  years_experience?: number;
  skills?: string[];
  current_role?: string;
}> {
  const prompt = `Extract the following fields from this resume and return ONLY a valid JSON object, no explanation:
- name (string)
- email (string)
- phone (string)
- years_experience (number)
- skills (array of strings)
- current_role (string)

Resume:
${resumeText.slice(0, 3000)}

Return only JSON.`;

  const text = await ask(prompt);
  try {
    const json = text.match(/\{[\s\S]*\}/)?.[0] ?? '{}';
    return JSON.parse(json);
  } catch {
    return {};
  }
}

export async function scoreCandidate(params: {
  jd: string;
  scoringCriteria: Record<string, unknown>;
  resumeText: string;
  transcript: Array<{ role: string; text: string }>;
}): Promise<{
  communication: number;
  experience_fit: number;
  salary_expectation: number;
  availability: number;
  overall: number;
  summary: string;
  recommendation: 'advance' | 'maybe' | 'reject';
}> {
  const { jd, scoringCriteria, resumeText, transcript } = params;
  const transcriptText = transcript.map(e => `${e.role === 'ai' ? 'Recruiter' : 'Candidate'}: ${e.text}`).join('\n');
  const skills = Array.isArray(scoringCriteria.skills) ? (scoringCriteria.skills as string[]).join(', ') : 'N/A';

  const prompt = `Score this job candidate based on their interview. Return ONLY a valid JSON object, no explanation.

Job Description: ${jd.slice(0, 800)}
Required experience: ${scoringCriteria.experience_years ?? 'N/A'} years
Key skills: ${skills}
Budget: ${scoringCriteria.max_salary ? `$${scoringCriteria.max_salary}` : 'flexible'}

Resume: ${resumeText.slice(0, 800)}

Interview Transcript:
${transcriptText}

Return this exact JSON structure:
{
  "communication": <0-10>,
  "experience_fit": <0-10>,
  "salary_expectation": <0-10, where 10 = well within budget>,
  "availability": <0-10, where 10 = available immediately>,
  "overall": <0-10 weighted average>,
  "summary": "<one paragraph summary for HR>",
  "recommendation": "<advance|maybe|reject>"
}`;

  const text = await ask(prompt);
  try {
    const json = text.match(/\{[\s\S]*\}/)?.[0] ?? '{}';
    return JSON.parse(json);
  } catch {
    return {
      communication: 5, experience_fit: 5, salary_expectation: 5, availability: 5,
      overall: 5, summary: 'Could not score', recommendation: 'maybe',
    };
  }
}
