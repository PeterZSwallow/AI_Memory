"use client";

import { useTransition } from "react";
import { setLanguage } from "@/app/actions";
import { useI18n } from "./i18n-provider";

export function LanguageSwitcher() {
  const { locale } = useI18n();
  const [pending, start] = useTransition();
  const next = locale === "ru" ? "en" : "ru";
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => setLanguage(next))}
      className="rounded-xl px-2.5 py-2 text-xs font-bold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
      title={next === "en" ? "English" : "Русский"}
    >
      {next}
    </button>
  );
}
