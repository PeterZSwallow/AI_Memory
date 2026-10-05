import Link from "next/link";
import { getI18n } from "@/lib/i18n";

export async function Footer() {
  const { t } = await getI18n();
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <span className="font-bold text-slate-800">{t.brand}</span> · {t.tagline}
          <div className="mt-1 text-xs">{t.common.footer}</div>
        </div>
        <div className="flex gap-5">
          <Link href="/search" className="hover:text-slate-800">{t.home.ctaBrowse}</Link>
          <Link href="/insights" className="hover:text-slate-800">{t.nav.insights}</Link>
          <Link href="/listing/new" className="hover:text-slate-800">{t.nav.post}</Link>
        </div>
      </div>
    </footer>
  );
}
