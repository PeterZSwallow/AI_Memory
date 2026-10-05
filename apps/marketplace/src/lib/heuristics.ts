import { CITIES, type ListingConditionValue } from "./categories";

export type SearchFilters = {
  keywords: string;
  category: string | null;
  city: string | null;
  priceMin: number | null;
  priceMax: number | null;
  condition: ListingConditionValue | null;
  delivery: boolean | null;
  sort: "relevance" | "newest" | "cheap" | "expensive" | null;
};

export type RiskResult = { score: number; flags: { code: string; severity: "low" | "medium" | "high" }[] };

const CATEGORY_WORDS: [string, RegExp][] = [
  ["phones", /(айфон|iphone|телефон|смартфон|phone|samsung|самсунг|xiaomi|сяоми|pixel)/i],
  ["computers", /(ноутбук|макбук|macbook|laptop|компьютер|computer|пк\b|монитор|monitor|ipad|планшет|tablet)/i],
  ["electronics", /(наушник|headphone|airpods|колонк|speaker|телевизор|\btv\b|камер|camera|фотоаппарат|часы|watch)/i],
  ["auto", /(машин|авто|\bcar\b|toyota|тойот|bmw|бмв|kia|киа|hyundai|хендай|мерседес|mercedes|lada|лада|мотоцикл|motorcycle)/i],
  ["realty", /(квартир|apartment|flat|дом\b|house|комнат|room|аренд|rent|студи)/i],
  ["home", /(диван|sofa|стол\b|table|стул|chair|шкаф|wardrobe|кровать|bed|мебел|furniture|ламп|lamp)/i],
  ["fashion", /(кроссовк|sneaker|куртк|jacket|плать|dress|обувь|shoes|сумк|bag|пальто|coat|джинс|jeans)/i],
  ["kids", /(коляск|stroller|детск|kids|игрушк|toy|автокресл|car seat|lego|лего)/i],
  ["sports", /(велосипед|bike|bicycle|самокат|scooter|лыж|ski|сноуборд|snowboard|палатк|tent|гантел|dumbbell|тренаж)/i],
  ["hobby", /(playstation|ps5|ps4|xbox|nintendo|приставк|console|книг|book|гитар|guitar|настольн|board game)/i],
  ["pets", /(собак|щен|dog|puppy|кошк|кот|котён|cat|kitten|попуга|parrot|аквариум)/i],
  ["services", /(ремонт|repair|услуг|service|репетитор|tutor|уборк|cleaning|маникюр|перевоз|moving)/i],
];

const CITY_STEMS: [string, RegExp][] = [
  ["Москва", /(москв|moscow|мск\b)/i],
  ["Санкт-Петербург", /(петербург|питер|спб|petersburg|\bspb\b)/i],
  ["Казань", /(казан|kazan)/i],
  ["Новосибирск", /(новосибирск|novosibirsk)/i],
  ["Екатеринбург", /(екатеринбург|екб|yekaterinburg|ekaterinburg)/i],
  ["Нижний Новгород", /(нижн\w* новгород|нижний|nizhny)/i],
  ["Краснодар", /(краснодар|krasnodar)/i],
  ["Сочи", /(сочи|sochi)/i],
];

function parseAmount(num: string, suffix: string | undefined): number {
  const n = Number(num.replace(",", ".").replace(/\s/g, ""));
  if (!suffix) return Math.round(n);
  const s = suffix.toLowerCase();
  if (s.startsWith("м") || s === "m" || s.startsWith("mln") || s.startsWith("млн")) return Math.round(n * 1_000_000);
  return Math.round(n * 1000);
}

const AMOUNT = String.raw`(\d+(?:[.,]\d+)?)\s*(тысяч[а-я]*|тыс\.?|к|k|млн|mln|m)?(?![a-zа-я])`;

/** Rule-based fallback for natural-language search when no AI key is configured. */
export function heuristicParseQuery(q: string): SearchFilters {
  let rest = ` ${q} `;
  let priceMin: number | null = null;
  let priceMax: number | null = null;

  const max = new RegExp(String.raw`(?:до|дешевле|не дороже|under|below|less than|up to|max)\s*${AMOUNT}`, "iu").exec(rest);
  if (max) {
    priceMax = parseAmount(max[1], max[2]);
    rest = rest.replace(max[0], " ");
  }
  const min = new RegExp(String.raw`(?:от|дороже|over|above|from|min)\s*${AMOUNT}`, "iu").exec(rest);
  if (min) {
    priceMin = parseAmount(min[1], min[2]);
    rest = rest.replace(min[0], " ");
  }
  rest = rest.replace(/(руб\w*|₽|rub|rubles?)/gi, " ");

  let city: string | null = null;
  for (const [name, re] of CITY_STEMS) {
    const m = re.exec(rest);
    if (m) {
      city = name;
      rest = rest.replace(new RegExp(String.raw`(?:\s(?:в|во|in))?\s(?:saint\s|st\.?\s|санкт-)?\S*${m[0]}\S*`, "iu"), " ");
      break;
    }
  }

  let condition: SearchFilters["condition"] = null;
  if (/(как нов|отличн\w* состоян|идеальн|like new|mint|excellent)/i.test(rest)) condition = "like_new";
  else if (/(\bнов(ый|ая|ое|ые)\b|\bnew\b|запечатан|sealed)/i.test(rest)) condition = "new";
  else if (/(б\/у|\bбу\b|\bused\b|подержан)/i.test(rest)) condition = "used";
  rest = rest.replace(
    /(в\s+)?(хорошем|отличном|идеальном)\s+состоянии|как новый|как новая|like new|in good condition|excellent|б\/у|\bused\b/gi,
    " ",
  );

  const delivery = /(доставк|delivery|shipping|ship\b)/i.test(rest) ? true : null;
  rest = rest.replace(/(с\s+)?доставк\p{L}*|with delivery|shipping/giu, " ");

  let sort: SearchFilters["sort"] = null;
  if (/(дешев|cheap)/i.test(q) && priceMax === null) sort = "cheap";
  if (/(свеж|нов(ые|инки)|newest|latest)/i.test(q)) sort = "newest";

  const category = CATEGORY_WORDS.find(([, re]) => re.test(q))?.[0] ?? null;

  const keywords = rest
    .replace(/\b(в|во|на|и|для|с|по|in|for|the|a|an|with|near|недорого|cheap|cheapest|купить|buy|ищу|looking)\b/gi, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { keywords, category, city, priceMin, priceMax, condition, delivery, sort };
}

const PREPAY = /(предоплат|переведите|перевод на карту|скиньте на карту|prepay|prepayment|wire transfer|western union|send money|оплата вперед|оплатите доставку)/i;
const OFF_PLATFORM = /(whats\s?app|ватсап|вотсап|telegram|телеграм|телеге|\btg\b|viber|вайбер|@[a-z0-9_]{4,}|t\.me\/)/i;
const LINK = /(https?:\/\/|www\.|\.ru\/|\.com\/|bit\.ly)/i;
const PHONE = /(\+?\d[\d\s()-]{9,}\d)/;
const CARD = /\b(?:\d[ -]?){16}\b/;
const PROHIBITED = /(оружи|пистолет|патрон|наркот|weapon|gun|ammo|drugs|паспорт|права на продажу|поддельн|counterfeit|реплика|replica)/i;
const PRESSURE = /(срочно|только сегодня|urgent|today only|первому кто|first come)/i;

export function heuristicRisk(input: { title: string; description: string; price: number; marketMedian: number | null }): RiskResult {
  const text = `${input.title}\n${input.description}`;
  const flags: RiskResult["flags"] = [];
  if (PREPAY.test(text)) flags.push({ code: "prepayment_request", severity: "high" });
  if (OFF_PLATFORM.test(text)) flags.push({ code: "off_platform_contact", severity: "medium" });
  if (LINK.test(text)) flags.push({ code: "external_link", severity: "medium" });
  if (PHONE.test(text) || CARD.test(text)) flags.push({ code: "contact_details_in_text", severity: "low" });
  if (PROHIBITED.test(text)) flags.push({ code: "prohibited_item", severity: "high" });
  if (PRESSURE.test(text)) flags.push({ code: "pressure_tactics", severity: "low" });
  if (input.marketMedian && input.price > 0 && input.price < input.marketMedian * 0.35)
    flags.push({ code: "price_too_low", severity: "high" });
  const weight = { low: 10, medium: 25, high: 45 };
  const score = Math.min(100, flags.reduce((s, f) => s + weight[f.severity], 0));
  return { score, flags };
}

/** Fast synchronous check for chat messages. */
export function isRiskyMessage(body: string): boolean {
  return PREPAY.test(body) || CARD.test(body) || LINK.test(body) || /(telegram|телеграм|whats\s?app|ватсап)/i.test(body);
}

export const RISK_LABELS: Record<string, { ru: string; en: string }> = {
  prepayment_request: { ru: "Просьба о предоплате", en: "Prepayment request" },
  off_platform_contact: { ru: "Уводит в сторонний мессенджер", en: "Off-platform contact" },
  external_link: { ru: "Внешняя ссылка", en: "External link" },
  contact_details_in_text: { ru: "Контакты в тексте", en: "Contact details in text" },
  prohibited_item: { ru: "Возможно запрещённый товар", en: "Possibly prohibited item" },
  pressure_tactics: { ru: "Давление на покупателя", en: "Pressure tactics" },
  price_too_low: { ru: "Цена сильно ниже рынка", en: "Price far below market" },
};

export function cityExists(city: string) {
  return CITIES.some((c) => c.ru === city);
}
