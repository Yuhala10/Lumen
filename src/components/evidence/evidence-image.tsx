"use client";

import { useEffect, useRef, useState } from "react";
import type { Box, Source } from "@/core/types";
import { PAGE_H, PAGE_W } from "@/core/demo/layout";
import { NotebookPage } from "./notebook-page";
import { IconButton } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";
import { cn } from "@/lib/cn";

export type SourceView = Pick<Source, "id" | "kind" | "file" | "demo">;

export interface Highlight {
  key: string;
  box: Box;
  tone?: "marker" | "outline" | "faint" | "danger";
}

/**
 * A page of evidence with highlights drawn in the page's own coordinates
 * (0–1000 on both axes). The marker sweeps across the line like a real
 * highlighter. Tall pages scroll so the highlighted line is centred.
 */
export function EvidenceImage({
  source,
  highlights = [],
  focus,
  zoomable = true,
  maxHeight = "62dvh",
  onBoxClick,
  className,
}: {
  source: SourceView;
  highlights?: Highlight[];
  focus?: Box;
  zoomable?: boolean;
  maxHeight?: string;
  onBoxClick?: (key: string) => void;
  className?: string;
}) {
  const { t } = useI18n();
  const scroller = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(false);
  const [loaded, setLoaded] = useState(Boolean(source.demo));

  const width = source.demo ? PAGE_W : (source.file?.width ?? 3);
  const height = source.demo ? PAGE_H : (source.file?.height ?? 4);

  useEffect(() => {
    const el = scroller.current;
    if (!el || !focus) return;
    const inner = el.firstElementChild as HTMLElement | null;
    if (!inner) return;
    const cy = ((focus[0] + focus[2]) / 2 / 1000) * inner.offsetHeight;
    const cx = ((focus[1] + focus[3]) / 2 / 1000) * inner.offsetWidth;
    el.scrollTo({
      top: Math.max(0, cy - el.clientHeight / 2),
      left: zoom ? Math.max(0, cx - el.clientWidth / 2) : 0,
      behavior: "smooth",
    });
  }, [focus, zoom, loaded]);

  return (
    <div className={cn("relative", className)}>
      <div
        ref={scroller}
        className="overflow-auto overscroll-contain rounded-xl bg-sunken ring-1 ring-line"
        style={{ maxHeight }}
      >
        <div className="relative transition-[width] duration-300" style={{ width: zoom ? "200%" : "100%", aspectRatio: `${width} / ${height}` }}>
          {source.demo ? (
            <NotebookPage page={source.demo} className="absolute inset-0 h-full w-full" />
          ) : (
            <>
              {!loaded ? <div className="shimmer absolute inset-0" /> : null}
              {/* eslint-disable-next-line @next/next/no-img-element -- private evidence photo served by our own API */}
              <img
                src={`/api/sources/${source.id}/image`}
                alt=""
                decoding="async"
                onLoad={() => setLoaded(true)}
                className={cn("absolute inset-0 h-full w-full object-fill transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0")}
              />
            </>
          )}
          <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
            {highlights.map((h) => {
              const [y0, x0, y1, x1] = h.box;
              const common = {
                x: x0,
                y: y0,
                width: x1 - x0,
                height: y1 - y0,
                rx: 6,
                onClick: onBoxClick ? () => onBoxClick(h.key) : undefined,
                style: onBoxClick ? { cursor: "pointer" } : undefined,
              };
              if (h.tone === "outline") {
                return (
                  <rect key={h.key} {...common} fill="color-mix(in oklab, var(--brand) 10%, transparent)" stroke="var(--brand)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
                );
              }
              if (h.tone === "danger") {
                return (
                  <rect key={h.key} {...common} fill="color-mix(in oklab, var(--danger) 12%, transparent)" stroke="var(--danger)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
                );
              }
              if (h.tone === "faint") {
                return <rect key={h.key} {...common} fill="transparent" stroke="var(--line-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" className="transition-colors hover:fill-[var(--marker)]" />;
              }
              return (
                <rect
                  key={`${h.key}-${h.box.join("-")}`}
                  {...common}
                  className="marker-sweep"
                  fill="var(--marker)"
                  style={{ ...common.style, mixBlendMode: "multiply" }}
                />
              );
            })}
          </svg>
        </div>
      </div>
      {zoomable ? (
        <div className="absolute right-2 top-2 rounded-xl bg-surface/90 shadow-soft backdrop-blur">
          <IconButton icon={zoom ? "zoomOut" : "zoomIn"} label={zoom ? t.evidence.zoomOut : t.evidence.zoomIn} onClick={() => setZoom((z) => !z)} />
        </div>
      ) : null}
    </div>
  );
}
