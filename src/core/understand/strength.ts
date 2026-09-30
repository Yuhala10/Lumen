/**
 * Understand: evidence strength.
 *
 * This is not a credit score. It measures how well the profile is backed by
 * evidence, so a lender knows how much weight the numbers can bear.
 * Five components, each 0 to 1, weighted to a total of 100.
 */

export type Grade = "strong" | "good" | "fair" | "thin";
export type StrengthKey = "coverage" | "verification" | "corroboration" | "consistency" | "integrity";

export interface StrengthComponent {
  key: StrengthKey;
  weight: number;
  score: number;
  points: number;
}

export interface Strength {
  score: number;
  grade: Grade;
  components: StrengthComponent[];
}

export interface StrengthInput {
  weeksSpan: number;
  recordedWeeks: number;
  fullRecordedWeeks: number;
  confirmed: number;
  pending: number;
  momoInflows: number;
  corroborationRate: number;
  checksPassed: number;
  checksTotal: number;
  entriesCounted: number;
  duplicateLines: number;
  blockedDuplicates: number;
  crossTraderAttempts: number;
}

/** Weeks of records that earn full coverage marks. */
export const FULL_COVERAGE_WEEKS = 8;
/** Mobile money payments needed before corroboration earns full weight. */
export const MIN_INFLOWS = 3;

export const WEIGHTS: Record<StrengthKey, number> = {
  coverage: 25,
  verification: 25,
  corroboration: 25,
  consistency: 15,
  integrity: 10,
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function gradeFor(score: number): Grade {
  if (score >= 80) return "strong";
  if (score >= 60) return "good";
  if (score >= 40) return "fair";
  return "thin";
}

export function evidenceStrength(i: StrengthInput): Strength {
  const coverage = i.weeksSpan
    ? (i.recordedWeeks / i.weeksSpan) * Math.min(1, i.fullRecordedWeeks / FULL_COVERAGE_WEEKS)
    : 0;

  const reviewed = i.confirmed + i.pending;
  const verification = reviewed ? i.confirmed / reviewed : 0;

  const corroboration =
    i.momoInflows >= MIN_INFLOWS
      ? i.corroborationRate
      : i.momoInflows > 0
        ? i.corroborationRate * (i.momoInflows / MIN_INFLOWS)
        : 0;

  // No written totals is neutral, not a failure: many traders never write them.
  const consistency = i.checksTotal ? i.checksPassed / i.checksTotal : 0.5;

  const duplicateShare = i.entriesCounted ? i.duplicateLines / i.entriesCounted : 0;
  const integrity =
    1 - 0.1 * i.blockedDuplicates - 0.5 * i.crossTraderAttempts - Math.min(0.5, duplicateShare * 5);

  const scores: Record<StrengthKey, number> = {
    coverage: clamp01(coverage),
    verification: clamp01(verification),
    corroboration: clamp01(corroboration),
    consistency: clamp01(consistency),
    integrity: clamp01(integrity),
  };

  const components = (Object.keys(WEIGHTS) as StrengthKey[]).map((key) => ({
    key,
    weight: WEIGHTS[key],
    score: Math.round(scores[key] * 1000) / 1000,
    points: Math.round(scores[key] * WEIGHTS[key] * 10) / 10,
  }));

  const hasEvidence = i.entriesCounted > 0;
  const score = hasEvidence ? Math.round(components.reduce((s, c) => s + c.score * c.weight, 0)) : 0;
  return { score, grade: gradeFor(score), components };
}
