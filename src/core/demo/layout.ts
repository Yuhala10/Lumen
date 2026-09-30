import type { Box, DemoPage } from "../types.ts";

/**
 * Layout of a generated notebook page. Shared by the demo generator (which
 * derives each line's evidence box from it) and the page renderer (which
 * draws the page), so highlights always land exactly on the right line.
 */

export const PAGE_W = 750;
export const PAGE_H = 1000;
export const MARGIN_X = 96;
export const AMOUNT_X = 680;
export const HEADER_Y = 118;
export const FIRST_LINE_Y = 196;
export const LINE_H = 58;
export const MAX_DEMO_LINES = 11;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface LaidOutLine {
  text: string;
  amount: string;
  y: number;
  dx: number;
  rotate: number;
  box: Box;
}

export interface PageLayout {
  header: { text: string; y: number };
  lines: LaidOutLine[];
  total?: LaidOutLine;
  rules: number[];
}

function boxFor(y: number): Box {
  const toX = (px: number) => Math.round((px / PAGE_W) * 1000);
  return [Math.round(y - 40), toX(MARGIN_X - 16), Math.round(y + 16), toX(AMOUNT_X + 24)];
}

export function layoutDemoPage(page: DemoPage): PageLayout {
  const rand = mulberry32(page.seed);
  const jitter = () => ({ dx: (rand() - 0.5) * 10, rotate: (rand() - 0.5) * 1.4 });
  const lines = page.lines.slice(0, MAX_DEMO_LINES).map((l, i) => {
    const y = FIRST_LINE_Y + i * LINE_H;
    return { ...l, y, ...jitter(), box: boxFor(y) };
  });
  const totalY = FIRST_LINE_Y + lines.length * LINE_H + 22;
  const total = page.total ? { ...page.total, y: totalY, ...jitter(), box: boxFor(totalY) } : undefined;
  const rules: number[] = [];
  for (let y = FIRST_LINE_Y - LINE_H; y < PAGE_H - 30; y += LINE_H) rules.push(y + 14);
  return { header: { text: page.header, y: HEADER_Y }, lines, total, rules };
}
