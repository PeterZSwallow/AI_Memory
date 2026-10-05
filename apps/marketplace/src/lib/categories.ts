export type Locale = "ru" | "en";

export type Category = {
  slug: string;
  ru: string;
  en: string;
  emoji: string;
  color: string; // tailwind gradient used for placeholders / tiles
};

export const CATEGORIES: Category[] = [
  { slug: "phones", ru: "Телефоны", en: "Phones", emoji: "📱", color: "from-sky-400 to-indigo-500" },
  { slug: "electronics", ru: "Электроника", en: "Electronics", emoji: "🎧", color: "from-violet-400 to-fuchsia-500" },
  { slug: "computers", ru: "Компьютеры", en: "Computers", emoji: "💻", color: "from-slate-400 to-slate-600" },
  { slug: "auto", ru: "Авто", en: "Cars", emoji: "🚗", color: "from-rose-400 to-red-500" },
  { slug: "realty", ru: "Недвижимость", en: "Real estate", emoji: "🏠", color: "from-amber-400 to-orange-500" },
  { slug: "home", ru: "Дом и мебель", en: "Home & furniture", emoji: "🛋️", color: "from-emerald-400 to-teal-500" },
  { slug: "fashion", ru: "Одежда и обувь", en: "Fashion", emoji: "👟", color: "from-pink-400 to-rose-500" },
  { slug: "kids", ru: "Детям", en: "Kids", emoji: "🧸", color: "from-yellow-300 to-amber-500" },
  { slug: "sports", ru: "Спорт и отдых", en: "Sports & outdoors", emoji: "🚲", color: "from-lime-400 to-green-500" },
  { slug: "hobby", ru: "Хобби и игры", en: "Hobbies & games", emoji: "🎮", color: "from-cyan-400 to-blue-500" },
  { slug: "pets", ru: "Животные", en: "Pets", emoji: "🐶", color: "from-orange-300 to-amber-500" },
  { slug: "services", ru: "Услуги", en: "Services", emoji: "🛠️", color: "from-zinc-400 to-stone-600" },
];

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug) as [string, ...string[]];

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function categoryName(slug: string, locale: Locale): string {
  const c = getCategory(slug);
  return c ? c[locale] : slug;
}

export const CITIES: { ru: string; en: string }[] = [
  { ru: "Москва", en: "Moscow" },
  { ru: "Санкт-Петербург", en: "Saint Petersburg" },
  { ru: "Казань", en: "Kazan" },
  { ru: "Новосибирск", en: "Novosibirsk" },
  { ru: "Екатеринбург", en: "Yekaterinburg" },
  { ru: "Нижний Новгород", en: "Nizhny Novgorod" },
  { ru: "Краснодар", en: "Krasnodar" },
  { ru: "Сочи", en: "Sochi" },
];

/** Cities are stored in Russian; this localizes them for display. */
export function cityName(city: string, locale: Locale): string {
  if (locale === "ru") return city;
  return CITIES.find((c) => c.ru === city)?.en ?? city;
}

export const CONDITIONS = ["new", "like_new", "used", "for_parts"] as const;
export type ListingConditionValue = (typeof CONDITIONS)[number];
