import { useId } from "react";
import type { DemoPage } from "@/core/types";
import { AMOUNT_X, layoutDemoPage, MARGIN_X, PAGE_H, PAGE_W } from "@/core/demo/layout";

/**
 * Draws a demo notebook page: ruled paper, a red margin, handwriting in blue
 * or black ink, each line slightly uneven. Uses the same layout as the demo
 * generator, so evidence boxes land exactly on their lines.
 */
export function NotebookPage({ page, detailed = true, className }: { page: DemoPage; detailed?: boolean; className?: string }) {
  const layout = layoutDemoPage(page);
  const uid = useId().replace(/:/g, "");
  const ink = page.ink === "blue" ? "var(--ink-blue)" : "var(--ink-black)";
  const hand = { fontFamily: "var(--font-hand)" };

  return (
    <svg viewBox={`0 0 ${PAGE_W} ${PAGE_H}`} className={className} role="img" aria-label={page.header}>
      <defs>
        {detailed ? (
          <filter id={`grain-${uid}`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix values="0 0 0 0 0.42  0 0 0 0 0.38  0 0 0 0 0.3  0 0 0 0.07 0" />
          </filter>
        ) : null}
        <radialGradient id={`light-${uid}`} cx="30%" cy="20%" r="95%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#8a7a5a" stopOpacity="0.12" />
        </radialGradient>
      </defs>
      <rect width={PAGE_W} height={PAGE_H} fill="var(--paper)" />
      {detailed ? <rect width={PAGE_W} height={PAGE_H} filter={`url(#grain-${uid})`} /> : null}

      <g transform={`rotate(${page.tilt} ${PAGE_W / 2} ${PAGE_H / 2})`}>
        {layout.rules.map((y) => (
          <line key={y} x1={-20} x2={PAGE_W + 20} y1={y} y2={y} stroke="var(--paper-rule)" strokeWidth={1.6} />
        ))}
        <line x1={MARGIN_X - 28} x2={MARGIN_X - 28} y1={-20} y2={PAGE_H + 20} stroke="var(--paper-margin)" strokeWidth={1.8} />

        <g style={hand} fill={ink}>
          <text x={MARGIN_X} y={layout.header.y} fontSize={37} fontWeight={700}>
            {page.header}
          </text>
          <path
            d={`M${MARGIN_X} ${layout.header.y + 11} q ${Math.min(360, page.header.length * 17) / 2} 7 ${Math.min(360, page.header.length * 17)} -1`}
            stroke={ink}
            strokeWidth={2.4}
            fill="none"
            strokeLinecap="round"
          />

          {layout.lines.map((l, i) => (
            <g key={i} transform={`rotate(${l.rotate} ${MARGIN_X} ${l.y})`}>
              <text x={MARGIN_X + l.dx} y={l.y} fontSize={31}>
                {l.text}
              </text>
              <text x={AMOUNT_X + l.dx} y={l.y} fontSize={31} textAnchor="end">
                {l.amount}
              </text>
            </g>
          ))}

          {layout.total ? (
            <g transform={`rotate(${layout.total.rotate} ${MARGIN_X} ${layout.total.y})`}>
              <path d={`M${AMOUNT_X - 170} ${layout.total.y - 44} h 175`} stroke={ink} strokeWidth={2} strokeLinecap="round" />
              <text x={MARGIN_X + layout.total.dx} y={layout.total.y} fontSize={33} fontWeight={700}>
                {layout.total.text}
              </text>
              <text x={AMOUNT_X + layout.total.dx} y={layout.total.y} fontSize={33} fontWeight={700} textAnchor="end">
                {layout.total.amount}
              </text>
              <path
                d={`M${AMOUNT_X - 150} ${layout.total.y + 10} h 160 M${AMOUNT_X - 150} ${layout.total.y + 16} h 160`}
                stroke={ink}
                strokeWidth={1.8}
                strokeLinecap="round"
              />
            </g>
          ) : null}
        </g>
      </g>
      <rect width={PAGE_W} height={PAGE_H} fill={`url(#light-${uid})`} />
    </svg>
  );
}
