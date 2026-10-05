import { eq, sql } from "drizzle-orm";
import { AlertTriangle, BadgeCheck, Eye, Languages, MapPin, MessageCircle, ShieldCheck, Sparkles, Truck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { promoteListing, setListingStatus, startConversation } from "@/app/actions";
import { FavoriteButton } from "@/components/favorite-button";
import { Gallery } from "@/components/gallery";
import { ListingCard, ListingGrid } from "@/components/listing-card";
import { PhoneReveal } from "@/components/phone-reveal";
import { Stars } from "@/components/stars";
import { db } from "@/db";
import { events, listings } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { categoryName, cityName } from "@/lib/categories";
import { formatPrice, formatUsd, timeAgo } from "@/lib/format";
import { RISK_LABELS } from "@/lib/heuristics";
import { getI18n } from "@/lib/i18n";
import { getFavoriteIds, getListing, getMarketPrice, getSellerStats, getSimilarListings } from "@/lib/queries";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ original?: string }> };

export async function generateMetadata({ params }: Props) {
  const data = await getListing((await params).id);
  const { locale } = await getI18n();
  if (!data) return {};
  const title = locale === "ru" ? data.listing.titleRu : data.listing.titleEn;
  return { title, openGraph: { title, images: data.listing.images.slice(0, 1) } };
}

export default async function ListingPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { original } = await searchParams;
  const data = await getListing(id);
  if (!data) notFound();
  const { listing: l, seller } = data;
  const { t, locale } = await getI18n();
  const user = await getCurrentUser();
  const isOwner = user?.id === l.sellerId;
  if (l.status === "blocked" && !isOwner && !user?.isAdmin) notFound();

  if (!isOwner) {
    await Promise.all([
      db.update(listings).set({ views: sql`${listings.views} + 1` }).where(eq(listings.id, id)),
      db.insert(events).values({ type: "view", userId: user?.id, listingId: id }),
    ]);
  }

  const showOriginal = original === "1" && l.originalLang !== locale;
  const lang = showOriginal ? l.originalLang : locale;
  const title = lang === "ru" ? l.titleRu : l.titleEn;
  const description = lang === "ru" ? l.descriptionRu : l.descriptionEn;
  const translated = l.originalLang !== locale;

  const [stats, market, similar, favs] = await Promise.all([
    getSellerStats(seller.id),
    getMarketPrice({ category: l.category, title: l.titleEn, excludeId: l.id }),
    getSimilarListings(l.id, l.category, l.price),
    getFavoriteIds(user?.id),
  ]);

  let verdict: { label: string; tone: string } | null = null;
  if (market && l.price > 0) {
    if (l.price < market.low * 0.95) verdict = { label: t.listing.priceLow, tone: "text-sky-700 bg-sky-50 ring-sky-200" };
    else if (l.price > market.high * 1.05) verdict = { label: t.listing.priceHigh, tone: "text-amber-700 bg-amber-50 ring-amber-200" };
    else verdict = { label: t.listing.priceFair, tone: "text-emerald-700 bg-emerald-50 ring-emerald-200" };
  }
  const promoted = l.promotedUntil && l.promotedUntil > new Date();
  const statusLabel = l.status === "sold" ? t.listing.sold : l.status === "archived" ? t.listing.archived : l.status === "blocked" ? t.listing.blocked : null;
  const attrs = Object.entries(l.attributes);

  return (
    <div className="pt-6">
      <nav className="mb-4 text-sm text-slate-500">
        <Link href="/" className="hover:text-slate-800">{t.brand}</Link>
        {" / "}
        <Link href={`/search?category=${l.category}`} className="hover:text-slate-800">{categoryName(l.category, locale)}</Link>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-8">
          <Gallery images={l.images} alt={title} category={l.category} />

          <div className="lg:hidden">
            <h1 className="text-2xl font-bold">{title}</h1>
            <div className="mt-2 text-3xl font-extrabold">{formatPrice(l.price, locale)}</div>
          </div>

          {attrs.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl font-bold">{t.listing.characteristics}</h2>
              <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                <div className="flex justify-between gap-4 border-b border-dashed border-slate-200 py-1.5 text-sm">
                  <dt className="text-slate-500">{t.search.condition}</dt>
                  <dd className="font-medium">{t.listing.condition[l.condition]}</dd>
                </div>
                {attrs.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-b border-dashed border-slate-200 py-1.5 text-sm">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold">{t.listing.description}</h2>
              {translated && (
                <Link
                  href={showOriginal ? `/listing/${l.id}` : `/listing/${l.id}?original=1`}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
                >
                  <Languages className="h-3.5 w-3.5" />
                  {showOriginal ? t.listing.translated : `${t.listing.translated} · ${t.listing.showOriginal}`}
                </Link>
              )}
            </div>
            <p className="whitespace-pre-line leading-relaxed text-slate-700">{description}</p>
          </section>

          <div className="flex flex-wrap gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-1.5"><Eye className="h-4 w-4" /> {l.views} {t.listing.views}</span>
            <span>{t.listing.published} {timeAgo(l.createdAt, locale)}</span>
            {l.aiGenerated && (
              <span className="flex items-center gap-1.5 text-fuchsia-700"><Sparkles className="h-4 w-4" /> {t.listing.aiBadge}</span>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="card p-5">
            {statusLabel && (
              <div className="mb-3 rounded-xl bg-slate-900 px-3 py-2 text-center text-sm font-bold uppercase text-white">{statusLabel}</div>
            )}
            <div className="flex flex-wrap gap-2">
              {promoted && <span className="rounded-md bg-amber-400 px-1.5 py-0.5 text-[11px] font-bold uppercase text-amber-950">{t.listing.promoted}</span>}
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">{t.listing.condition[l.condition]}</span>
            </div>
            <h1 className="mt-3 hidden text-2xl font-bold leading-snug lg:block">{title}</h1>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold">{formatPrice(l.price, locale)}</span>
              {locale === "en" && l.price > 0 && <span className="text-sm text-slate-400">≈ {formatUsd(l.price)}</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              {l.negotiable && <span>✓ {t.listing.negotiable}</span>}
              {l.delivery && <span className="flex items-center gap-1 text-emerald-700"><Truck className="h-4 w-4" /> {t.listing.delivery}</span>}
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {cityName(l.city, locale)}</span>
            </div>

            <div className="mt-5 space-y-2.5">
              {isOwner ? (
                <>
                  <div className="rounded-xl bg-brand-50 px-3 py-2 text-center text-sm font-medium text-brand-700">{t.listing.yourListing}</div>
                  <Link href={`/listing/${l.id}/edit`} className="btn-primary w-full">{t.listing.edit}</Link>
                  {l.status === "active" && !promoted && (
                    <form action={promoteListing.bind(null, l.id)}>
                      <button type="submit" className="btn w-full bg-amber-400 text-amber-950 hover:bg-amber-300">⚡ {t.listing.promote}</button>
                    </form>
                  )}
                  {l.status !== "blocked" && (
                    <div className="grid grid-cols-2 gap-2">
                      {l.status === "active" ? (
                        <>
                          <form action={setListingStatus.bind(null, l.id, "sold")}>
                            <button type="submit" className="btn-ghost w-full">{t.listing.markSold}</button>
                          </form>
                          <form action={setListingStatus.bind(null, l.id, "archived")}>
                            <button type="submit" className="btn-ghost w-full">{t.listing.archive}</button>
                          </form>
                        </>
                      ) : (
                        <form action={setListingStatus.bind(null, l.id, "active")} className="col-span-2">
                          <button type="submit" className="btn-ghost w-full">{t.listing.activate}</button>
                        </form>
                      )}
                    </div>
                  )}
                </>
              ) : l.status === "active" ? (
                <>
                  <form action={startConversation.bind(null, l.id)}>
                    <button type="submit" className="btn-primary w-full py-3 text-base">
                      <MessageCircle className="h-5 w-5" /> {t.listing.write}
                    </button>
                  </form>
                  {seller.phone && user && <PhoneReveal phone={seller.phone} />}
                  <FavoriteButton listingId={l.id} initial={favs.has(l.id)} variant="button" />
                  {!user && <p className="text-center text-xs text-slate-500">{t.listing.loginToContact}</p>}
                </>
              ) : null}
            </div>
          </div>

          {(market || l.riskFlags.length > 0) && (
            <div className="card space-y-4 p-5">
              {market && (
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-fuchsia-600" /> {t.listing.priceCheck}</span>
                    {verdict && <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${verdict.tone}`}>{verdict.label}</span>}
                  </div>
                  <PriceScale low={market.low} high={market.high} price={l.price} />
                  <div className="mt-2 flex justify-between text-xs text-slate-500">
                    <span>{formatPrice(market.low, locale)}</span>
                    <span>{t.listing.marketRange}: {formatPrice(market.median, locale)}</span>
                    <span>{formatPrice(market.high, locale)}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">{market.count} {t.listing.basedOn}</div>
                </div>
              )}
              {l.riskFlags.length > 0 && (isOwner || user?.isAdmin || l.riskScore >= 30) && (
                <div className="rounded-xl bg-amber-50 p-3 text-sm ring-1 ring-amber-200">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-800"><AlertTriangle className="h-4 w-4" /> {t.listing.riskWarning} ({l.riskScore}/100)</div>
                  <ul className="mt-1.5 list-inside list-disc text-amber-900">
                    {l.riskFlags.map((f) => <li key={f.code}>{RISK_LABELS[f.code]?.[locale] ?? f.code}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          <Link href={`/user/${seller.id}`} className="card block p-5 transition hover:shadow-lg">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.listing.seller}</div>
            <div className="mt-3 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">{seller.name.slice(0, 1)}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-semibold">
                  {seller.name}
                  {seller.verified && <BadgeCheck className="h-4 w-4 text-sky-500" aria-label={t.listing.verified} />}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-slate-500">
                  {stats.rating ? (
                    <>
                      <b className="text-slate-800">{stats.rating.toFixed(1)}</b> <Stars value={stats.rating} size="h-3.5 w-3.5" /> · {stats.reviewCount} {t.listing.reviews}
                    </>
                  ) : (
                    t.listing.noReviews
                  )}
                </div>
                <div className="text-xs text-slate-400">
                  {t.listing.onSiteSince} {new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(seller.createdAt)}
                </div>
              </div>
            </div>
          </Link>

          <div className="flex gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-200">
            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <div className="font-semibold">{t.listing.safety}</div>
              <div className="mt-0.5 text-emerald-800">{t.listing.safetyTip}</div>
            </div>
          </div>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-5 text-2xl font-bold">{t.listing.similar}</h2>
          <ListingGrid>
            {similar.slice(0, 5).map((s) => (
              <ListingCard key={s.id} l={s} locale={locale} t={t} favorite={favs.has(s.id)} />
            ))}
          </ListingGrid>
        </section>
      )}
    </div>
  );
}

function PriceScale({ low, high, price }: { low: number; high: number; price: number }) {
  // Scale spans 30% beyond the interquartile range on each side
  const span = Math.max(high - low, 1);
  const min = low - span * 0.6;
  const max = high + span * 0.6;
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100))}%`;
  return (
    <div className="relative mt-4 h-2 rounded-full bg-gradient-to-r from-sky-200 via-emerald-300 to-amber-300">
      <div className="absolute top-0 h-2 rounded-full bg-emerald-500/40" style={{ left: pos(low), width: `calc(${pos(high)} - ${pos(low)})` }} />
      <div className="absolute -top-1.5 h-5 w-5 -translate-x-1/2 rounded-full border-[3px] border-white bg-slate-900 shadow" style={{ left: pos(price) }} />
    </div>
  );
}
