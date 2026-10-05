import { SearchX, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { ListingCard, ListingGrid } from "@/components/listing-card";
import { db } from "@/db";
import { events } from "@/db/schema";
import { parseSearchQuery } from "@/lib/ai";
import { getCurrentUser } from "@/lib/auth";
import { CATEGORIES, CITIES, CONDITIONS, categoryName, cityName } from "@/lib/categories";
import { formatPrice } from "@/lib/format";
import { getI18n } from "@/lib/i18n";
import type { SearchFilters } from "@/lib/heuristics";
import { getFavoriteIds, PAGE_SIZE, searchListings } from "@/lib/queries";

type SP = Record<string, string | undefined>;

const num = (v?: string) => (v && /^\d+$/.test(v) ? Number(v) : undefined);

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  return { title: sp.q || "Search" };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { t, locale } = await getI18n();
  const user = await getCurrentUser();
  const q = (sp.q ?? "").slice(0, 200);
  const page = Math.max(1, num(sp.page) ?? 1);

  // AI turns the free-text query into filters; explicit URL params win ("any" clears one).
  const ai = q ? await parseSearchQuery(q) : null;
  if (ai && page === 1) {
    await db.insert(events).values({ type: ai.ai ? "ai_search" : "search", userId: user?.id, payload: { q } });
  }
  const pickParam = <K extends keyof SearchFilters>(key: K, explicit: SearchFilters[K] | undefined) =>
    sp[key] === "any" ? null : (explicit ?? ai?.[key] ?? null);

  const filters: SearchFilters = {
    keywords: ai ? ai.keywords : "",
    category: pickParam("category", sp.category && sp.category !== "any" ? sp.category : undefined),
    city: pickParam("city", sp.city && sp.city !== "any" ? sp.city : undefined),
    priceMin: pickParam("priceMin", num(sp.priceMin)),
    priceMax: pickParam("priceMax", num(sp.priceMax)),
    condition: pickParam(
      "condition",
      CONDITIONS.includes(sp.condition as (typeof CONDITIONS)[number]) ? (sp.condition as SearchFilters["condition"]) : undefined,
    ),
    delivery: sp.delivery === "1" ? true : pickParam("delivery", undefined),
    sort: (["relevance", "newest", "cheap", "expensive"].includes(sp.sort ?? "") ? sp.sort : ai?.sort) as SearchFilters["sort"],
  };

  const [{ items, total }, favs] = await Promise.all([searchListings(filters, page), getFavoriteIds(user?.id)]);
  const pages = Math.ceil(total / PAGE_SIZE);

  const href = (patch: SP) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, page: undefined, ...patch })) if (v) next.set(k, v);
    return `/search?${next.toString()}`;
  };

  const chips: { label: string; clear: SP }[] = [];
  if (ai) {
    if (filters.keywords) chips.push({ label: `«${filters.keywords}»`, clear: {} });
    if (filters.category) chips.push({ label: categoryName(filters.category, locale), clear: { category: "any" } });
    if (filters.city) chips.push({ label: cityName(filters.city, locale), clear: { city: "any" } });
    if (filters.priceMin != null) chips.push({ label: `≥ ${formatPrice(filters.priceMin, locale)}`, clear: { priceMin: "any" } });
    if (filters.priceMax != null) chips.push({ label: `≤ ${formatPrice(filters.priceMax, locale)}`, clear: { priceMax: "any" } });
    if (filters.condition) chips.push({ label: t.listing.condition[filters.condition], clear: { condition: "any" } });
    if (filters.delivery) chips.push({ label: t.search.withDelivery, clear: { delivery: "any" } });
  }

  return (
    <div className="pt-6">
      {ai && chips.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl bg-gradient-to-r from-brand-50 to-fuchsia-50 px-4 py-3 ring-1 ring-brand-100">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-fuchsia-700">
            <Sparkles className="h-4 w-4" /> {t.search.aiUnderstood}:
          </span>
          {chips.map((c) => (
            <span key={c.label} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm ring-1 ring-slate-200">
              {c.label}
              {Object.keys(c.clear).length > 0 && (
                <Link href={href(c.clear)} className="text-slate-400 hover:text-rose-500" aria-label="remove">
                  <X className="h-3.5 w-3.5" />
                </Link>
              )}
            </span>
          ))}
          {!ai.ai && <span className="text-xs text-slate-400">(offline parser)</span>}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside>
          <form action="/search" className="card sticky top-20 space-y-4 p-5">
            <div className="font-bold">{t.search.filters}</div>
            {q && <input type="hidden" name="q" value={q} />}
            <div>
              <label className="label" htmlFor="category">{t.post.fieldCategory}</label>
              <select id="category" name="category" defaultValue={filters.category ?? "any"} className="input">
                <option value="any">{t.search.allCategories}</option>
                {CATEGORIES.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.emoji} {c[locale]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="city">{t.post.fieldCity}</label>
              <select id="city" name="city" defaultValue={filters.city ?? "any"} className="input">
                <option value="any">{t.search.allCities}</option>
                {CITIES.map((c) => (
                  <option key={c.ru} value={c.ru}>{c[locale]}</option>
                ))}
              </select>
            </div>
            <div>
              <span className="label">{t.search.priceFrom}</span>
              <div className="flex items-center gap-2">
                <input name="priceMin" inputMode="numeric" placeholder="0" defaultValue={filters.priceMin ?? ""} className="input" />
                <span className="text-slate-400">—</span>
                <input name="priceMax" inputMode="numeric" placeholder="∞" defaultValue={filters.priceMax ?? ""} className="input" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="condition">{t.search.condition}</label>
              <select id="condition" name="condition" defaultValue={filters.condition ?? "any"} className="input">
                <option value="any">{t.search.any}</option>
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>{t.listing.condition[c]}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="delivery" value="1" defaultChecked={!!filters.delivery} className="h-4 w-4 accent-brand-600" />
              {t.search.withDelivery}
            </label>
            <div>
              <label className="label" htmlFor="sort">{t.search.sort}</label>
              <select id="sort" name="sort" defaultValue={filters.sort ?? "relevance"} className="input">
                <option value="relevance">{t.search.sortRelevance}</option>
                <option value="newest">{t.search.sortNewest}</option>
                <option value="cheap">{t.search.sortCheap}</option>
                <option value="expensive">{t.search.sortExpensive}</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1">{t.search.apply}</button>
              <Link href="/search" className="btn-ghost">{t.search.reset}</Link>
            </div>
          </form>
        </aside>

        <section>
          <div className="mb-5 flex items-baseline justify-between">
            <h1 className="text-2xl font-bold">
              {q ? `«${q}»` : filters.category ? categoryName(filters.category, locale) : t.home.ctaBrowse}
            </h1>
            <span className="text-sm text-slate-500">
              {t.search.results}: <b className="text-slate-800">{total}</b>
            </span>
          </div>
          {items.length === 0 ? (
            <div className="card flex flex-col items-center px-6 py-16 text-center">
              <SearchX className="h-12 w-12 text-slate-300" />
              <div className="mt-4 text-lg font-semibold">{t.search.noResults}</div>
              <div className="mt-1 text-sm text-slate-500">{t.search.noResultsHint}</div>
            </div>
          ) : (
            <ListingGrid>
              {items.map((l) => (
                <ListingCard key={l.id} l={l} locale={locale} t={t} favorite={favs.has(l.id)} />
              ))}
            </ListingGrid>
          )}
          {pages > 1 && (
            <nav className="mt-10 flex flex-wrap justify-center gap-2">
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={href({ page: String(p) })}
                  className={`flex h-10 min-w-10 items-center justify-center rounded-xl px-3 text-sm font-semibold ${
                    p === page ? "bg-brand-600 text-white" : "bg-white ring-1 ring-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {p}
                </Link>
              ))}
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
