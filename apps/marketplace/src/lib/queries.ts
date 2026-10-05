import "server-only";
import { and, desc, eq, gte, inArray, lte, ne, type SQL, sql } from "drizzle-orm";
import { db } from "@/db";
import { favorites, listings, reviews, users } from "@/db/schema";
import type { SearchFilters } from "./heuristics";

export const PAGE_SIZE = 24;

export const cardColumns = {
  id: listings.id,
  titleRu: listings.titleRu,
  titleEn: listings.titleEn,
  price: listings.price,
  city: listings.city,
  images: listings.images,
  condition: listings.condition,
  delivery: listings.delivery,
  category: listings.category,
  createdAt: listings.createdAt,
  promotedUntil: listings.promotedUntil,
  aiGenerated: listings.aiGenerated,
  status: listings.status,
};

export type ListingCard = {
  id: string;
  titleRu: string;
  titleEn: string;
  price: number;
  city: string;
  images: string[];
  condition: string;
  delivery: boolean;
  category: string;
  createdAt: Date;
  promotedUntil: Date | null;
  aiGenerated: boolean;
  status: string;
};

// Russian spellings of brands people type, mapped to how listings spell them.
const SYNONYMS: Record<string, string> = {
  айфон: "iphone",
  айпад: "ipad",
  макбук: "macbook",
  аирподс: "airpods",
  эйрподс: "airpods",
  самсунг: "samsung",
  сяоми: "xiaomi",
  ксиоми: "xiaomi",
  сони: "sony",
  плейстейшн: "playstation",
  пс5: "playstation",
  ps5: "playstation",
  нинтендо: "nintendo",
  тойота: "toyota",
  бмв: "bmw",
  киа: "kia",
  лего: "lego",
  найк: "nike",
  кэнон: "canon",
  канон: "canon",
};

/** Turns free text into an OR-prefix tsquery string with only safe characters. */
function toTsQuery(keywords: string, joiner: "|" | "&" = "|"): string | null {
  const words = keywords
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2)
    .map((w) => SYNONYMS[w] ?? w)
    .slice(0, 8);
  if (!words.length) return null;
  return words.map((w) => `${w}:*`).join(` ${joiner} `);
}

const isPromoted = sql<boolean>`coalesce(${listings.promotedUntil} > now(), false)`;

export async function searchListings(f: Partial<SearchFilters>, page = 1) {
  const conds: SQL[] = [eq(listings.status, "active")];
  const tsq = f.keywords ? toTsQuery(f.keywords) : null;
  const query = tsq
    ? sql`(to_tsquery('russian', ${tsq}) || to_tsquery('english', ${tsq}))`
    : null;
  if (query) conds.push(sql`${listings.searchVector} @@ ${query}`);
  if (f.category) conds.push(eq(listings.category, f.category));
  if (f.city) conds.push(eq(listings.city, f.city));
  if (f.priceMin != null) conds.push(gte(listings.price, f.priceMin));
  if (f.priceMax != null) conds.push(lte(listings.price, f.priceMax));
  if (f.condition) {
    // "like new" searches should also surface brand-new items
    conds.push(
      f.condition === "like_new" ? inArray(listings.condition, ["new", "like_new"]) : eq(listings.condition, f.condition),
    );
  }
  if (f.delivery) conds.push(eq(listings.delivery, true));

  const where = and(...conds);
  const rank = query ? sql`ts_rank(${listings.searchVector}, ${query})` : sql`0`;
  const order =
    f.sort === "cheap"
      ? [listings.price]
      : f.sort === "expensive"
        ? [desc(listings.price)]
        : f.sort === "newest" || !query
          ? [desc(isPromoted), desc(listings.createdAt)]
          : [desc(isPromoted), desc(rank), desc(listings.createdAt)];

  const [items, [{ count }]] = await Promise.all([
    db
      .select(cardColumns)
      .from(listings)
      .where(where)
      .orderBy(...order)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ count: sql<number>`count(*)::int` }).from(listings).where(where),
  ]);
  return { items: items as ListingCard[], total: count };
}

export async function getFreshListings(limit = 12) {
  return (await db
    .select(cardColumns)
    .from(listings)
    .where(eq(listings.status, "active"))
    .orderBy(desc(listings.createdAt))
    .limit(limit)) as ListingCard[];
}

export async function getPromotedListings(limit = 8) {
  return (await db
    .select(cardColumns)
    .from(listings)
    .where(and(eq(listings.status, "active"), sql`${listings.promotedUntil} > now()`))
    .orderBy(sql`random()`)
    .limit(limit)) as ListingCard[];
}

export async function getListing(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .select({ listing: listings, seller: users })
    .from(listings)
    .innerJoin(users, eq(users.id, listings.sellerId))
    .where(eq(listings.id, id))
    .limit(1);
  if (!row) return null;
  const { passwordHash: _, email: __, ...seller } = row.seller;
  return { listing: row.listing, seller };
}

export async function getSimilarListings(id: string, category: string, price: number, limit = 8) {
  return (await db
    .select(cardColumns)
    .from(listings)
    .where(and(eq(listings.status, "active"), eq(listings.category, category), ne(listings.id, id)))
    .orderBy(sql`abs(${listings.price} - ${price})`)
    .limit(limit)) as ListingCard[];
}

export async function getSellerStats(userId: string) {
  const [[r], [l]] = await Promise.all([
    db
      .select({ avg: sql<number | null>`avg(${reviews.rating})::float`, count: sql<number>`count(*)::int` })
      .from(reviews)
      .where(eq(reviews.targetId, userId)),
    db
      .select({
        active: sql<number>`count(*) filter (where ${listings.status} = 'active')::int`,
        sold: sql<number>`count(*) filter (where ${listings.status} = 'sold')::int`,
      })
      .from(listings)
      .where(eq(listings.sellerId, userId)),
  ]);
  return { rating: r.avg, reviewCount: r.count, active: l.active, sold: l.sold };
}

export async function getFavoriteIds(userId: string | undefined): Promise<Set<string>> {
  if (!userId) return new Set();
  const rows = await db.select({ id: favorites.listingId }).from(favorites).where(eq(favorites.userId, userId));
  return new Set(rows.map((r) => r.id));
}

/**
 * Market price stats from comparable active listings: same category and
 * sharing the leading title words (brand/model). Uses the 25th/50th/75th
 * percentiles and narrows from 3 words down to 2 until enough comparables exist.
 */
export async function getMarketPrice(opts: { category: string; title: string; excludeId?: string }) {
  const words = opts.title.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2);
  for (const n of [3, 2]) {
    if (words.length < n && n !== 2) continue;
    const tsq = toTsQuery(words.slice(0, n).join(" "), "&");
    if (!tsq) return null;
    const conds: SQL[] = [
      eq(listings.category, opts.category),
      sql`${listings.price} > 0`,
      sql`${listings.status} in ('active', 'sold')`,
      sql`${listings.searchVector} @@ (to_tsquery('russian', ${tsq}) || to_tsquery('english', ${tsq}))`,
    ];
    if (opts.excludeId) conds.push(ne(listings.id, opts.excludeId));
    const [row] = await db
      .select({
        count: sql<number>`count(*)::int`,
        p25: sql<number | null>`percentile_cont(0.25) within group (order by ${listings.price})`,
        p50: sql<number | null>`percentile_cont(0.5) within group (order by ${listings.price})`,
        p75: sql<number | null>`percentile_cont(0.75) within group (order by ${listings.price})`,
      })
      .from(listings)
      .where(and(...conds));
    if (row && row.count >= 3 && row.p50 != null) {
      return {
        count: row.count,
        low: Math.round(row.p25 ?? row.p50),
        median: Math.round(row.p50),
        high: Math.round(row.p75 ?? row.p50),
      };
    }
  }
  return null;
}
