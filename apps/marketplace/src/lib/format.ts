import type { Locale } from "./categories";

const USD_RATE = Number(process.env.USD_RUB_RATE ?? process.env.NEXT_PUBLIC_USD_RUB_RATE ?? 92);

export function formatPrice(rub: number, locale: Locale): string {
  if (rub === 0) return locale === "ru" ? "Бесплатно" : "Free";
  return `${new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US").format(rub)} ₽`;
}

export function formatUsd(rub: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(rub / USD_RATE);
}

export function timeAgo(date: Date, locale: Locale): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return rtf.format(seconds, "second");
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(seconds / 86400), "day");
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function compactNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function localized<T extends { titleRu: string; titleEn: string; descriptionRu: string; descriptionEn: string }>(
  l: T,
  locale: Locale,
) {
  return locale === "ru"
    ? { title: l.titleRu, description: l.descriptionRu }
    : { title: l.titleEn, description: l.descriptionEn };
}
