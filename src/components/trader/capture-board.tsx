"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import type { DemoPage, Entry, IsoDate, MomoTx, Source } from "@/core/types";
import { Segmented } from "@/components/ui/segmented";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { NotebookPage } from "@/components/evidence/notebook-page";
import { useI18n } from "@/lib/i18n/context";
import { ApiError, api, errorText, uploadForm } from "@/lib/api";
import { prepareImage } from "@/lib/image";
import { makePracticePage } from "@/lib/practice";
import { cn } from "@/lib/cn";

type PhotoKind = "notebook" | "receipt" | "momo_screenshot";
type Stage = "preparing" | "uploading" | "duplicate" | "blocked" | "queued" | "reading" | "done" | "failed";

interface Item {
  key: string;
  kind: PhotoKind;
  stage: Stage;
  progress: number;
  preview?: string;
  demo?: DemoPage;
  sourceId?: string;
  error?: string;
  crossTrader?: boolean;
  lines?: number;
  attention?: number;
  momo?: number;
  document?: string;
}

export interface CaptureSource {
  id: string;
  kind: PhotoKind;
  status: Source["status"];
  hasFile: boolean;
  demo?: DemoPage;
  lines: number;
  attention: number;
  momo: number;
  document?: string;
  error?: string;
}

interface ReadResult {
  source: Source;
  entries: Entry[];
  momo: MomoTx[];
}

const KIND_ICON: Record<PhotoKind, IconName> = { notebook: "notebook", receipt: "receipt", momo_screenshot: "phone" };

function fromServer(s: CaptureSource): Item {
  const stage: Stage =
    s.status === "read" ? "done" : s.status === "failed" ? "failed" : s.status === "duplicate" ? "duplicate" : "queued";
  return {
    key: s.id,
    kind: s.kind,
    stage,
    progress: 1,
    preview: s.hasFile ? `/api/sources/${s.id}/image` : undefined,
    demo: s.demo,
    sourceId: s.id,
    error: s.error,
    lines: s.lines,
    attention: s.attention,
    momo: s.momo,
    document: s.document,
  };
}

export function CaptureBoard({
  traderId,
  sources,
  pendingLines,
  aiConfigured,
  today,
}: {
  traderId: string;
  sources: CaptureSource[];
  pendingLines: number;
  aiConfigured: boolean;
  today: IsoDate;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [kind, setKind] = useState<PhotoKind>("notebook");
  const [items, setItems] = useState<Item[]>(() => sources.map(fromServer));
  const [showAll, setShowAll] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [practicing, setPracticing] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const blobs = useRef(new Map<string, { blob: Blob; width: number; height: number; dhash: string; name: string }>());
  const queue = useRef<string[]>([]);
  const pumping = useRef(false);
  const counter = useRef(0);

  // Keep a live view of items for the reading loop.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const patch = useCallback((key: string, next: Partial<Item>) => {
    setItems((list) => list.map((it) => (it.key === key ? { ...it, ...next } : it)));
  }, []);

  const pump = useCallback(async () => {
    if (pumping.current) return;
    pumping.current = true;
    while (queue.current.length) {
      const key = queue.current.shift() as string;
      const item = itemsRef.current.find((it) => it.key === key);
      if (!item?.sourceId) continue;
      patch(key, { stage: "reading", error: undefined });
      try {
        const r = await api<ReadResult>(`/api/sources/${item.sourceId}/read`, { method: "POST" });
        const attention = r.entries.filter((e) => e.flags.length > 0).length;
        patch(key, {
          stage: "done",
          lines: r.entries.length,
          attention,
          momo: r.momo.filter((x) => !x.duplicateOf).length,
          document: r.source.reading?.document,
        });
        router.refresh();
      } catch (err) {
        patch(key, { stage: "failed", error: errorText(err, t.errors) });
        if (err instanceof ApiError && (err.code === "no_ai_key" || err.code === "ai_bad_key")) {
          queue.current = [];
          break;
        }
      }
    }
    pumping.current = false;
  }, [patch, router, t.errors]);

  const enqueue = useCallback(
    (key: string) => {
      if (!aiConfigured) return;
      if (!queue.current.includes(key)) queue.current.push(key);
      void pump();
    },
    [aiConfigured, pump],
  );

  async function upload(key: string) {
    const prepared = blobs.current.get(key);
    if (!prepared) return;
    patch(key, { stage: "uploading", progress: 0, error: undefined });
    const form = new FormData();
    form.append("file", prepared.blob, prepared.name);
    form.append("kind", itemsRef.current.find((it) => it.key === key)?.kind ?? "notebook");
    form.append("dhash", prepared.dhash);
    form.append("width", String(prepared.width));
    form.append("height", String(prepared.height));
    try {
      const source = await uploadForm<Source>(`/api/traders/${traderId}/photos`, form, (p) => patch(key, { progress: p }));
      blobs.current.delete(key);
      if (source.status === "duplicate") {
        patch(key, { stage: "duplicate", sourceId: source.id, progress: 1 });
      } else {
        patch(key, { stage: "queued", sourceId: source.id, progress: 1 });
        itemsRef.current = itemsRef.current.map((it) => (it.key === key ? { ...it, sourceId: source.id } : it));
        enqueue(key);
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "duplicate_photo") {
        blobs.current.delete(key);
        patch(key, {
          stage: "blocked",
          crossTrader: Boolean((err.details as { crossTrader?: boolean } | undefined)?.crossTrader),
        });
      } else {
        patch(key, { stage: "failed", error: errorText(err, t.errors) });
      }
    }
  }

  async function addFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (!list.length) return;
    const fresh: Item[] = list.map((f) => ({ key: `local-${++counter.current}-${f.name}`, kind, stage: "preparing", progress: 0 }));
    setItems((cur) => [...fresh, ...cur]);
    itemsRef.current = [...fresh, ...itemsRef.current];
    for (let i = 0; i < list.length; i++) {
      const key = fresh[i].key;
      try {
        const prepared = await prepareImage(list[i]);
        blobs.current.set(key, { ...prepared, name: list[i].name.replace(/\.\w+$/, "") + ".jpg" });
        patch(key, { preview: prepared.previewUrl });
        await upload(key);
      } catch (err) {
        const code = err instanceof Error ? err.message : "generic";
        patch(key, { stage: "failed", error: t.errors[code] ?? t.errors.generic });
      }
    }
  }

  async function keep(item: Item) {
    if (!item.sourceId) return;
    try {
      await api(`/api/sources/${item.sourceId}/keep`, { method: "POST" });
      patch(item.key, { stage: "queued" });
      enqueue(item.key);
    } catch (err) {
      toast(errorText(err, t.errors), "danger");
    }
  }

  async function discard(item: Item) {
    try {
      if (item.sourceId) await api(`/api/sources/${item.sourceId}`, { method: "DELETE" });
      setItems((list) => list.filter((it) => it.key !== item.key));
      router.refresh();
    } catch (err) {
      toast(errorText(err, t.errors), "danger");
    }
  }

  function retry(item: Item) {
    if (blobs.current.has(item.key)) void upload(item.key);
    else if (item.sourceId) enqueue(item.key);
  }

  const waiting = items.filter((it) => it.stage === "queued" && it.sourceId);
  const visible = showAll ? items : items.slice(0, 12);
  const toCheck = pendingLines;

  return (
    <div className="space-y-5">
      {!aiConfigured ? (
        <div className="flex gap-3 rounded-2xl border border-warn/30 bg-warn-soft px-4 py-3.5 text-[13.5px] leading-5 text-warn">
          <Icon name="info" size={18} className="mt-0.5" />
          <span>{t.capture.aiOff}</span>
        </div>
      ) : null}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-3xl border bg-surface p-5 shadow-card transition-[border-color,box-shadow] sm:p-6",
          dragging ? "border-brand ring-4 ring-brand/15" : "border-line",
        )}
      >
        <p className="mb-2.5 text-[13px] font-medium text-ink-2">{t.capture.kind}</p>
        <Segmented
          label={t.capture.kind}
          value={kind}
          onChange={setKind}
          className="flex w-full sm:w-auto"
          options={(["notebook", "receipt", "momo_screenshot"] as PhotoKind[]).map((k) => ({
            value: k,
            label: (
              <span className="inline-flex items-center gap-1.5">
                <Icon name={KIND_ICON[k]} size={15} />
                <span className="hidden sm:inline">{t.capture.kinds[k]}</span>
                <span className="sm:hidden">{t.capture.kinds[k].split(" ")[0]}</span>
              </span>
            ),
          }))}
        />

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => cameraInput.current?.click()}
            className="group flex flex-col items-center justify-center gap-2.5 rounded-2xl bg-brand px-4 py-7 text-brand-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.15),var(--shadow-md)] transition-[transform,background-color] hover:bg-brand-strong active:scale-[0.98]"
          >
            <Icon name="camera" size={30} strokeWidth={1.6} />
            <span className="text-[15px] font-semibold">{t.capture.camera}</span>
          </button>
          <button
            type="button"
            onClick={() => galleryInput.current?.click()}
            className="group flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-line bg-surface-2 px-4 py-7 text-ink transition-[transform,border-color] hover:border-line-strong active:scale-[0.98]"
          >
            <Icon name="images" size={30} strokeWidth={1.6} className="text-ink-2" />
            <span className="text-[15px] font-semibold">{t.capture.gallery}</span>
          </button>
        </div>
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={galleryInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <button
          type="button"
          disabled={practicing}
          onClick={async () => {
            setPracticing(true);
            try {
              await addFiles([await makePracticePage(today)]);
            } finally {
              setPracticing(false);
            }
          }}
          className="mt-4 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-[13.5px] text-ink-2 transition-colors hover:bg-surface-2 disabled:opacity-50"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-marker text-ink">
            {practicing ? <Spinner size={15} /> : <Icon name="wand" size={16} />}
          </span>
          <span>
            <span className="block font-medium text-ink">{t.capture.practice}</span>
            <span className="block text-[12.5px] text-ink-3">{t.capture.practiceHint}</span>
          </span>
        </button>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold">{t.capture.recent}</h2>
          {aiConfigured && waiting.length ? (
            <Button size="sm" variant="soft" icon="sparkle" onClick={() => waiting.forEach((it) => enqueue(it.key))}>
              {t.capture.readAll(waiting.length)}
            </Button>
          ) : null}
        </div>
        {items.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            <AnimatePresence initial={false}>
              {visible.map((it) => (
                <m.li key={it.key} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}>
                  <QueueCard item={it} aiConfigured={aiConfigured} onKeep={keep} onDiscard={discard} onRetry={retry} onRead={(x) => enqueue(x.key)} />
                </m.li>
              ))}
            </AnimatePresence>
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-line-strong px-5 py-10 text-center text-[14px] text-ink-3">{t.capture.none}</p>
        )}
        {items.length > 12 ? (
          <div className="mt-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
              {showAll ? t.common.showLess : `${t.common.seeAll} (${items.length})`}
            </Button>
          </div>
        ) : null}
      </section>

      <AnimatePresence>
        {toCheck > 0 ? (
          <m.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="sticky bottom-[max(1rem,env(safe-area-inset-bottom))] z-30"
          >
            <ButtonLink href={`/trader/${traderId}/review`} size="lg" iconRight="arrowRight" className="w-full shadow-float">
              {t.capture.reviewCta(toCheck)}
            </ButtonLink>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function QueueCard({
  item,
  aiConfigured,
  onKeep,
  onDiscard,
  onRetry,
  onRead,
}: {
  item: Item;
  aiConfigured: boolean;
  onKeep: (i: Item) => void;
  onDiscard: (i: Item) => void;
  onRetry: (i: Item) => void;
  onRead: (i: Item) => void;
}) {
  const { t } = useI18n();
  const busy = item.stage === "preparing" || item.stage === "uploading" || item.stage === "reading";

  let status: React.ReactNode = null;
  let tone = "text-ink-3";
  switch (item.stage) {
    case "preparing":
      status = t.capture.stage.preparing;
      break;
    case "uploading":
      status = t.capture.stage.uploading(Math.round(item.progress * 100));
      break;
    case "queued":
      status = aiConfigured ? t.capture.stage.queued : t.capture.stage.waitingKey;
      break;
    case "reading":
      status = t.capture.stage.reading;
      tone = "text-brand";
      break;
    case "duplicate":
      status = t.capture.stage.duplicate;
      tone = "text-warn";
      break;
    case "blocked":
      status = item.crossTrader ? t.errors.duplicate_photo_cross : t.capture.stage.blocked;
      tone = "text-warn";
      break;
    case "failed":
      status = item.error ?? t.capture.stage.failed;
      tone = "text-danger";
      break;
    case "done":
      if (item.document === "other") {
        status = t.capture.notRecord;
        tone = "text-warn";
      } else if (item.kind === "momo_screenshot") {
        status = t.capture.foundMomo(item.momo ?? 0);
        tone = "text-good";
      } else {
        status = t.capture.found(item.lines ?? 0, item.attention ?? 0);
        tone = item.attention ? "text-warn" : "text-good";
      }
      break;
  }

  return (
    <div className="flex gap-3.5 rounded-2xl border border-line bg-surface p-3 shadow-soft">
      <div className="relative h-24 w-[72px] shrink-0 overflow-hidden rounded-xl bg-sunken ring-1 ring-line">
        {item.demo ? (
          <NotebookPage page={item.demo} detailed={false} className="h-full w-full" />
        ) : item.preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local preview or private evidence photo
          <img src={item.preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="shimmer h-full w-full" />
        )}
        {item.stage === "reading" ? (
          <div className="absolute inset-0 overflow-hidden bg-brand/10">
            <div className="scan-line h-5 w-full bg-gradient-to-b from-transparent via-brand/50 to-transparent" />
          </div>
        ) : null}
        {item.stage === "done" && item.document !== "other" ? (
          <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-good text-white shadow">
            <Icon name="check" size={12} strokeWidth={3} />
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div>
          <p className="flex items-center gap-1.5 text-[13.5px] font-medium">
            <Icon name={KIND_ICON[item.kind]} size={15} className="text-ink-3" />
            {t.capture.kinds[item.kind]}
          </p>
          <p className={cn("mt-1 flex items-start gap-1.5 text-[13px] leading-5", tone)}>
            {busy ? <Spinner size={14} className="mt-0.5" /> : null}
            <span>{status}</span>
          </p>
        </div>
        {item.stage === "uploading" ? (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-soft">
            <div className="h-full rounded-full bg-brand transition-[width] duration-200" style={{ width: `${Math.round(item.progress * 100)}%` }} />
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.stage === "duplicate" ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => onKeep(item)}>
                {t.capture.keep}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onDiscard(item)}>
                {t.capture.discard}
              </Button>
            </>
          ) : null}
          {item.stage === "failed" ? (
            <>
              <Button size="sm" variant="secondary" icon="refresh" onClick={() => onRetry(item)}>
                {t.common.retry}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onDiscard(item)}>
                {t.capture.discard}
              </Button>
            </>
          ) : null}
          {item.stage === "queued" && aiConfigured ? (
            <Button size="sm" variant="soft" icon="sparkle" onClick={() => onRead(item)}>
              {t.capture.readNow}
            </Button>
          ) : null}
          {item.stage === "done" && item.document === "other" ? (
            <Button size="sm" variant="ghost" icon="trash" onClick={() => onDiscard(item)}>
              {t.capture.discard}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function CaptureBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[13.5px] text-ink-3 hover:text-ink">
      <Icon name="chevronLeft" size={16} />
      {label}
    </Link>
  );
}
