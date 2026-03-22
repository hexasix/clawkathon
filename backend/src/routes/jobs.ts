import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as db from '../db';

const router = Router();

// POST /jobs
router.post('/', async (req: Request, res: Response) => {
  const { title, jd, hr_phone, scoring_criteria } = req.body;
  if (!title || !jd || !hr_phone) {
    return res.status(400).json({ error: 'title, jd, and hr_phone are required' });
  }

  const job = await db.createJob({
    id: uuidv4(),
    title,
    jd,
    hr_phone,
    scoring_criteria: scoring_criteria ?? {},
    status: 'created',
    created_at: new Date().toISOString(),
  });

  return res.status(201).json(job);
});

// GET /jobs
router.get('/', async (req: Request, res: Response) => {
  const jobs = await db.getAllJobs();

  const jobsWithStats = await Promise.all(
    jobs.map(async (job) => {
      const candidates = await db.getCandidatesByJobId(job.id);
      return {
        ...job,
        stats: {
          total: candidates.length,
          pending: candidates.filter(c => c.status === 'pending').length,
          calling: candidates.filter(c => c.status === 'calling').length,
          completed: candidates.filter(c => c.status === 'completed').length,
          rescheduled: candidates.filter(c => c.status === 'rescheduled').length,
          no_answer: candidates.filter(c => c.status === 'no_answer').length,
          advance: candidates.filter(c => c.recommendation === 'advance').length,
        },
      };
    })
  );

  return res.json(jobsWithStats);
});

// GET /jobs/:id
router.get('/:id', async (req: Request, res: Response) => {
  const job = await db.getJobById(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const candidates = await db.getCandidatesByJobId(job.id);

  return res.json({
    ...job,
    stats: {
      total: candidates.length,
      pending: candidates.filter(c => c.status === 'pending').length,
      calling: candidates.filter(c => c.status === 'calling').length,
      completed: candidates.filter(c => c.status === 'completed').length,
      rescheduled: candidates.filter(c => c.status === 'rescheduled').length,
      no_answer: candidates.filter(c => c.status === 'no_answer').length,
      advance: candidates.filter(c => c.recommendation === 'advance').length,
    },
  });
});

export default router;
