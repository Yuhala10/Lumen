"use client";

import type { ReactNode } from "react";
import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
import type { Locale } from "@/core/types";
import { I18nProvider } from "@/lib/i18n/context";
import { ToastProvider } from "@/components/ui/toast";

/** Motion is loaded lazily with the small feature set, and respects reduced-motion settings. */
export function Providers({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <I18nProvider locale={locale}>
      <LazyMotion features={domAnimation} strict>
        <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 380, damping: 34 }}>
          <ToastProvider>{children}</ToastProvider>
        </MotionConfig>
      </LazyMotion>
    </I18nProvider>
  );
}
