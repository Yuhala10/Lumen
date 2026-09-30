"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/context";
import { api, errorText } from "@/lib/api";

export function DeleteBusiness({ traderId }: { traderId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="danger"
      size="sm"
      icon="trash"
      loading={busy}
      onClick={async () => {
        if (!window.confirm(t.hub.deleteConfirm)) return;
        setBusy(true);
        try {
          await api(`/api/traders/${traderId}`, { method: "DELETE" });
          router.push("/trader");
          router.refresh();
        } catch (err) {
          toast(errorText(err, t.errors), "danger");
          setBusy(false);
        }
      }}
    >
      {t.hub.deleteBusiness}
    </Button>
  );
}
