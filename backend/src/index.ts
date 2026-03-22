import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDb } from './db';

import jobsRouter from './routes/jobs';
import candidatesRouter from './routes/candidates';
import callsRouter, { getCallHandler, rescheduleCallHandler } from './routes/calls';
import { getReportPath } from './services/report';

const app = express();
const PORT = process.env.PORT ?? 8000;

app.use(cors());
app.use(express.json());

app.use('/jobs', jobsRouter);
app.use('/jobs/:id/candidates', candidatesRouter);
app.use('/jobs/:id/calls', callsRouter);
app.get('/calls/:id', getCallHandler);
app.post('/calls/:id/reschedule', rescheduleCallHandler);

app.get('/jobs/:id/report', async (req, res) => {
  const filePath = await getReportPath(req.params.id);
  if (!filePath) {
    return res.status(404).json({ error: 'Report not ready yet. Calls may still be in progress.' });
  }
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="report-${req.params.id}.md"`);
  return res.sendFile(filePath);
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`AI Recruiter backend running on http://localhost:${PORT}`);
    console.log(`OpenClaw: ${process.env.OPENCLAW_BASE_URL}`);
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
