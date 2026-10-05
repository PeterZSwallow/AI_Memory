import { and, desc, eq } from "drizzle-orm";
import { BadgeCheck, MapPin } from "lucide-react";
import { notFound } from "next/navigation";
import { leaveReview } from "@/app/actions";
import { ListingCard, ListingGrid } from "@/components/listing-card";
import { Stars } from "@/components/stars";
import { db } from "@/db";
import { conversations, listings, reviews, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { cityName } from "@/lib/categories";
import { timeAgo } from "@/lib/format";
import { getI18n } from "@/lib/i18n";
import { cardColumns, getFavoriteIds, getSellerStats, type ListingCard as Card } from "@/lib/queries";

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [profile] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!profile) notFound();
  const { t, locale } = await getI18n();
  const me = await getCurrentUser();

  const [stats, items, revs, favs, canReview] = await Promise.all([
    getSellerStats(id),
    db
      .select(cardColumns)
      .from(listings)
      .where(and(eq(listings.sellerId, id), eq(listings.status, "active")))
      .orderBy(desc(listings.createdAt))
      .limit(40) as Promise<Card[]>,
    db
      .select({ id: reviews.id, rating: reviews.rating, text: reviews.text, createdAt: reviews.createdAt, author: users.name })
      .from(reviews)
      .innerJoin(users, eq(users.id, reviews.authorId))
      .where(eq(reviews.targetId, id))
      .orderBy(desc(reviews.createdAt))
      .limit(30),
    getFavoriteIds(me?.id),
    me && me.id !== id
      ? db
          .select({ id: conversations.id })
          .from(conversations)
          .where(and(eq(conversations.buyerId, me.id), eq(conversations.sellerId, id)))
          .limit(1)
          .then((r) => r.length > 0)
      : Promise.resolve(false),
  ]);

  return (
    <div className="pt-6">
      <div className="card flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-brand-100 text-3xl font-bold text-brand-700">
          {profile.name.slice(0, 1)}
        </span>
        <div className="flex-1">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold">
            {profile.name}
            {profile.verified && <BadgeCheck className="h-6 w-6 text-sky-500" aria-label={t.listing.verified} />}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
            {profile.city && (
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {cityName(profile.city, locale)}</span>
            )}
            <span>
              {t.listing.onSiteSince} {new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(profile.createdAt)}
            </span>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-6 text-center">
          <div>
            <dt className="text-2xl font-extrabold">{stats.rating ? stats.rating.toFixed(1) : "—"}</dt>
            <dd className="text-xs text-slate-500">{t.profile.rating}</dd>
          </div>
          <div>
            <dt className="text-2xl font-extrabold">{stats.active}</dt>
            <dd className="text-xs text-slate-500">{t.profile.active}</dd>
          </div>
          <div>
            <dt className="text-2xl font-extrabold">{stats.sold}</dt>
            <dd className="text-xs text-slate-500">{t.profile.sold}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
        <section>
          <h2 className="mb-5 text-2xl font-bold">{t.profile.listings}</h2>
          <ListingGrid>
            {items.map((l) => (
              <ListingCard key={l.id} l={l} locale={locale} t={t} favorite={favs.has(l.id)} />
            ))}
          </ListingGrid>
        </section>
        <section>
          <h2 className="mb-5 flex items-center gap-2 text-2xl font-bold">
            {t.profile.reviews} <span className="text-base font-medium text-slate-400">{stats.reviewCount}</span>
          </h2>
          {canReview && (
            <form action={leaveReview.bind(null, id)} className="card mb-4 space-y-3 p-4">
              <div className="font-semibold">{t.profile.leaveReview}</div>
              <select name="rating" defaultValue="5" className="input" aria-label={t.profile.yourRating}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>{"★".repeat(n)}{"☆".repeat(5 - n)}</option>
                ))}
              </select>
              <textarea name="text" rows={3} placeholder={t.profile.reviewText} className="input" maxLength={1000} />
              <button type="submit" className="btn-primary w-full">{t.profile.submitReview}</button>
            </form>
          )}
          <div className="space-y-3">
            {revs.length === 0 && <div className="text-sm text-slate-500">{t.listing.noReviews}</div>}
            {revs.map((r) => (
              <div key={r.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{r.author}</span>
                  <span className="text-xs text-slate-400">{timeAgo(r.createdAt, locale)}</span>
                </div>
                <Stars value={r.rating} size="h-3.5 w-3.5" />
                {r.text && <p className="mt-1.5 text-sm text-slate-700">{r.text}</p>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
