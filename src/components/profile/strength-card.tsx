"use client";

import type { Strength } from "@/core/understand/strength";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Meter } from "@/components/ui/meter";
import { useI18n } from "@/lib/i18n/context";
import { cn } from "@/lib/cn";

const GRADE_COLOR: Record<string, string> = {
  strong: "var(--good)",
  good: "var(--brand)",
  fair: "var(--warn)",
  thin: "var(--danger)",
};

export function StrengthRing({ score, grade, size = 132 }: { score: number; grade: string; size?: number }) {
  const stroke = Math.round(size * 0.075);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = GRADE_COLOR[grade] ?? "var(--brand)";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`color-mix(in oklab, ${color} 16%, transparent)`} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          className="ring-draw"
          style={{ ["--ring-c" as string]: c }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-semibold leading-none tracking-[-0.03em]" style={{ fontSize: size * 0.28 }}>
          {score}
        </span>
        <span className="mt-1 text-[11px] text-ink-3">/ 100</span>
      </div>
    </div>
  );
}

export function StrengthCard({ strength, compact = false }: { strength: Strength; compact?: boolean }) {
  const { t } = useI18n();
  const color = GRADE_COLOR[strength.grade];
  return (
    <Card className="print-break p-5 sm:p-6">
      <div className="flex items-center gap-5">
        <StrengthRing score={strength.score} grade={strength.grade} size={compact ? 96 : 124} />
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-ink-3">{t.strength.title}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[22px] font-semibold tracking-[-0.02em]" style={{ color }}>
            <Icon name="shield" size={20} />
            {t.strength.grades[strength.grade]}
          </p>
          <p className="mt-1.5 text-[12.5px] leading-5 text-ink-3">{t.strength.notScore}</p>
        </div>
      </div>
      {compact ? null : (
        <ul className="mt-6 space-y-3.5">
          {strength.components.map((c) => {
            const info = t.strength.components[c.key];
            return (
              <li key={c.key}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13.5px] [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-1.5 font-medium text-ink-2">
                      {info.name}
                      <Icon name="chevronDown" size={14} className="text-ink-3 transition-transform group-open:rotate-180" />
                    </span>
                    <span className="tabular text-ink-3">
                      <span className={cn("font-semibold", c.score >= 0.8 ? "text-ink" : "text-ink-2")}>{Math.round(c.points)}</span> / {c.weight}
                    </span>
                  </summary>
                  <p className="mt-1.5 text-[12.5px] leading-5 text-ink-3">{info.body}</p>
                </details>
                <Meter className="mt-2" value={c.score} tone={c.score >= 0.75 ? "brand" : c.score >= 0.4 ? "warn" : "danger"} label={info.name} />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
