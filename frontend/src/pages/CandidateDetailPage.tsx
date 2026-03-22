import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '@/lib/api';
import type { Candidate, Job } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { ScoreBar } from '@/components/ScoreBar';
import { ArrowLeft } from 'lucide-react';

export default function CandidateDetailPage() {
  const { id, cid } = useParams<{ id: string; cid: string }>();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !cid) return;
    Promise.all([api.getCandidate(id, cid), api.getJob(id)])
      .then(([c, j]) => { setCandidate(c); setJob(j); })
      .finally(() => setLoading(false));
  }, [id, cid]);

  if (loading) return <div className="page-container"><div className="content-wrapper text-center text-muted-foreground py-20 animate-pulse">Loading…</div></div>;
  if (!candidate) return <div className="page-container"><div className="content-wrapper text-center text-destructive py-20 animate-fade-in">Candidate not found</div></div>;

  const transcript = candidate.calls?.[0]?.transcript?.sort((a, b) => a.sequence - b.sequence) || [];
  const callCompleted = candidate.calls?.[0]?.status === 'completed';

  return (
    <div className="page-container">
      <div className="content-wrapper max-w-3xl">
        <Link to={`/jobs/${id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors animate-fade-in-left">
          <ArrowLeft className="h-4 w-4" /> Back to {job?.title || 'Job'}
        </Link>

        {/* Header */}
        <div className="mb-8 animate-fade-in" style={{ animationDelay: '50ms' }}>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight mb-2">{candidate.name}</h1>
          <p className="text-sm text-muted-foreground mb-3">
            {candidate.phone}{candidate.email && ` · ${candidate.email}`}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge value={candidate.status} type="candidate" />
            {candidate.recommendation && <StatusBadge value={candidate.recommendation} type="recommendation" />}
          </div>
        </div>

        <div className="gradient-line mb-8" />

        {/* Scores */}
        {candidate.scores && (
          <div className="card-surface mb-6 animate-fade-in" style={{ animationDelay: '150ms' }}>
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-5xl font-extrabold gradient-text tabular-nums">{candidate.scores.overall.toFixed(1)}</span>
              <span className="text-muted-foreground text-lg font-medium">/ 10</span>
            </div>
            <div className="grid gap-5">
              <ScoreBar label="Experience Fit" value={candidate.scores.experience_fit} />
              <ScoreBar label="Communication" value={candidate.scores.communication} />
              <ScoreBar label="Salary Expectation" value={candidate.scores.salary_expectation} />
              <ScoreBar label="Availability" value={candidate.scores.availability} />
            </div>
          </div>
        )}

        {/* Summary */}
        {candidate.summary && (
          <div className="card-surface mb-6 animate-fade-in" style={{ animationDelay: '250ms' }}>
            <h2 className="font-semibold text-foreground mb-3">Summary</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{candidate.summary}</p>
          </div>
        )}

        {/* Transcript */}
        <div className="card-surface animate-fade-in" style={{ animationDelay: '350ms' }}>
          <h2 className="font-semibold text-foreground mb-5">Call Transcript</h2>
          {!callCompleted || transcript.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transcript available yet.</p>
          ) : (
            <div className="space-y-3">
              {transcript.map((entry, i) => (
                <div
                  key={i}
                  className={`flex animate-fade-in ${entry.role === 'candidate' ? 'justify-end' : 'justify-start'}`}
                  style={{ animationDelay: `${400 + i * 60}ms` }}
                >
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${entry.role === 'candidate' ? 'bg-primary/15 text-foreground rounded-br-md border border-primary/20' : 'bg-secondary text-foreground rounded-bl-md border border-border'}`}>
                    <p className={`text-[10px] font-semibold mb-1 uppercase tracking-wider ${entry.role === 'candidate' ? 'text-primary' : 'text-muted-foreground'}`}>
                      {entry.role === 'ai' ? 'AI Recruiter' : 'Candidate'}
                    </p>
                    <p className="text-sm leading-relaxed">{entry.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
