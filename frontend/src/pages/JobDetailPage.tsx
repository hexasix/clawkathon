import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '@/lib/api';
import type { Job, Candidate } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { ArrowLeft, Download, Phone, Eye, Upload, Play, Users, PhoneCall, CheckCircle, ArrowUpRight, RotateCcw } from 'lucide-react';

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [files, setFiles] = useState<File[]>([]);
  const [phones, setPhones] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [startingCalls, setStartingCalls] = useState(false);
  const [callError, setCallError] = useState('');
  const [callingCandidate, setCallingCandidate] = useState<string | null>(null);
  const [reschedulingCandidate, setReschedulingCandidate] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [j, c] = await Promise.all([api.getJob(id), api.getCandidates(id)]);
      setJob(j);
      setCandidates(c);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!job || (job.status !== 'calling' && job.status !== 'debriefing')) return;
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [job?.status, fetchData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    setFiles(selected);
    setPhones(selected.map(() => ''));
    setUploadMsg('');
  };

  const handleUpload = async () => {
    if (!id || files.length === 0) return;
    setUploading(true);
    setUploadMsg('');
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      phones.forEach((p) => fd.append('phones', p));
      const res = await api.uploadCandidates(id, fd);
      setUploadMsg(`${res.created.length} candidate(s) uploaded.`);
      setFiles([]);
      setPhones([]);
      if (fileRef.current) fileRef.current.value = '';
      fetchData();
    } catch (e: unknown) {
      setUploadMsg(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleStartCalls = async () => {
    if (!id) return;
    setStartingCalls(true);
    setCallError('');
    try {
      await api.startCalls(id);
      fetchData();
    } catch (e: unknown) {
      setCallError(e instanceof Error ? e.message : 'Failed to start calls');
    } finally {
      setStartingCalls(false);
    }
  };

  const handleCallCandidate = async (cid: string) => {
    if (!id) return;
    setCallingCandidate(cid);
    try {
      await api.callCandidate(id, cid);
      fetchData();
    } catch {} finally {
      setCallingCandidate(null);
    }
  };

  const handleReschedule = async (candidate: Candidate) => {
    if (!id) return;
    setReschedulingCandidate(candidate.id);
    try {
      const candidateWithCalls = candidate.calls?.length ? candidate : await api.getCandidate(id, candidate.id);
      const latestCall = candidateWithCalls.calls
        ?.slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      if (!latestCall) throw new Error('No call found to reschedule');

      await api.rescheduleCall(latestCall.id);
      fetchData();
    } catch {} finally {
      setReschedulingCandidate(null);
    }
  };

  if (loading) return <div className="page-container"><div className="content-wrapper text-center text-muted-foreground py-20 animate-pulse">Loading…</div></div>;
  if (error || !job) return <div className="page-container"><div className="content-wrapper text-center text-destructive py-20 animate-fade-in">{error || 'Job not found'}</div></div>;

  const pendingCount = candidates.filter((c) => c.status === 'pending').length;
  const isLive = job.status === 'calling' || job.status === 'debriefing';

  return (
    <div className="page-container">
      <div className="content-wrapper">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors animate-fade-in-left">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8 animate-fade-in">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-extrabold text-foreground tracking-tight">{job.title}</h1>
              {isLive && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <span className="h-2 w-2 rounded-full bg-primary animate-pulse-glow" />
                  Live
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-3">{job.hr_phone}</p>
            <StatusBadge value={job.status} type="job" />
          </div>
          {job.status === 'done' && (
            <a href={api.getJobReportUrl(job.id)} target="_blank" rel="noreferrer" className="btn-primary inline-flex items-center gap-2 animate-scale-in">
              <Download className="h-4 w-4" /> Download Report
            </a>
          )}
        </div>

        {/* Stats */}
        {job.stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              { label: 'Total', value: job.stats.total, icon: Users },
              { label: 'Calling', value: job.stats.calling, icon: PhoneCall },
              { label: 'Done', value: job.stats.completed, icon: CheckCircle },
              { label: 'Advancing', value: job.stats.advance, icon: ArrowUpRight, accent: true },
            ].map((s, i) => (
              <div
                key={s.label}
                className={`rounded-xl border px-4 py-4 text-center animate-fade-in ${s.accent ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-border bg-secondary/30'}`}
                style={{ animationDelay: `${100 + i * 80}ms` }}
              >
                <s.icon className={`h-4 w-4 mx-auto mb-2 ${s.accent ? 'text-emerald-400' : 'text-muted-foreground'}`} />
                <p className={`text-2xl font-bold tabular-nums ${s.accent ? 'text-emerald-400' : 'text-foreground'}`}>{s.value}</p>
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="gradient-line mb-8" />

        {/* Upload */}
        <div className="card-surface mb-6 animate-fade-in" style={{ animationDelay: '200ms' }}>
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" /> Upload Resumes
          </h2>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".pdf,.docx"
            onChange={handleFileChange}
            className="block text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:brightness-110 file:cursor-pointer file:transition-all cursor-pointer"
          />
          {files.length > 0 && (
            <div className="mt-5 space-y-3 animate-fade-in">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
                  <span className="text-sm text-foreground truncate min-w-0 flex-1">{f.name}</span>
                  <input
                    className="input-field max-w-[200px]"
                    placeholder="Phone number"
                    value={phones[i]}
                    onChange={(e) => {
                      const next = [...phones];
                      next[i] = e.target.value;
                      setPhones(next);
                    }}
                  />
                </div>
              ))}
              <button onClick={handleUpload} disabled={uploading} className="btn-primary">
                {uploading ? 'Uploading…' : `Upload ${files.length} Resume(s)`}
              </button>
            </div>
          )}
          {uploadMsg && (
            <p className={`text-sm mt-3 animate-fade-in ${uploadMsg.includes('failed') || uploadMsg.includes('Failed') ? 'text-destructive' : 'text-emerald-400'}`}>
              {uploadMsg}
            </p>
          )}
        </div>

        {/* Start Calls */}
        {pendingCount > 0 && job.status !== 'calling' && (
          <div className="mb-6 animate-fade-in" style={{ animationDelay: '250ms' }}>
            <button onClick={handleStartCalls} disabled={startingCalls} className="btn-primary inline-flex items-center gap-2">
              <Play className="h-4 w-4" />
              {startingCalls ? 'Starting…' : `Start Calls (${pendingCount} pending)`}
            </button>
            {callError && <p className="text-sm text-destructive mt-2 animate-fade-in">{callError}</p>}
          </div>
        )}

        {/* Candidates Table */}
        {candidates.length > 0 && (
          <div className="card-surface overflow-x-auto animate-fade-in" style={{ animationDelay: '300ms' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Name</th>
                  <th className="pb-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Status</th>
                  <th className="pb-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Score</th>
                  <th className="pb-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Recommendation</th>
                  <th className="pb-3 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors duration-150">
                    <td className="py-3.5 pr-4">
                      <p className="font-medium text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{c.phone}</p>
                    </td>
                    <td className="py-3.5 pr-4"><StatusBadge value={c.status} type="candidate" /></td>
                    <td className="py-3.5 pr-4 tabular-nums font-medium">{c.scores ? `${c.scores.overall.toFixed(1)} / 10` : '—'}</td>
                    <td className="py-3.5 pr-4">{c.recommendation ? <StatusBadge value={c.recommendation} type="recommendation" /> : '—'}</td>
                    <td className="py-3.5 text-right space-x-2">
                      {(c.status === 'pending' || c.status === 'rescheduled') && (
                        <button
                          onClick={() => handleCallCandidate(c.id)}
                          disabled={callingCandidate === c.id}
                          className="btn-primary text-xs px-3 py-1.5 inline-flex items-center gap-1"
                        >
                          <Phone className="h-3 w-3" /> {callingCandidate === c.id ? '…' : 'Call'}
                        </button>
                      )}
                      {c.status === 'no_answer' && (
                        <button
                          onClick={() => handleReschedule(c)}
                          disabled={reschedulingCandidate === c.id}
                          className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all duration-200 active:scale-[0.97]"
                        >
                          <RotateCcw className="h-3 w-3" /> {reschedulingCandidate === c.id ? '…' : 'Reschedule'}
                        </button>
                      )}
                      <Link to={`/jobs/${job.id}/candidates/${c.id}`} className="text-muted-foreground hover:text-foreground text-xs inline-flex items-center gap-1 transition-colors">
                        <Eye className="h-3 w-3" /> View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
