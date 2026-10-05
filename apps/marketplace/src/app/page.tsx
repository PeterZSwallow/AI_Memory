import { eq, sql } from "drizzle-orm";
import { ArrowRight, Camera, Globe2, Scale, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import Link from "next/link";
import { ListingCard, ListingGrid } from "@/components/listing-card";
import { SearchBar } from "@/components/search-bar";
import { db } from "@/db";
import { listings } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { CATEGORIES } from "@/lib/categories";
import { compactNumber } from "@/lib/format";
import { getI18n } from "@/lib/i18n";
import { getFavoriteIds, getFreshListings, getPromotedListings } from "@/lib/queries";

async function getStats() {
  const [row] = await db
    .select({
      active: sql<number>`count(*) filter (where ${listings.status} = 'active')::int`,
      sellers: sql<number>`count(distinct ${listings.sellerId})::int`,
      cities: sql<number>`count(distinct ${listings.city})::int`,
      ai: sql<number>`round(100.0 * count(*) filter (where ${listings.aiGenerated}) / greatest(count(*), 1))::int`,
    })
    .from(listings);
  return row;
}

async function getCategoryCounts() {
  const rows = await db
    .select({ category: listings.category, n: sql<number>`count(*)::int` })
    .from(listings)
    .where(eq(listings.status, "active"))
    .groupBy(listings.category);
  return Object.fromEntries(rows.map((r) => [r.category, r.n]));
}

const EXAMPLES = {
  ru: ["айфон до 50 тысяч в Москве", "детская коляска до 15к в Казани", "диван с доставкой", "ps5 как новая"],
  en: ["iPhone under 50k in Moscow", "MacBook Air M2 like new", "sofa with delivery", "road bike in Saint Petersburg"],
};

export default async function HomePage() {
  const { t, locale } = await getI18n();
  const user = await getCurrentUser();
  const [stats, counts, fresh, promoted, favs] = await Promise.all([
    getStats(),
    getCategoryCounts(),
    getFreshListings(15),
    getPromotedListings(5),
    getFavoriteIds(user?.id),
  ]);

  const features = [
    { icon: Camera, title: t.home.f1t, desc: t.home.f1d },
    { icon: Wand2, title: t.home.f2t, desc: t.home.f2d },
    { icon: Scale, title: t.home.f3t, desc: t.home.f3d },
    { icon: ShieldCheck, title: t.home.f4t, desc: t.home.f4d },
    { icon: Globe2, title: t.home.f5t, desc: t.home.f5d },
  ];

  return (
    <div className="space-y-14 pt-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-50 via-white to-orange-50 px-6 py-12 ring-1 ring-brand-100 sm:px-12 sm:py-16">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-fuchsia-300/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-brand-300/30 blur-3xl" />
        <div className="relative max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-fuchsia-700 ring-1 ring-fuchsia-200">
            <Sparkles className="h-3.5 w-3.5" /> {t.tagline}
          </span>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            <span className="ai-text">{t.home.heroTitle}</span>
          </h1>
          <p className="mt-4 text-lg text-slate-600">{t.home.heroSubtitle}</p>
          <div className="mt-7">
            <SearchBar examples={EXAMPLES[locale]} />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/listing/new" className="btn-ai px-5 py-3 text-base">
              <Camera className="h-5 w-5" /> {t.home.ctaPost}
            </Link>
            <Link href="/search" className="btn-outline px-5 py-3 text-base">
              {t.home.ctaBrowse} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <dl className="relative mt-10 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            [compactNumber(stats.active, locale), t.home.statListings],
            [compactNumber(stats.sellers, locale), t.home.statSellers],
            [stats.cities, t.home.statCities],
            [`${stats.ai}%`, t.home.statAi],
          ].map(([v, label]) => (
            <div key={String(label)} className="rounded-2xl bg-white/70 px-4 py-3 ring-1 ring-slate-200/70 backdrop-blur">
              <dt className="text-2xl font-extrabold">{v}</dt>
              <dd className="text-xs text-slate-500">{label}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Categories */}
      <section>
        <h2 className="mb-5 text-2xl font-bold">{t.home.categories}</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/search?category=${c.slug}`}
              className="card group flex flex-col items-start gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-2xl ${c.color}`}>
                {c.emoji}
              </span>
              <div>
                <div className="text-sm font-semibold leading-tight group-hover:text-brand-700">{c[locale]}</div>
                <div className="text-xs text-slate-400">{counts[c.slug] ?? 0}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {promoted.length > 0 && (
        <section>
          <div className="mb-5 flex items-end justify-between">
            <h2 className="text-2xl font-bold">{t.home.promoted}</h2>
          </div>
          <ListingGrid>
            {promoted.map((l) => (
              <ListingCard key={l.id} l={l} locale={locale} t={t} favorite={favs.has(l.id)} />
            ))}
          </ListingGrid>
        </section>
      )}

      {/* AI features */}
      <section className="rounded-3xl bg-slate-900 px-6 py-12 text-white sm:px-12">
        <h2 className="text-3xl font-extrabold tracking-tight">{t.home.featuresTitle}</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
              <span className="ai-gradient flex h-10 w-10 items-center justify-center rounded-xl">
                <Icon className="h-5 w-5" />
              </span>
              <div className="mt-4 font-semibold">{title}</div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-5 flex items-end justify-between">
          <h2 className="text-2xl font-bold">{t.home.fresh}</h2>
          <Link href="/search?sort=newest" className="text-sm font-semibold text-brand-700 hover:underline">
            {t.home.seeAll} →
          </Link>
        </div>
        <ListingGrid>
          {fresh.map((l) => (
            <ListingCard key={l.id} l={l} locale={locale} t={t} favorite={favs.has(l.id)} />
          ))}
        </ListingGrid>
      </section>
    </div>
  );
}
