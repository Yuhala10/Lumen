import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** One consistent icon set: 24px grid, 1.75 stroke, round ends. No icon library to download. */

const PATHS = {
  camera: (
    <>
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.2-2h5l1.2 2h1.8A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" />
      <circle cx="12" cy="12.5" r="3.5" />
    </>
  ),
  images: (
    <>
      <rect x="3" y="6" width="14" height="14" rx="2.5" />
      <path d="M7 3h11a3 3 0 0 1 3 3v11" />
      <path d="M3 16l4-4 4 4 2.5-2.5L17 17" />
    </>
  ),
  message: <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17A2.5 2.5 0 0 1 4 14.5z" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l3 3 5-6" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 4.6a2 2 0 0 1 3.4 0l7.4 12.8a2 2 0 0 1-1.7 3H4.6a2 2 0 0 1-1.7-3z" />
      <path d="M12 10v4M12 17.2v.01" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6L6 18" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  chevronLeft: <path d="M15 6l-6 6 6 6" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  trendUp: <path d="M4 16l5-5 4 4 7-7M14 8h6v6" />,
  trendDown: <path d="M4 8l5 5 4-4 7 7M14 16h6v-6" />,
  trendFlat: <path d="M4 12h15M15 8l4 4-4 4" />,
  sparkle: <path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z" />,
  shield: (
    <>
      <path d="M12 3l7 3v5.2c0 4.4-2.9 8.1-7 9.8-4.1-1.7-7-5.4-7-9.8V6z" />
      <path d="M9 12l2.2 2.2L15.5 10" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9.5" rx="2.2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z" />
      <path d="M14.5 7.5l2 2" />
    </>
  ),
  trash: <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5l1-12.5M10 11v6M14 11v6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  refresh: <path d="M20 12a8 8 0 1 1-2.4-5.7M20 4.5V9h-4.5" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.3-4.3" />
    </>
  ),
  notebook: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2.2" />
      <path d="M9 3v18M12.5 8h3.5M12.5 12h3.5" />
    </>
  ),
  receipt: <path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21zM9 8h6M9 12h6M9 16h3" />,
  phone: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18h2" />
    </>
  ),
  store: <path d="M4 9.5L5.6 4h12.8L20 9.5M5 9.5V20h14V9.5M9.5 20v-5.5h5V20M4 9.5h16" />,
  pin: (
    <>
      <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15.5" rx="2.2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </>
  ),
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2.2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h8" />
    </>
  ),
  send: <path d="M4.5 12L20 4.5 15 20l-3-6.5zM12 13.5l8-9" />,
  zoomIn: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.3-4.3M11 8.2v5.6M8.2 11h5.6" />
    </>
  ),
  zoomOut: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.3-4.3M8.2 11h5.6" />
    </>
  ),
  table: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2.2" />
      <path d="M4 10h16M4 14.5h16M10 5v14" />
    </>
  ),
  chart: <path d="M5 20V11M10 20V5M15 20v-8M20 20v-4" />,
  history: <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4.5V9h4.5M12 8v4.2l3 1.8" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8v.01" />
    </>
  ),
  printer: (
    <>
      <path d="M7 9V3.5h10V9" />
      <rect x="4" y="9" width="16" height="8" rx="2.2" />
      <path d="M7 14h10v6.5H7z" />
    </>
  ),
  wand: <path d="M5 19L15 9M14 3.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9zM19 11l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" />,
  keyboard: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2.2" />
      <path d="M7 10h.01M11 10h.01M15 10h.01M7.5 14h9" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  undo: <path d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />,
  wallet: (
    <>
      <path d="M4 7.5h14.5A1.5 1.5 0 0 1 20 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z" />
      <path d="M4 7.5l11.5-3.2V7.5M16.5 14h.01" />
    </>
  ),
  scale: <path d="M12 4v16M6 20h12M5 7.5h14M5 7.5l-2.5 6a2.5 2.5 0 0 0 5 0zM19 7.5l-2.5 6a2.5 2.5 0 0 0 5 0z" />,
  layers: <path d="M12 3.5l8.5 4.5L12 12.5 3.5 8zM3.5 12L12 16.5 20.5 12M3.5 16L12 20.5 20.5 16" />,
  highlighter: <path d="M4 20h7M9.5 15.5l-2.5 2.5H4.5l1-3 1.5-1.5M9.5 15.5l-2.5-2.5 8.5-8.5 2.5 2.5z" />,
  dot: <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 20,
  className,
  strokeWidth = 1.75,
  label,
}: {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
  label?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      className={cn("shrink-0", className)}
    >
      {PATHS[name]}
    </svg>
  );
}
