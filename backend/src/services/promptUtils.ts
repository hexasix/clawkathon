/**
 * Shared prompt utilities: input sanitization, JSON extraction, and output validation.
 */

export type ScoringResult = {
  communication: number;
  experience_fit: number;
  skills_match: number;
  salary_expectation: number;
  availability: number;
  motivation_fit: number;
  overall: number;
  summary: string;
  recommendation: 'advance' | 'maybe' | 'reject';
  red_flags: string[];
};

/**
 * Sanitize user-provided text before interpolating into AI prompts.
 * Removes control characters that could be used to inject fake instructions,
 * collapses excessive newlines, and enforces a maximum length.
 */
export function sanitizeUserInput(text: string, maxLength: number): string {
  // Truncate first (cheap, before more expensive ops)
  let s = String(text).slice(0, maxLength);
  // Strip null bytes and C0 control characters except \t, \n, \r
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // Collapse 3+ consecutive newlines to 2 (prevents fake section injection)
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

/**
 * Robustly extract a JSON object from an LLM response string.
 * Handles responses wrapped in markdown code fences.
 * Never throws — returns {} on failure.
 */
export function extractJsonObject(text: string): Record<string, unknown> {
  const attempt = (s: string): Record<string, unknown> | null => {
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(s.slice(start, end + 1));
    } catch {
      return null;
    }
  };

  const first = attempt(text);
  if (first !== null) return first;

  // Strip leading markdown code fence and retry
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return attempt(stripped) ?? {};
}

const VALID_RECOMMENDATIONS = new Set(['advance', 'maybe', 'reject']);

/**
 * Validate and clamp the JSON object returned by the scoring AI.
 * Warns on bad/missing fields rather than silently using defaults.
 */
export function validateScores(raw: Record<string, unknown>): ScoringResult {
  const clampScore = (field: string): number => {
    const v = Number(raw[field]);
    if (raw[field] === undefined || raw[field] === null || isNaN(v)) {
      console.warn(`[validateScores] Missing or invalid field "${field}", defaulting to 3 (insufficient evidence)`);
      return 3;
    }
    return Math.min(10, Math.max(0, v));
  };

  const recommendation = ((): 'advance' | 'maybe' | 'reject' => {
    const r = raw['recommendation'];
    if (typeof r === 'string' && VALID_RECOMMENDATIONS.has(r)) {
      return r as 'advance' | 'maybe' | 'reject';
    }
    console.warn(`[validateScores] Invalid recommendation "${r}", defaulting to "maybe"`);
    return 'maybe';
  })();

  const summary = ((): string => {
    const s = raw['summary'];
    if (typeof s === 'string' && s.trim().length > 0) return s.trim();
    console.warn('[validateScores] Missing or empty summary, using default');
    return 'No summary available';
  })();

  const red_flags = ((): string[] => {
    const r = raw['red_flags'];
    if (Array.isArray(r)) return r.filter(x => typeof x === 'string');
    return [];
  })();

  // Validate each dimension independently
  const dims = {
    communication:       clampScore('communication'),
    experience_fit:      clampScore('experience_fit'),
    skills_match:        clampScore('skills_match'),
    salary_expectation:  clampScore('salary_expectation'),
    availability:        clampScore('availability'),
    motivation_fit:      clampScore('motivation_fit'),
  };

  // Recompute overall deterministically from validated dimensions.
  // Discards the AI's returned overall to prevent upstream inflation from propagating.
  const overall = Math.round(
    (dims.experience_fit     * 0.25 +
     dims.skills_match       * 0.25 +
     dims.communication      * 0.15 +
     dims.motivation_fit     * 0.15 +
     dims.salary_expectation * 0.10 +
     dims.availability       * 0.10) * 10
  ) / 10;

  return {
    ...dims,
    overall,
    summary,
    recommendation,
    red_flags,
  };
}
