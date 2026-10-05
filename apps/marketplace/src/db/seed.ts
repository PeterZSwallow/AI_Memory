import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { CITIES } from "../lib/categories";
import { hashPassword } from "../lib/password";
import * as schema from "./schema";
import {
  AI_SEARCHES,
  CHAT_SCRIPTS,
  FIRST_NAMES,
  img,
  LAST_INITIALS,
  REVIEW_TEXTS,
  TEMPLATES,
} from "./seed-data";

const url = process.env.DATABASE_URL ?? "postgres://vitrina:vitrina@localhost:5432/vitrina";
const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

// Deterministic PRNG so every seed produces the same demo.
let state = 42;
const rand = () => {
  state = (state * 1664525 + 1013904223) % 4294967296;
  return state / 4294967296;
};
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (a: number, b: number) => a + rand() * (b - a);
const DAY = 86400_000;
const now = Date.now();

/** Skews dates toward the present so charts show growth. */
const growthDate = (days: number) => new Date(now - Math.pow(rand(), 1.8) * days * DAY - rand() * 3600_000);

function roundPrice(p: number) {
  if (p > 1_000_000) return Math.round(p / 10000) * 10000;
  if (p > 20000) return Math.round(p / 500) * 500;
  return Math.round(p / 100) * 100;
}

const CITY_WEIGHTS = [0.32, 0.2, 0.08, 0.08, 0.1, 0.07, 0.09, 0.06];
function weightedCity() {
  let r = rand();
  for (let i = 0; i < CITIES.length; i++) {
    r -= CITY_WEIGHTS[i];
    if (r <= 0) return CITIES[i].ru;
  }
  return CITIES[0].ru;
}

async function main() {
  console.log("Resetting tables…");
  await db.execute(
    sql`truncate table events, reviews, messages, conversations, favorites, listings, sessions, users restart identity cascade`,
  );

  const passwordHash = await hashPassword("demo12345");

  // Users ------------------------------------------------------------------
  const demo = {
    id: crypto.randomUUID(),
    email: "demo@vitrina.app",
    passwordHash,
    name: "Демо Пользователь",
    city: "Москва",
    phone: "+7 900 000-00-00",
    verified: true,
    isAdmin: true,
    createdAt: new Date(now - 120 * DAY),
  };
  const sellers = FIRST_NAMES.map((first, i) => ({
    id: crypto.randomUUID(),
    email: `user${i + 1}@vitrina.app`,
    passwordHash,
    name: `${first} ${LAST_INITIALS[i % LAST_INITIALS.length]}.`,
    city: weightedCity(),
    phone: `+7 9${String(10 + i).padStart(2, "0")} ${String(100 + i * 7).slice(-3)}-${String(10 + i).slice(-2)}-${String(30 + i).slice(-2)}`,
    verified: rand() > 0.35,
    isAdmin: false,
    createdAt: growthDate(365),
  }));
  const allUsers = [demo, ...sellers];
  await db.insert(schema.users).values(allUsers);

  // Listings ---------------------------------------------------------------
  type NewListing = typeof schema.listings.$inferInsert;
  const rows: NewListing[] = [];
  for (const t of TEMPLATES) {
    const copies = t.category === "realty" || t.category === "auto" ? 4 : 5 + Math.floor(rand() * 3);
    for (let c = 0; c < copies; c++) {
      const variant = t.variants ? t.variants[c % t.variants.length] : null;
      const createdAt = growthDate(75);
      const status = rand() < 0.1 ? "sold" : rand() < 0.04 ? "archived" : "active";
      const seller = c === 0 && rows.filter((r) => r.sellerId === demo.id).length < 6 && rand() < 0.2 ? demo : pick(sellers);
      const city = seller.id === demo.id ? "Москва" : weightedCity();
      const ageDays = (now - createdAt.getTime()) / DAY;
      rows.push({
        id: crypto.randomUUID(),
        sellerId: seller.id,
        category: t.category,
        titleRu: variant ? `${t.titleRu}, ${variant.ru}` : t.titleRu,
        titleEn: variant ? `${t.titleEn}, ${variant.en}` : t.titleEn,
        descriptionRu: t.descRu,
        descriptionEn: t.descEn,
        originalLang: "ru",
        price: roundPrice(between(t.price[0], t.price[1]) * (variant?.k ?? 1)),
        negotiable: rand() > 0.5,
        condition: t.condition ?? "used",
        city,
        attributes: t.attrs,
        images: (c % 2 === 1 ? [...t.images].reverse() : t.images).map(img),
        status,
        views: Math.round(between(20, 120) + ageDays * between(8, 40)),
        delivery: t.delivery ?? false,
        promotedUntil: rand() < 0.1 ? new Date(now + between(1, 7) * DAY) : null,
        // AI adoption grows over time: newer listings are more often AI-created
        aiGenerated: rand() < 0.75 - ageDays / 120,
        createdAt,
        updatedAt: createdAt,
      });
    }
  }

  // Two listings caught by anti-fraud, to demo moderation
  const scam = (ru: string, en: string, descRu: string, descEn: string, price: number, category: string, image: string) => ({
    id: crypto.randomUUID(),
    sellerId: pick(sellers).id,
    category,
    titleRu: ru,
    titleEn: en,
    descriptionRu: descRu,
    descriptionEn: descEn,
    originalLang: "ru" as const,
    price,
    condition: "new" as const,
    city: pick(CITIES).ru,
    images: [img(image)],
    status: "blocked" as const,
    riskScore: 90,
    riskFlags: [
      { code: "prepayment_request", severity: "high" as const },
      { code: "price_too_low", severity: "high" as const },
      { code: "off_platform_contact", severity: "medium" as const },
    ],
    createdAt: growthDate(20),
  });
  rows.push(
    scam(
      "iPhone 15 Pro Max новый, запечатан",
      "iPhone 15 Pro Max new, sealed",
      "Срочно! Только предоплата на карту, пишите в телеграм @fastsale.",
      "Urgent! Prepayment to card only, message me on telegram @fastsale.",
      15000,
      "phones",
      "1592899677977-9c10ca588bbd",
    ),
    scam(
      "MacBook Pro 16 M3 Max",
      "MacBook Pro 16 M3 Max",
      "Отправлю после оплаты доставки. Связь только в WhatsApp.",
      "Will ship after you pay for delivery. WhatsApp only.",
      25000,
      "computers",
      "1517336714731-489689fd1ca8",
    ),
  );

  for (let i = 0; i < rows.length; i += 200) await db.insert(schema.listings).values(rows.slice(i, i + 200));
  const active = rows.filter((r) => r.status === "active");
  console.log(`Inserted ${rows.length} listings (${active.length} active)`);

  // Favorites --------------------------------------------------------------
  const favs = new Map<string, { userId: string; listingId: string }>();
  for (let i = 0; i < 260; i++) {
    const u = pick(allUsers);
    const l = pick(active);
    if (l.sellerId !== u.id) favs.set(`${u.id}:${l.id}`, { userId: u.id, listingId: l.id! });
  }
  for (const l of active.filter((l) => l.sellerId !== demo.id).slice(0, 6)) {
    favs.set(`${demo.id}:${l.id}`, { userId: demo.id, listingId: l.id! });
  }
  await db.insert(schema.favorites).values([...favs.values()]);

  // Conversations ----------------------------------------------------------
  const convs: (typeof schema.conversations.$inferInsert)[] = [];
  const msgs: (typeof schema.messages.$inferInsert)[] = [];
  const addConversation = (listing: NewListing, buyerId: string) => {
    const id = crypto.randomUUID();
    const script = pick(CHAT_SCRIPTS);
    const start = Math.min(
      Math.max(new Date(listing.createdAt!).getTime(), now - 10 * DAY) + rand() * DAY,
      now - between(3, 30) * 3600_000,
    );
    let t = start;
    script.forEach((body, i) => {
      t += between(2, 90) * 60_000;
      msgs.push({
        conversationId: id,
        senderId: i % 2 === 0 ? buyerId : listing.sellerId,
        body,
        createdAt: new Date(Math.min(t, now - 60_000)),
        readAt: i < script.length - 1 ? new Date(Math.min(t, now - 60_000)) : null,
      });
    });
    convs.push({
      id,
      listingId: listing.id!,
      buyerId,
      sellerId: listing.sellerId,
      createdAt: new Date(start),
      lastMessageAt: new Date(Math.min(t, now - 60_000)),
    });
  };
  const used = new Set<string>();
  for (const l of active.filter((l) => l.sellerId === demo.id)) {
    for (let k = 0; k < 2; k++) {
      const b = pick(sellers);
      if (!used.has(`${l.id}:${b.id}`)) {
        used.add(`${l.id}:${b.id}`);
        addConversation(l, b.id);
      }
    }
  }
  for (const l of active.filter((l) => l.sellerId !== demo.id).slice(10, 13)) {
    used.add(`${l.id}:${demo.id}`);
    addConversation(l, demo.id);
  }
  for (let i = 0; i < 120; i++) {
    const l = pick(active);
    const b = pick(sellers);
    if (b.id !== l.sellerId && !used.has(`${l.id}:${b.id}`)) {
      used.add(`${l.id}:${b.id}`);
      addConversation(l, b.id);
    }
  }
  await db.insert(schema.conversations).values(convs);
  for (let i = 0; i < msgs.length; i += 300) await db.insert(schema.messages).values(msgs.slice(i, i + 300));

  // Reviews ----------------------------------------------------------------
  const revs = new Map<string, typeof schema.reviews.$inferInsert>();
  for (let i = 0; i < 220; i++) {
    const l = pick(rows.filter((r) => r.status !== "blocked"));
    const author = pick(allUsers);
    if (author.id === l.sellerId) continue;
    revs.set(`${author.id}:${l.sellerId}:${l.id}`, {
      authorId: author.id,
      targetId: l.sellerId,
      listingId: l.id,
      rating: rand() < 0.75 ? 5 : rand() < 0.7 ? 4 : 3,
      text: pick(REVIEW_TEXTS),
      createdAt: growthDate(60),
    });
  }
  await db.insert(schema.reviews).values([...revs.values()]);

  // Analytics events (60 days, growing) --------------------------------------
  type Ev = typeof schema.events.$inferInsert;
  const evs: Ev[] = [];
  for (let d = 59; d >= 0; d--) {
    const growth = 1 + (59 - d) / 18; // ~4x over two months
    const dayStart = now - d * DAY;
    const at = () => new Date(Math.min(dayStart - rand() * DAY, now - 1000));
    for (let i = 0; i < Math.round(160 * growth * between(0.85, 1.15)); i++)
      evs.push({ type: "view", listingId: pick(active).id, createdAt: at() });
    for (let i = 0; i < Math.round(14 * growth * between(0.8, 1.2)); i++)
      evs.push({ type: "contact", listingId: pick(active).id, createdAt: at() });
    for (let i = 0; i < Math.round(9 * growth * between(0.8, 1.2)); i++)
      evs.push({ type: "ai_search", payload: { q: pick(AI_SEARCHES) }, createdAt: at() });
    for (let i = 0; i < Math.round(4 * growth); i++) evs.push({ type: "search", createdAt: at() });
    for (let i = 0; i < Math.round(2 * growth * between(0.6, 1.4)); i++) evs.push({ type: "signup", createdAt: at() });
  }
  for (const l of rows) {
    evs.push({
      type: l.aiGenerated ? "ai_listing" : "listing_created",
      listingId: l.id,
      value: l.aiGenerated ? between(7, 16) : between(170, 420),
      createdAt: l.createdAt as Date,
    });
  }
  for (let i = 0; i < evs.length; i += 1000) await db.insert(schema.events).values(evs.slice(i, i + 1000));

  console.log(
    `Seeded ${allUsers.length} users, ${favs.size} favorites, ${convs.length} conversations, ${msgs.length} messages, ${revs.size} reviews, ${evs.length} events`,
  );
  console.log("Demo login: demo@vitrina.app / demo12345");
  await client.end();
}

main().catch(async (err) => {
  console.error(err);
  await client.end();
  process.exit(1);
});
