"use client";

/**
 * Photos are prepared on the phone before upload: rotated upright, shrunk to
 * a size that keeps handwriting legible, and fingerprinted so a page
 * photographed twice can be recognised even when the bytes differ.
 */

export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
  dhash: string;
  previewUrl: string;
}

const MAX_EDGE = 1800;
const QUALITY = 0.82;

export async function prepareImage(file: Blob): Promise<PreparedImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("image_unreadable");
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("image_unreadable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("image_unreadable"))), "image/jpeg", QUALITY),
  );
  return { blob, width, height, dhash: differenceHash(canvas), previewUrl: URL.createObjectURL(blob) };
}

/** 256-bit difference hash: brightness gradients on a 17×16 grid. */
export function differenceHash(source: CanvasImageSource): string {
  const c = document.createElement("canvas");
  c.width = 17;
  c.height = 16;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return "";
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, 17, 16);
  const { data } = ctx.getImageData(0, 0, 17, 16);
  const lum = (x: number, y: number) => {
    const i = (y * 17 + x) * 4;
    return data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  };
  let bits = "";
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) bits += lum(x, y) > lum(x + 1, y) ? "1" : "0";
  let hex = "";
  for (let i = 0; i < 256; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}
