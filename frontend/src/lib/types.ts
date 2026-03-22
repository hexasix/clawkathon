export type JobStatus = 'created' | 'calling' | 'debriefing' | 'done';
export type CandidateStatus = 'pending' | 'calling' | 'completed' | 'rescheduled' | 'no_answer';
export type Recommendation = 'advance' | 'maybe' | 'reject';

export interface ScoringCriteria {
  experience_years?: number;
  skills?: string[];
  max_salary?: number;
}

export interface JobStats {
  total: number;
  pending: number;
  calling: number;
  completed: number;
  rescheduled: number;
  no_answer: number;
  advance: number;
}

export interface Job {
  id: string;
  title: string;
  jd: string;
  hr_phone: string;
  scoring_criteria: ScoringCriteria;
  status: JobStatus;
  created_at: string;
  stats?: JobStats;
}

export interface Scores {
  communication: number;
  experience_fit: number;
  salary_expectation: number;
  availability: number;
  overall: number;
}

export interface TranscriptEntry {
  role: 'ai' | 'candidate';
  text: string;
  timestamp: string;
  sequence: number;
}

export interface Call {
  id: string;
  candidate_id: string;
  job_id: string;
  status: string;
  transcript: TranscriptEntry[];
  scheduled_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface Candidate {
  id: string;
  job_id: string;
  name: string;
  phone: string;
  email?: string;
  resume_text?: string;
  status: CandidateStatus;
  scores?: Scores;
  summary?: string;
  recommendation?: Recommendation;
  created_at: string;
  calls?: Call[];
}
