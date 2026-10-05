"use client";

import { Search, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useI18n } from "./i18n-provider";

function SearchBarInner({ compact, examples }: { compact?: boolean; examples?: string[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  useEffect(() => setQ(params.get("q") ?? ""), [params]);

  const go = (query: string) => {
    const sp = new URLSearchParams();
    if (query.trim()) sp.set("q", query.trim());
    router.push(`/search?${sp.toString()}`);
  };

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(q);
        }}
        className={`flex items-center gap-2 rounded-2xl bg-white ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-brand-500 ${
          compact ? "p-1" : "p-2 shadow-xl shadow-brand-600/10"
        }`}
      >
        <Sparkles className={`ml-2 shrink-0 text-fuchsia-500 ${compact ? "h-4 w-4" : "h-5 w-5"}`} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={compact ? t.search.button + "…" : t.search.placeholder}
          className={`min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400 ${compact ? "py-1.5 text-sm" : "py-2.5 text-base"}`}
          aria-label={t.search.button}
        />
        <button type="submit" className={compact ? "rounded-xl bg-brand-600 p-2 text-white hover:bg-brand-700" : "btn-primary px-6 py-3"}>
          <Search className="h-4 w-4" />
          {!compact && <span>{t.search.button}</span>}
        </button>
      </form>
      {examples && (
        <div className="mt-3 flex flex-wrap gap-2">
          {examples.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => go(ex)}
              className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-white hover:text-brand-700"
            >
              {ex}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SearchBar(props: { compact?: boolean; examples?: string[] }) {
  return (
    <Suspense fallback={<div className="h-10 rounded-2xl bg-slate-100" />}>
      <SearchBarInner {...props} />
    </Suspense>
  );
}
