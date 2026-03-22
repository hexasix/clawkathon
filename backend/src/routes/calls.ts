import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as db from '../db';
import {
  createVoiceAssistant,
  initiateOutboundCall,
  waitForCallToEnd,
  getCallTranscript,
  deleteAssistant,
} from '../services/clawdtalk';
import { buildInterviewInstructions, callHrWithDebrief } from '../services/openclaw';
import { scoreCandidate } from '../services/resume';
import { generateReport } from '../services/report';

const router = Router({ mergeParams: true });

// POST /jobs/:id/calls/start
router.post('/start', async (req: Request, res: Response) => {
  const job = await db.getJobById(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const pending = await db.getPendingCandidates(job.id);
  if (pending.length === 0) {
    return res.status(400).json({ error: 'No pending candidates to call' });
  }

  await db.updateJobStatus(job.id, 'calling');

  const initiated: { candidate_id: string; call_id: string }[] = [];

  for (const candidate of pending) {
    const call = await db.createCall({
      id: uuidv4(),
      candidate_id: candidate.id,
      job_id: job.id,
      status: 'initiated',
      transcript: [],
      created_at: new Date().toISOString(),
    });

    await db.updateCandidateStatus(candidate.id, 'calling');
    initiated.push({ candidate_id: candidate.id, call_id: call.id });

    // Run each call in the background
    runCall(call.id, candidate, job).catch(err => {
      console.error(`Call failed for ${candidate.name}:`, err.message);
    });
  }

  return res.json({ message: `Initiated ${initiated.length} calls`, calls: initiated });
});

export async function runCall(callId: string, candidate: db.Candidate, job: db.Job): Promise<void> {
  let assistantId: string | undefined;
  try {
    // 1. Build interview instructions and create a voice assistant
    const { instructions, greeting } = buildInterviewInstructions(candidate, job);
    assistantId = await createVoiceAssistant({
      name: `Recruiter - ${job.title} - ${candidate.name}`,
      instructions,
      greeting,
    });
    console.log(`Assistant created for ${candidate.name}: ${assistantId}`);
    function formatPhone(phone:string) {
      return phone.replace(/[\s\-]/g, '');
    }
    const to = formatPhone(candidate.phone);
    // 2. Initiate outbound call via POST /v1/calls — returns structured call_id
    const clawdtalkCallId = await initiateOutboundCall({
      to,
      greeting,
      purpose: `Screening interview for ${job.title} with candidate ${candidate.name}.`,
      assistantId,
    });
    console.log("try to initate")
    await db.setCallClawdtalkId(callId, clawdtalkCallId);
    await db.updateCandidateStatus(candidate.id, 'calling');
    console.log(`Call initiated for ${candidate.name}, ClawdTalk ID: ${clawdtalkCallId}`);

    // 4. Poll call until completed
    await waitForCallToEnd(clawdtalkCallId);
    console.log(`Call ended for ${candidate.name}`);

    // 5. Get the transcript
    const { transcript } = await getCallTranscript(clawdtalkCallId);
    await db.updateCallTranscript(callId, transcript);
    await db.completeCall(callId);
    console.log(`Transcript fetched for ${candidate.name}: ${transcript.length} messages`);

    // 6. Score the candidate
    const scores = await scoreCandidate({
      jd: job.jd,
      scoringCriteria: job.scoring_criteria,
      resumeText: candidate.resume_text,
      transcript,
    });

    const { summary, recommendation, ...numericScores } = scores;
    await db.updateCandidateScores(candidate.id, numericScores, summary, recommendation);
    console.log(`Scored ${candidate.name}: ${scores.overall}/10 (${scores.recommendation})`);

  } catch (err) {
    await db.updateCallStatus(callId, 'failed');
    await db.updateCandidateStatus(candidate.id, 'no_answer');
    throw err;
  } finally {
    // Cleanup: delete the per-candidate assistant
    if (assistantId) {
      deleteAssistant(assistantId).catch(e =>
        console.warn(`Failed to delete assistant ${assistantId}:`, e.message)
      );
    }
  }

  // 7. If all candidates done → generate report + call HR
  if (await db.allCandidatesDone(job.id)) {
    await db.updateJobStatus(job.id, 'debriefing');
    const completed = (await db.getCandidatesByJobId(job.id)).filter(c => c.status === 'completed');
    const total = (await db.getCandidatesByJobId(job.id)).length;

    console.log(`All calls done for job ${job.id}. Generating report...`);
    await generateReport(job, completed);

    const reportUrl = `${process.env.BASE_URL || 'http://localhost:8000'}/jobs/${job.id}/report`;
    console.log(`Calling HR at ${job.hr_phone}...`);
    await callHrWithDebrief({ job, totalCandidates: total, completedCandidates: completed, reportUrl });
    await db.updateJobStatus(job.id, 'done');
  }
}

// GET /jobs/:id/calls
router.get('/', async (req: Request, res: Response) => {
  const job = await db.getJobById(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  return res.json(await db.getCallsByJobId(job.id));
});

// GET /calls/:id
export async function getCallHandler(req: Request, res: Response): Promise<Response> {
  const call = await db.getCallById(req.params.id);
  if (!call) return res.status(404).json({ error: 'Call not found' });
  const [candidate, job] = await Promise.all([
    db.getCandidateById(call.candidate_id),
    db.getJobById(call.job_id),
  ]);
  return res.json({ ...call, candidate, job });
}

// POST /calls/:id/reschedule
export async function rescheduleCallHandler(req: Request, res: Response): Promise<Response> {
  const call = await db.getCallById(req.params.id);
  if (!call) return res.status(404).json({ error: 'Call not found' });

  const { scheduled_at } = req.body as { scheduled_at?: string };
  const scheduledAt = scheduled_at ?? new Date(Date.now() + 3600000).toISOString();

  await db.rescheduleCall(call.id, scheduledAt);
  await db.updateCandidateStatus(call.candidate_id, 'rescheduled');

  return res.json({ message: 'Call rescheduled', scheduled_at: scheduledAt });
}

export default router;
