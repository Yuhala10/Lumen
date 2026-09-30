"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/context";
import { api, errorText } from "@/lib/api";

export function ResetDemo() {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      icon="refresh"
      loading={busy}
      onClick={async () => {
        if (!window.confirm(t.landing.resetConfirm)) return;
        setBusy(true);
        try {
          await api("/api/demo/reset", { method: "POST" });
          toast(t.landing.resetDone);
          router.refresh();
        } catch (err) {
          toast(errorText(err, t.errors), "danger");
        } finally {
          setBusy(false);
        }
      }}
    >
      {t.landing.reset}
    </Button>
  );
}
