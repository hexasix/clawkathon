import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import * as db from '../db';
import { parsePdf, parseDocx, extractCandidateInfo } from '../services/resume';
import { runCall } from './calls';

const router = Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /jobs/:id/candidates
router.post('/', upload.array('files'), async (req: Request, res: Response) => {
  const job = await db.getJobById(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const created: (db.Candidate | { error: string })[] = [];

  // --- Multipart file upload ---
  if (req.files && (req.files as Express.Multer.File[]).length > 0) {
    const files = req.files as Express.Multer.File[];
    const names: string[] = req.body.names ? [].concat(req.body.names) : [];
    const phones: string[] = req.body.phones ? [].concat(req.body.phones) : [];

    for (let i = 0; i < files.length; i++) {
      try {
        const isDocx = files[i].originalname.toLowerCase().endsWith('.docx') ||
          files[i].mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        const resumeText = isDocx ? await parseDocx(files[i].buffer) : await parsePdf(files[i].buffer);
        const info = await extractCandidateInfo(resumeText);

        const candidate = await db.createCandidate({
          id: uuidv4(),
          job_id: job.id,
          name: names[i] || info.name || files[i].originalname.replace(/\.(pdf|docx)$/i, ''),
          phone: phones[i] || info.phone || '',
          email: info.email,
          resume_text: resumeText,
          status: 'pending',
          created_at: new Date().toISOString(),
        });
        created.push(candidate);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        created.push({ error: `Failed to process ${files[i].originalname}: ${msg}` });
      }
    }

    return res.status(201).json({ created });
  }

  // --- JSON body ---
  const { candidates } = req.body as {
    candidates?: Array<{ name: string; phone: string; email?: string; resume_text?: string }>;
  };
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return res.status(400).json({ error: 'Provide files (multipart) or candidates array (JSON)' });
  }

  for (const c of candidates) {
    try {
      const candidate = await db.createCandidate({
        id: uuidv4(),
        job_id: job.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        resume_text: c.resume_text ?? '',
        status: 'pending',
        created_at: new Date().toISOString(),
      });
      created.push(candidate);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      created.push({ error: msg });
    }
  }

  return res.status(201).json({ created });
});

// GET /jobs/:id/candidates
router.get('/', async (req: Request, res: Response) => {
  const job = await db.getJobById(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  return res.json(await db.getCandidatesByJobId(job.id));
});

// GET /jobs/:id/candidates/:cid
router.get('/:cid', async (req: Request, res: Response) => {
  const candidate = await db.getCandidateById(req.params.cid);
  if (!candidate || candidate.job_id !== req.params.id) {
    return res.status(404).json({ error: 'Candidate not found' });
  }
  const calls = await db.getCallsByCandidateId(candidate.id);
  return res.json({ ...candidate, calls });
});

// POST /jobs/:id/candidates/:cid/call
router.post('/:cid/call', async (req: Request, res: Response) => {
  const job = await db.getJobById(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const candidate = await db.getCandidateById(req.params.cid);
  if (!candidate || candidate.job_id !== job.id) {
    return res.status(404).json({ error: 'Candidate not found' });
  }

  if (candidate.status !== 'pending' && candidate.status !== 'rescheduled') {
    return res.status(400).json({ error: `Candidate status is '${candidate.status}', must be 'pending' or 'rescheduled'` });
  }

  // Transition job to calling if needed
  if (job.status === 'created' || job.status === 'done') {
    await db.updateJobStatus(job.id, 'calling');
  }

  const call = await db.createCall({
    id: uuidv4(),
    candidate_id: candidate.id,
    job_id: job.id,
    status: 'initiated',
    transcript: [],
    created_at: new Date().toISOString(),
  });

  await db.updateCandidateStatus(candidate.id, 'calling');

  // Run call in the background
  runCall(call.id, candidate, job).catch(err => {
    console.error(`Call failed for ${candidate.name}:`, err.message);
  });

  return res.json({ candidate_id: candidate.id, call_id: call.id });
});

export default router;
