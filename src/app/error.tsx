"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/context";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center sm:px-6">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-soft text-danger">
        <Icon name="alert" size={26} />
      </span>
      <p className="mt-5 text-[17px] font-semibold">{t.errors.generic}</p>
      <Button className="mt-6" icon="refresh" onClick={reset}>
        {t.common.retry}
      </Button>
    </div>
  );
}
