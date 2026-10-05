"use client";

import { BarChart3, Heart, LayoutList, LogOut, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/actions";
import { useI18n } from "./i18n-provider";

export function UserMenu({ name, unread }: { name: string; unread: number }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  const item = "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100";
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 ring-2 ring-white"
        aria-label={t.nav.profile}
      >
        {name.slice(0, 1).toUpperCase()}
      </button>
      {open && (
        <div className="card absolute right-0 mt-2 w-56 p-1.5" onClick={() => setOpen(false)}>
          <div className="truncate px-3 py-2 text-sm font-semibold">{name}</div>
          <Link href="/me" className={item}>
            <LayoutList className="h-4 w-4" /> {t.nav.myListings}
          </Link>
          <Link href="/me?tab=favorites" className={item}>
            <Heart className="h-4 w-4" /> {t.nav.favorites}
          </Link>
          <Link href="/messages" className={item}>
            <MessageCircle className="h-4 w-4" /> {t.nav.messages}
            {unread > 0 && <span className="ml-auto rounded-full bg-rose-500 px-1.5 text-xs font-bold text-white">{unread}</span>}
          </Link>
          <Link href="/insights" className={item}>
            <BarChart3 className="h-4 w-4" /> {t.nav.insights}
          </Link>
          <form action={logout}>
            <button type="submit" className={`${item} w-full text-rose-600`}>
              <LogOut className="h-4 w-4" /> {t.nav.logout}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
