import { and, eq, isNull, ne, or, sql } from "drizzle-orm";
import { Heart, MessageCircle, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "./language-switcher";
import { SearchBar } from "./search-bar";
import { UserMenu } from "./user-menu";

async function unreadCount(userId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(
      and(
        or(eq(conversations.buyerId, userId), eq(conversations.sellerId, userId)),
        ne(messages.senderId, userId),
        isNull(messages.readAt),
      ),
    );
  return row?.n ?? 0;
}

export async function Header() {
  const { t } = await getI18n();
  const user = await getCurrentUser();
  const unread = user ? await unreadCount(user.id) : 0;
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="ai-gradient flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-md">
            <Sparkles className="h-5 w-5" />
          </span>
          <span className="hidden text-xl font-extrabold tracking-tight sm:block">{t.brand}</span>
        </Link>
        <div className="min-w-0 flex-1">
          <SearchBar compact />
        </div>
        <nav className="flex shrink-0 items-center gap-1">
          <Link href="/me?tab=favorites" className="hidden rounded-xl p-2.5 text-slate-600 hover:bg-slate-100 md:block" title={t.nav.favorites}>
            <Heart className="h-5 w-5" />
          </Link>
          <Link href="/messages" className="relative hidden rounded-xl p-2.5 text-slate-600 hover:bg-slate-100 md:block" title={t.nav.messages}>
            <MessageCircle className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {unread}
              </span>
            )}
          </Link>
          <LanguageSwitcher />
          {user ? (
            <UserMenu name={user.name} unread={unread} />
          ) : (
            <Link href="/login" className="btn-ghost hidden sm:inline-flex">
              {t.nav.login}
            </Link>
          )}
          <Link href="/listing/new" className="btn-ai ml-1">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t.nav.post}</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
