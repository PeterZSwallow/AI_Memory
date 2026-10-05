import { and, desc, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import Link from "next/link";
import { ListingCard, ListingGrid } from "@/components/listing-card";
import { db } from "@/db";
import { favorites, listings } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n";
import { cardColumns, type ListingCard as Card } from "@/lib/queries";

const TABS = ["active", "sold", "archived", "blocked", "favorites"] as const;
type Tab = (typeof TABS)[number];

export default async function MePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser("/me");
  const { t, locale } = await getI18n();
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "active";

  const items = (
    tab === "favorites"
      ? await db
          .select(cardColumns)
          .from(favorites)
          .innerJoin(listings, eq(listings.id, favorites.listingId))
          .where(eq(favorites.userId, user.id))
          .orderBy(desc(favorites.createdAt))
      : await db
          .select(cardColumns)
          .from(listings)
          .where(and(eq(listings.sellerId, user.id), eq(listings.status, tab)))
          .orderBy(desc(listings.createdAt))
  ) as Card[];

  const labels: Record<Tab, string> = {
    active: t.profile.active,
    sold: t.profile.sold,
    archived: t.profile.archived,
    blocked: t.listing.blocked,
    favorites: t.nav.favorites,
  };

  return (
    <div className="pt-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight">{tab === "favorites" ? t.nav.favorites : t.nav.myListings}</h1>
        <Link href="/listing/new" className="btn-ai"><Plus className="h-4 w-4" /> {t.nav.post}</Link>
      </div>
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 ring-1 ring-slate-200">
        {TABS.map((k) => (
          <Link
            key={k}
            href={`/me?tab=${k}`}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${k === tab ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            {labels[k]}
          </Link>
        ))}
      </div>
      {items.length === 0 ? (
        <div className="card px-6 py-16 text-center text-slate-500">
          {tab === "favorites" ? t.profile.favoritesEmpty : t.profile.myEmpty}
        </div>
      ) : (
        <ListingGrid>
          {items.map((l) => (
            <ListingCard key={l.id} l={l} locale={locale} t={t} favorite={tab === "favorites"} />
          ))}
        </ListingGrid>
      )}
    </div>
  );
}
