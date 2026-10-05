import { Sparkles, Truck } from "lucide-react";
import Link from "next/link";
import { cityName, type Locale } from "@/lib/categories";
import type { Dictionary } from "@/lib/dictionaries";
import { formatPrice, formatUsd, timeAgo } from "@/lib/format";
import type { ListingCard as Card } from "@/lib/queries";
import { FavoriteButton } from "./favorite-button";
import { SmartImage } from "./smart-image";

export function ListingCard({
  l,
  locale,
  t,
  favorite,
}: {
  l: Card;
  locale: Locale;
  t: Dictionary;
  favorite: boolean;
}) {
  const title = locale === "ru" ? l.titleRu : l.titleEn;
  const promoted = l.promotedUntil && l.promotedUntil > new Date();
  return (
    <Link href={`/listing/${l.id}`} className="group block">
      <div className={`relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100 ${promoted ? "ring-2 ring-amber-400" : ""}`}>
        <SmartImage
          src={l.images[0]}
          alt={title}
          category={l.category}
          className="h-full w-full transition duration-300 group-hover:scale-105"
        />
        <div className="absolute left-2.5 top-2.5 flex gap-1.5">
          {promoted && (
            <span className="rounded-md bg-amber-400 px-1.5 py-0.5 text-[11px] font-bold uppercase text-amber-950">
              {t.listing.promoted}
            </span>
          )}
          {l.aiGenerated && (
            <span className="flex items-center gap-1 rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-semibold text-fuchsia-700 backdrop-blur">
              <Sparkles className="h-3 w-3" /> AI
            </span>
          )}
        </div>
        <FavoriteButton listingId={l.id} initial={favorite} />
        {l.status !== "active" && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 text-sm font-bold uppercase text-white">
            {l.status === "sold" ? t.listing.sold : l.status === "blocked" ? t.listing.blocked : t.listing.archived}
          </div>
        )}
      </div>
      <div className="mt-2.5 px-0.5">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold">{formatPrice(l.price, locale)}</span>
          {locale === "en" && l.price > 0 && <span className="text-xs text-slate-400">≈ {formatUsd(l.price)}</span>}
        </div>
        <div className="mt-0.5 line-clamp-2 text-sm text-slate-800 group-hover:text-brand-700">{title}</div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
          <span className="truncate">{cityName(l.city, locale)}</span>
          <span>·</span>
          <span className="shrink-0">{timeAgo(l.createdAt, locale)}</span>
          {l.delivery && <Truck className="ml-auto h-3.5 w-3.5 text-emerald-600" aria-label={t.listing.delivery} />}
        </div>
      </div>
    </Link>
  );
}

export function ListingGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-7 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{children}</div>;
}
