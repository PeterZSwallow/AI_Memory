import Link from "next/link";
import { notFound } from "next/navigation";
import { Chat } from "@/components/chat";
import { SmartImage } from "@/components/smart-image";
import { requireUser } from "@/lib/auth";
import { getConversation } from "@/lib/chat";
import { formatPrice } from "@/lib/format";
import { getI18n } from "@/lib/i18n";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/messages/${id}`);
  const conv = await getConversation(id, user.id);
  if (!conv) notFound();
  const { t, locale } = await getI18n();
  const otherName = conv.buyerId === user.id ? conv.sellerName : conv.buyerName;
  const otherId = conv.buyerId === user.id ? conv.sellerId : conv.buyerId;
  return (
    <div className="mx-auto max-w-3xl pt-6">
      <Link href="/messages" className="text-sm text-slate-500 hover:text-slate-800">← {t.messages.title}</Link>
      <div className="card mt-3 flex h-[calc(100vh-11rem)] min-h-[480px] flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-100 p-4">
          <Link href={`/listing/${conv.listing.id}`} className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100">
            <SmartImage src={conv.listing.images[0]} alt="" category={conv.listing.category} className="h-full w-full" />
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={`/user/${otherId}`} className="font-semibold hover:text-brand-700">{otherName}</Link>
            <Link href={`/listing/${conv.listing.id}`} className="block truncate text-sm text-slate-500 hover:text-slate-800">
              {locale === "ru" ? conv.listing.titleRu : conv.listing.titleEn} · <b>{formatPrice(conv.listing.price, locale)}</b>
            </Link>
          </div>
        </div>
        <Chat
          conversationId={conv.id}
          userId={user.id}
          initial={conv.messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString(), readAt: m.readAt?.toISOString() ?? null }))}
        />
      </div>
    </div>
  );
}
