import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { SmartImage } from "@/components/smart-image";
import { requireUser } from "@/lib/auth";
import { getConversations } from "@/lib/chat";
import { formatPrice, timeAgo } from "@/lib/format";
import { getI18n } from "@/lib/i18n";

export default async function MessagesPage() {
  const user = await requireUser("/messages");
  const { t, locale } = await getI18n();
  const convs = await getConversations(user.id);
  return (
    <div className="mx-auto max-w-3xl pt-6">
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight">{t.messages.title}</h1>
      {convs.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-16 text-center">
          <MessageCircle className="h-12 w-12 text-slate-300" />
          <div className="mt-4 text-lg font-semibold">{t.messages.empty}</div>
          <div className="mt-1 text-sm text-slate-500">{t.messages.emptyHint}</div>
        </div>
      ) : (
        <ul className="card divide-y divide-slate-100 overflow-hidden">
          {convs.map((c) => (
            <li key={c.id}>
              <Link href={`/messages/${c.id}`} className="flex items-center gap-4 p-4 hover:bg-slate-50">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                  <SmartImage src={c.image ?? undefined} alt="" category={c.category} className="h-full w-full" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-semibold">{c.buyerId === user.id ? c.sellerName : c.buyerName}</span>
                    <span className="shrink-0 text-xs text-slate-400">{timeAgo(c.lastMessageAt, locale)}</span>
                  </div>
                  <div className="truncate text-sm text-slate-500">
                    {locale === "ru" ? c.titleRu : c.titleEn} · {formatPrice(c.price, locale)}
                  </div>
                  <div className={`truncate text-sm ${c.unread > 0 ? "font-semibold text-slate-900" : "text-slate-500"}`}>{c.lastMessage ?? "…"}</div>
                </div>
                {c.unread > 0 && (
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white">{c.unread}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
