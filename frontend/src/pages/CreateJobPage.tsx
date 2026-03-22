import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { ArrowLeft, Sparkles } from 'lucide-react';

export default function CreateJobPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [jd, setJd] = useState('');
  const [hrPhone, setHrPhone] = useState('');
  const [expYears, setExpYears] = useState('');
  const [maxSalary, setMaxSalary] = useState('');
  const [skills, setSkills] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const scoring_criteria: Record<string, unknown> = {};
      if (expYears) scoring_criteria.experience_years = Number(expYears);
      if (maxSalary) scoring_criteria.max_salary = Number(maxSalary);
      if (skills.trim()) scoring_criteria.skills = skills.split(',').map((s) => s.trim()).filter(Boolean);

      const job = await api.createJob({ title, jd, hr_phone: hrPhone, scoring_criteria });
      navigate(`/jobs/${job.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="content-wrapper max-w-2xl">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors animate-fade-in-left">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <div className="mb-8 animate-fade-in" style={{ animationDelay: '50ms' }}>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight mb-2">Create a New Job</h1>
          <p className="text-muted-foreground">Set up the role and let AI handle the screening calls.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="card-surface space-y-5 animate-fade-in" style={{ animationDelay: '100ms' }}>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Job Title</label>
              <input className="input-field" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Senior Frontend Engineer" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Job Description</label>
              <textarea className="input-field resize-none" rows={6} required value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Describe the role, responsibilities, and requirements…" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">HR Phone Number</label>
              <input className="input-field" required value={hrPhone} onChange={(e) => setHrPhone(e.target.value)} placeholder="+1 555 123 4567" />
            </div>
          </div>

          <div className="card-surface space-y-5 animate-fade-in" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Scoring Criteria</h2>
              <span className="text-[11px] text-muted-foreground bg-secondary rounded px-1.5 py-0.5">Optional</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Min. Years Experience</label>
                <input type="number" min={0} className="input-field" value={expYears} onChange={(e) => setExpYears(e.target.value)} placeholder="e.g. 3" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Max Salary ($)</label>
                <input type="number" min={0} className="input-field" value={maxSalary} onChange={(e) => setMaxSalary(e.target.value)} placeholder="e.g. 120000" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Required Skills</label>
              <input className="input-field" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="React, TypeScript, Node.js" />
              <p className="text-xs text-muted-foreground mt-1.5">Comma-separated list</p>
            </div>
          </div>

          {error && <p className="text-sm text-destructive animate-fade-in">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full text-base py-3 animate-fade-in"
            style={{ animationDelay: '300ms' }}
          >
            {loading ? 'Creating…' : 'Create Job'}
          </button>
        </form>
      </div>
    </div>
  );
}
