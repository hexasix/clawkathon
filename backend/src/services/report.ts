import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import type { Job, Candidate } from '../db';

const OPENCLAW_BASE_URL = process.env.OPENCLAW_BASE_URL || 'http://localhost:18789';
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN || '';
const REPORTS_DIR = path.join(__dirname, '../../reports');

export async function generateReport(job: Job, candidates: Candidate[]): Promise<string> {
  await fs.mkdir(REPORTS_DIR, { recursive: true });

  const sorted = [...candidates].sort((a, b) => ((b.scores?.overall ?? 0) - (a.scores?.overall ?? 0)));
  const advanced = sorted.filter(c => c.recommendation === 'advance');
  const maybe = sorted.filter(c => c.recommendation === 'maybe');
  const rejected = sorted.filter(c => c.recommendation === 'reject');

  const candidateSummaries = sorted.map((c, i) => `
Candidate #${i + 1}: ${c.name}
Phone: ${c.phone}
Recommendation: ${c.recommendation?.toUpperCase()}
Scores:
- Overall: ${c.scores?.overall?.toFixed(1) ?? 'N/A'}/10
- Communication: ${c.scores?.communication?.toFixed(1) ?? 'N/A'}/10
- Experience Fit: ${c.scores?.experience_fit?.toFixed(1) ?? 'N/A'}/10
- Salary Expectation: ${c.scores?.salary_expectation?.toFixed(1) ?? 'N/A'}/10
- Availability: ${c.scores?.availability?.toFixed(1) ?? 'N/A'}/10
Summary: ${c.summary ?? 'No summary available'}
`).join('\n---\n');

  const prompt = `You are writing a professional recruiting report for an HR manager.

Job Title: ${job.title}
Total Candidates Screened: ${candidates.length}
Recommended to Advance: ${advanced.length}
Maybe: ${maybe.length}
Rejected: ${rejected.length}

Here are the candidate results:
${candidateSummaries}

Write a complete recruiting report in Markdown format with:
1. An executive summary (3-5 sentences covering overall talent pool quality, key findings)
2. A ranked shortlist table for candidates recommended to advance (columns: Rank, Name, Overall Score, Key Strength, Availability)
3. Brief notes on "maybe" candidates (worth considering if top picks decline)
4. Hiring recommendation — which candidate to prioritize and why
5. Next steps section

Be direct and useful. This is for a busy HR manager who will act on this immediately.`;

  const response = await axios.post(
    `${OPENCLAW_BASE_URL}/v1/chat/completions`,
    {
      model: 'openclaw:recruiter',
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      user: `report-${job.id}`,
    },
    {
      headers: {
        Authorization: `Bearer ${OPENCLAW_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  const reportContent: string = response.data.choices?.[0]?.message?.content ?? 'Report generation failed.';

  const header = `# Recruiting Report: ${job.title}
Generated: ${new Date().toLocaleString()}
Job ID: ${job.id}

---

`;

  const fullReport = header + reportContent;
  const filePath = path.join(REPORTS_DIR, `${job.id}.md`);
  await fs.writeFile(filePath, fullReport, 'utf-8');

  return filePath;
}

export async function getReportPath(jobId: string): Promise<string | null> {
  const filePath = path.join(REPORTS_DIR, `${jobId}.md`);
  try {
    await fs.access(filePath);
    return filePath;
  } catch {
    return null;
  }
}
