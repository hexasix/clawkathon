import type { JobStatus, CandidateStatus, Recommendation } from '@/lib/types';

type BadgeType = 'job' | 'candidate' | 'recommendation';

const jobColors: Record<JobStatus, string> = {
  created: 'bg-muted text-muted-foreground border-border',
  calling: 'bg-primary/10 text-primary border-primary/20',
  debriefing: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  done: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

const candidateColors: Record<CandidateStatus, string> = {
  pending: 'bg-muted text-muted-foreground border-border',
  calling: 'bg-primary/10 text-primary border-primary/20',
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  rescheduled: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  no_answer: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const recommendationColors: Record<Recommendation, string> = {
  advance: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  maybe: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  reject: 'bg-red-500/10 text-red-400 border-red-500/20',
};

interface StatusBadgeProps {
  value: string;
  type: BadgeType;
}

export function StatusBadge({ value, type }: StatusBadgeProps) {
  let colorClass = 'bg-muted text-muted-foreground border-border';
  if (type === 'job') colorClass = jobColors[value as JobStatus] || colorClass;
  if (type === 'candidate') colorClass = candidateColors[value as CandidateStatus] || colorClass;
  if (type === 'recommendation') colorClass = recommendationColors[value as Recommendation] || colorClass;

  const label = value.replace(/_/g, ' ');

  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${colorClass}`}>
      {label}
    </span>
  );
}
