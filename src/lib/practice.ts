"use client";

import type { IsoDate } from "@/core/types";
import { addDays, weekday } from "@/core/dates";

/**
 * Draws a realistic handwritten notebook page on a canvas, so the full
 * pipeline (upload, AI reading, review) can be tried without a real notebook.
 */

const ITEMS = [
  ["Tomates", "tas", [500, 1000]],
  ["Piment", "tas", [200, 300]],
  ["Plantain", "régime", [3500, 4000]],
  ["Oignons", "tas", [500]],
  ["Ndolé", "bottes", [250]],
  ["Macabo", "tas", [1000]],
  ["Gombo", "tas", [200]],
] as const;

const DAYS_FR = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/** Market notebooks in Cameroon are mostly kept in French, so the practice page is too. */
export async function makePracticePage(today: IsoDate): Promise<File> {
  const family = getComputedStyle(document.documentElement).getPropertyValue("--font-hand-kalam").trim() || "cursive";
  await document.fonts.load(`40px ${family}`).catch(() => undefined);

  const W = 1200;
  const H = 1600;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("image_unreadable");

  // paper with grain
  ctx.fillStyle = "#fbf7ec";
  ctx.fillRect(0, 0, W, H);
  const grain = ctx.getImageData(0, 0, W, H);
  for (let i = 0; i < grain.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    grain.data[i] += n;
    grain.data[i + 1] += n;
    grain.data[i + 2] += n;
  }
  ctx.putImageData(grain, 0, 0);

  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(((Math.random() - 0.5) * 2.4 * Math.PI) / 180);
  ctx.translate(-W / 2, -H / 2);

  ctx.strokeStyle = "#c3d4ea";
  ctx.lineWidth = 2;
  for (let y = 230; y < H - 40; y += 92) {
    ctx.beginPath();
    ctx.moveTo(0, y + 20);
    ctx.lineTo(W, y + 20);
    ctx.stroke();
  }
  ctx.strokeStyle = "#e79c9c";
  ctx.beginPath();
  ctx.moveTo(110, 0);
  ctx.lineTo(110, H);
  ctx.stroke();

  const date = addDays(today, -1);
  const [y, m, d] = date.split("-");
  const header = `${DAYS_FR[weekday(date)]} ${d}/${m}/${y}`;
  ctx.fillStyle = "#1c3a8c";
  ctx.font = `700 58px ${family}`;
  ctx.fillText(header, 150, 150);

  ctx.font = `48px ${family}`;
  let total = 0;
  const count = 6 + Math.floor(Math.random() * 3);
  let yPos = 300;
  for (let i = 0; i < count; i++) {
    const [name, unit, prices] = pick(ITEMS);
    const qty = 1 + Math.floor(Math.random() * 3);
    const amount = qty * pick(prices);
    total += amount;
    ctx.save();
    ctx.translate(0, yPos);
    ctx.rotate(((Math.random() - 0.5) * 1.2 * Math.PI) / 180);
    ctx.fillText(`${name} ${qty} ${unit}`, 150 + Math.random() * 10, 0);
    ctx.textAlign = "right";
    ctx.fillText(amount.toLocaleString("fr-FR").replace(/ | /g, " "), 1080, 0);
    ctx.restore();
    yPos += 92;
  }
  ctx.font = `700 52px ${family}`;
  ctx.fillText("Total ventes", 150, yPos + 20);
  ctx.textAlign = "right";
  ctx.fillText(total.toLocaleString("fr-FR").replace(/ | /g, " "), 1080, yPos + 20);
  ctx.restore();

  // soft vignette like a phone photo
  const g = ctx.createRadialGradient(W * 0.4, H * 0.3, 200, W / 2, H / 2, H * 0.8);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(1, "rgba(80,60,30,0.18)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("image_unreadable"))), "image/jpeg", 0.9),
  );
  return new File([blob], `practice-${date}.jpg`, { type: "image/jpeg" });
}
