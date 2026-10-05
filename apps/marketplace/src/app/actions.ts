"use server";

import { and, eq, or, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { conversations, events, favorites, listings, messages, reviews, users } from "@/db/schema";
import { assessListingRisk, translateListing } from "@/lib/ai";
import { createSession, destroySession, getCurrentUser, hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { CATEGORY_SLUGS, CONDITIONS, type Locale } from "@/lib/categories";
import { cityExists, isRiskyMessage } from "@/lib/heuristics";
import { getMarketPrice } from "@/lib/queries";

export type FormState = { error?: string } | undefined;

function safeNext(next: FormDataEntryValue | null): string {
  const s = typeof next === "string" ? next : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
}

// --- Language --------------------------------------------------------------

export async function setLanguage(locale: Locale) {
  (await cookies()).set("lang", locale, { path: "/", maxAge: 365 * 86400, sameSite: "lax" });
  revalidatePath("/", "layout");
}

// --- Auth ------------------------------------------------------------------

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !(await verifyPassword(password, user.passwordHash))) return { error: "invalid" };
  await createSession(user.id);
  redirect(safeNext(form.get("next")));
}

export async function demoLogin(form: FormData) {
  const [user] = await db.select().from(users).where(eq(users.email, "demo@vitrina.app")).limit(1);
  if (!user) redirect("/login");
  await createSession(user.id);
  redirect(safeNext(form.get("next")));
}

const RegisterSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.email().max(200),
  password: z.string().min(8).max(200),
  city: z.string().refine(cityExists),
});

export async function register(_: FormState, form: FormData): Promise<FormState> {
  const parsed = RegisterSchema.safeParse({
    name: form.get("name"),
    email: String(form.get("email") ?? "").trim().toLowerCase(),
    password: form.get("password"),
    city: form.get("city"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.some((i) => i.path[0] === "password") ? "weak" : "invalid" };
  }
  const { name, email, password, city } = parsed.data;
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return { error: "exists" };
  const [user] = await db
    .insert(users)
    .values({ name, email, city, passwordHash: await hashPassword(password) })
    .returning({ id: users.id });
  await db.insert(events).values({ type: "signup", userId: user.id });
  await createSession(user.id);
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/");
}

// --- Favorites ---------------------------------------------------------------

export async function toggleFavorite(listingId: string): Promise<{ favorite: boolean } | { error: "auth" }> {
  const user = await getCurrentUser();
  if (!user) return { error: "auth" };
  const where = and(eq(favorites.userId, user.id), eq(favorites.listingId, listingId));
  const [existing] = await db.select().from(favorites).where(where).limit(1);
  if (existing) {
    await db.delete(favorites).where(where);
    return { favorite: false };
  }
  await db.insert(favorites).values({ userId: user.id, listingId }).onConflictDoNothing();
  await db.insert(events).values({ type: "favorite", userId: user.id, listingId });
  return { favorite: true };
}

// --- Listings ----------------------------------------------------------------

const ListingSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(5000),
  category: z.enum(CATEGORY_SLUGS),
  price: z.coerce.number().int().min(0).max(1_000_000_000),
  city: z.string().refine(cityExists),
  condition: z.enum(CONDITIONS),
  negotiable: z.boolean(),
  delivery: z.boolean(),
  attributes: z.array(z.object({ name: z.string().trim().max(60), value: z.string().trim().max(120) })).max(20),
  images: z
    .array(z.string().regex(/^(\/api\/uploads\/|https:\/\/)/))
    .min(1)
    .max(10),
  aiGenerated: z.boolean(),
  // Pre-translated text from the AI draft, so we don't translate twice
  translatedTitle: z.string().max(120).optional(),
  translatedDescription: z.string().max(5000).optional(),
  draftSeconds: z.number().min(0).max(36000).optional(),
});
export type ListingInput = z.input<typeof ListingSchema>;

export type SaveListingResult = { id: string; status: string } | { error: string; field?: string };

export async function saveListing(input: ListingInput, locale: Locale, id?: string): Promise<SaveListingResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "auth" };
  const parsed = ListingSchema.safeParse(input);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    return { error: "validation", field };
  }
  const d = parsed.data;

  if (id) {
    const [own] = await db
      .select({ id: listings.id, titleRu: listings.titleRu, titleEn: listings.titleEn })
      .from(listings)
      .where(and(eq(listings.id, id), eq(listings.sellerId, user.id)))
      .limit(1);
    if (!own) return { error: "forbidden" };
  }

  const other = locale === "ru" ? "en" : "ru";
  const translation =
    d.translatedTitle && d.translatedDescription
      ? { title: d.translatedTitle, description: d.translatedDescription }
      : await translateListing(d.title, d.description, locale);

  const market = await getMarketPrice({ category: d.category, title: d.title, excludeId: id });
  const risk = await assessListingRisk({
    title: d.title,
    description: d.description,
    price: d.price,
    category: d.category,
    marketMedian: market?.median ?? null,
  });
  const status = risk.score >= 70 ? "blocked" : "active";

  const values = {
    category: d.category,
    [locale === "ru" ? "titleRu" : "titleEn"]: d.title,
    [locale === "ru" ? "descriptionRu" : "descriptionEn"]: d.description,
    [other === "ru" ? "titleRu" : "titleEn"]: translation.title,
    [other === "ru" ? "descriptionRu" : "descriptionEn"]: translation.description,
    originalLang: locale,
    price: d.price,
    city: d.city,
    condition: d.condition,
    negotiable: d.negotiable,
    delivery: d.delivery,
    attributes: Object.fromEntries(d.attributes.filter((a) => a.name && a.value).map((a) => [a.name, a.value])),
    images: d.images,
    riskScore: risk.score,
    riskFlags: risk.flags,
    status,
    updatedAt: new Date(),
  } as const;

  let listingId = id;
  if (id) {
    await db
      .update(listings)
      .set(values as Partial<typeof listings.$inferInsert>)
      .where(eq(listings.id, id));
  } else {
    const [row] = await db
      .insert(listings)
      .values({ ...(values as typeof listings.$inferInsert), sellerId: user.id, aiGenerated: d.aiGenerated })
      .returning({ id: listings.id });
    listingId = row.id;
    await db.insert(events).values({
      type: d.aiGenerated ? "ai_listing" : "listing_created",
      userId: user.id,
      listingId,
      value: d.draftSeconds ?? null,
    });
  }
  revalidatePath("/");
  revalidatePath(`/listing/${listingId}`);
  return { id: listingId!, status };
}

export async function setListingStatus(id: string, status: "active" | "sold" | "archived") {
  const user = await requireUser();
  const [l] = await db
    .select({ status: listings.status })
    .from(listings)
    .where(and(eq(listings.id, id), eq(listings.sellerId, user.id)))
    .limit(1);
  // Blocked listings can only be released by moderation
  if (!l || l.status === "blocked") return;
  await db.update(listings).set({ status, updatedAt: new Date() }).where(eq(listings.id, id));
  revalidatePath(`/listing/${id}`);
  revalidatePath("/me");
}

export async function promoteListing(id: string) {
  const user = await requireUser();
  await db
    .update(listings)
    .set({ promotedUntil: new Date(Date.now() + 7 * 86400_000) })
    .where(and(eq(listings.id, id), eq(listings.sellerId, user.id), eq(listings.status, "active")));
  revalidatePath(`/listing/${id}`);
  revalidatePath("/");
}

// --- Messaging ---------------------------------------------------------------

export async function startConversation(listingId: string) {
  const user = await requireUser(`/listing/${listingId}`);
  const [l] = await db
    .select({ sellerId: listings.sellerId })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);
  if (!l || l.sellerId === user.id) redirect(`/listing/${listingId}`);
  const [existing] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.listingId, listingId), eq(conversations.buyerId, user.id)))
    .limit(1);
  if (existing) redirect(`/messages/${existing.id}`);
  const [c] = await db
    .insert(conversations)
    .values({ listingId, buyerId: user.id, sellerId: l.sellerId })
    .returning({ id: conversations.id });
  await db.insert(events).values({ type: "contact", userId: user.id, listingId });
  redirect(`/messages/${c.id}`);
}

export async function sendMessage(conversationId: string, body: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "auth" as const };
  const text = body.trim().slice(0, 2000);
  if (!text) return { error: "empty" as const };
  const [c] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        or(eq(conversations.buyerId, user.id), eq(conversations.sellerId, user.id)),
      ),
    )
    .limit(1);
  if (!c) return { error: "forbidden" as const };
  const [m] = await db
    .insert(messages)
    .values({ conversationId, senderId: user.id, body: text, flagged: isRiskyMessage(text) })
    .returning();
  await db.update(conversations).set({ lastMessageAt: m.createdAt }).where(eq(conversations.id, conversationId));
  return { message: m };
}

// --- Reviews -----------------------------------------------------------------

export async function leaveReview(targetId: string, form: FormData) {
  const user = await requireUser(`/user/${targetId}`);
  const rating = Number(form.get("rating"));
  const text = String(form.get("text") ?? "").trim().slice(0, 1000);
  if (user.id === targetId || !(rating >= 1 && rating <= 5)) return;
  // Only buyers who actually talked to the seller can review them
  const [conv] = await db
    .select({ listingId: conversations.listingId })
    .from(conversations)
    .where(and(eq(conversations.buyerId, user.id), eq(conversations.sellerId, targetId)))
    .orderBy(sql`${conversations.lastMessageAt} desc`)
    .limit(1);
  if (!conv) return;
  await db
    .insert(reviews)
    .values({ authorId: user.id, targetId, listingId: conv.listingId, rating, text })
    .onConflictDoUpdate({
      target: [reviews.authorId, reviews.targetId, reviews.listingId],
      set: { rating, text, createdAt: new Date() },
    });
  revalidatePath(`/user/${targetId}`);
}
