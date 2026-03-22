import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import type { Job } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { Plus, Users, CheckCircle, ArrowUpRight, Briefcase } from 'lucide-react';

export default function LandingPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getJobs()
      .then(setJobs)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const totalCandidates = jobs.reduce((sum, j) => sum + (j.stats?.total || 0), 0);
  const totalAdvancing = jobs.reduce((sum, j) => sum + (j.stats?.advance || 0), 0);
  const activeJobs = jobs.filter((j) => j.status === 'calling' || j.status === 'debriefing').length;

  return (
    <div className="page-container">
      <div className="content-wrapper">
        {/* Hero */}
        <div className="mb-10 animate-fade-in">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-foreground tracking-tight leading-[1.1] mb-3">
            Your <span className="gradient-text">Hiring Pipeline</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl">
            AI-powered phone screens, scored and summarized automatically.
          </p>
        </div>

        {/* Quick Stats */}
        {!loading && jobs.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[
              { label: 'Active Jobs', value: activeJobs },
              { label: 'Total Candidates', value: totalCandidates },
              { label: 'Advancing', value: totalAdvancing },
            ].map((s, i) => (
              <div
                key={s.label}
                className="rounded-xl bg-secondary/50 border border-border px-4 py-3 text-center animate-fade-in"
                style={{ animationDelay: `${100 + i * 80}ms` }}
              >
                <p className="text-2xl font-bold tabular-nums text-foreground">{s.value}</p>
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="gradient-line mb-8 animate-fade-in" style={{ animationDelay: '200ms' }} />

        {loading && (
          <div className="py-20 text-center animate-pulse text-muted-foreground">Loading jobs…</div>
        )}
        {error && (
          <div className="py-20 text-center text-destructive animate-fade-in">{error}</div>
        )}

        {!loading && !error && jobs.length === 0 && (
          <div className="text-center py-24 animate-fade-in" style={{ animationDelay: '150ms' }}>
            <div className="h-16 w-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-5">
              <Briefcase className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-5 text-lg">No jobs created yet</p>
            <Link to="/jobs/new" className="btn-primary inline-flex items-center gap-2">
              <Plus className="h-4 w-4" /> Create your first job
            </Link>
          </div>
        )}

        {!loading && jobs.length > 0 && (
          <div className="space-y-3">
            {jobs.map((job, i) => (
              <Link
                key={job.id}
                to={`/jobs/${job.id}`}
                className="card-surface group flex items-center gap-5 transition-all duration-300 hover:border-primary/30 animate-fade-in"
                style={{ animationDelay: `${200 + 80 * i}ms` }}
              >
                {/* Left accent */}
                <div className="hidden sm:flex h-12 w-12 shrink-0 rounded-lg bg-secondary items-center justify-center group-hover:bg-primary/10 transition-colors duration-300">
                  <Briefcase className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1">
                    <h2 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors duration-200">{job.title}</h2>
                    <StatusBadge value={job.status} type="job" />
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {job.stats && (
                      <>
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" /> {job.stats.total}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle className="h-3.5 w-3.5" /> {job.stats.completed}
                        </span>
                        {job.stats.advance > 0 && (
                          <span className="text-emerald-400 font-medium">{job.stats.advance} advancing</span>
                        )}
                      </>
                    )}
                    <span className="text-xs">
                      {new Date(job.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>

                {/* Arrow */}
                <ArrowUpRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200 shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
