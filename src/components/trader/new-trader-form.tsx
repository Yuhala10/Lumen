"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Provider, Trader } from "@/core/types";
import { CAMEROON_CITIES, TraderInputSchema } from "@/core/validation";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/context";
import { api, errorText } from "@/lib/api";
import { cn } from "@/lib/cn";

type Field = "name" | "business" | "market" | "city" | "phone";

export function NewTraderForm() {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState({ name: "", business: "", market: "", city: "Yaoundé", phone: "" });
  const [providers, setProviders] = useState<Provider[]>(["mtn"]);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [busy, setBusy] = useState(false);

  const set = (k: Field) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const toggle = (p: Provider) => setProviders((list) => (list.includes(p) ? list.filter((x) => x !== p) : [...list, p]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = TraderInputSchema.safeParse({ ...values, providers });
    if (!parsed.success) {
      const next: Partial<Record<Field, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as Field;
        if (!next[key]) next[key] = t.newTrader.validation[issue.message] ?? t.errors.invalid_input;
      }
      setErrors(next);
      const first = Object.keys(next)[0];
      if (first) document.getElementById(`f-${first}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const trader = await api<Trader>("/api/traders", { body: { ...values, providers } });
      router.push(`/trader/${trader.id}/capture`);
    } catch (err) {
      toast(errorText(err, t.errors), "danger");
      setBusy(false);
    }
  }

  const field = (k: Field, label: string, input: React.ReactNode, hint?: string) => (
    <div>
      <Label htmlFor={`f-${k}`}>{label}</Label>
      {input}
      {errors[k] ? <FieldError id={`e-${k}`}>{errors[k]}</FieldError> : hint ? <FieldHint>{hint}</FieldHint> : null}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {field(
        "name",
        t.newTrader.name,
        <Input id="f-name" value={values.name} onChange={set("name")} placeholder={t.newTrader.namePlaceholder} autoComplete="name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "e-name" : undefined} />,
      )}
      <div>
        {field(
          "business",
          t.newTrader.business,
          <Input id="f-business" value={values.business} onChange={set("business")} placeholder={t.newTrader.businessPlaceholder} aria-invalid={Boolean(errors.business)} />,
        )}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {t.newTrader.businessSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setValues((v) => ({ ...v, business: s }));
                setErrors((x) => ({ ...x, business: undefined }));
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-[12.5px] transition-colors",
                values.business === s ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface text-ink-2 hover:border-line-strong",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {field(
          "market",
          t.newTrader.market,
          <Input id="f-market" value={values.market} onChange={set("market")} placeholder={t.newTrader.marketPlaceholder} aria-invalid={Boolean(errors.market)} />,
        )}
        {field(
          "city",
          t.newTrader.city,
          <Select id="f-city" value={values.city} onChange={set("city")}>
            {CAMEROON_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>,
        )}
      </div>
      {field(
        "phone",
        `${t.newTrader.phone} (${t.common.optional})`,
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-ink-3">+237</span>
          <Input
            id="f-phone"
            value={values.phone}
            onChange={set("phone")}
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="6XX XXX XXX"
            className="pl-[3.9rem]"
            aria-invalid={Boolean(errors.phone)}
          />
        </div>,
        t.newTrader.phoneHint,
      )}

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-ink-2">{t.newTrader.providers}</legend>
        <div className="grid grid-cols-2 gap-3">
          {(["mtn", "orange"] as Provider[]).map((p) => {
            const on = providers.includes(p);
            return (
              <button
                key={p}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(p)}
                className={cn(
                  "flex h-14 items-center justify-between rounded-xl border px-4 text-[14.5px] font-medium transition-[border-color,background-color] duration-150",
                  on ? "border-brand bg-brand-soft text-ink" : "border-line bg-surface text-ink-2 hover:border-line-strong",
                )}
              >
                <span className="flex items-center gap-2.5">
                  <Icon name="wallet" size={18} className={on ? "text-brand" : "text-ink-3"} />
                  {t.providers[p]}
                </span>
                <span className={cn("flex h-5 w-5 items-center justify-center rounded-md border", on ? "border-brand bg-brand text-brand-ink" : "border-line-strong")}>
                  {on ? <Icon name="check" size={13} strokeWidth={3} /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <Button type="submit" size="lg" className="w-full" loading={busy} iconRight="arrowRight">
        {t.newTrader.submit}
      </Button>
    </form>
  );
}
