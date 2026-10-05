import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    avatarUrl: text("avatar_url"),
    city: text("city"),
    phone: text("phone"),
    bio: text("bio"),
    verified: boolean("verified").notNull().default(false),
    isAdmin: boolean("is_admin").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // sha256 of the cookie token
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export type ListingStatus = "active" | "sold" | "archived" | "blocked";
export type ListingCondition = "new" | "like_new" | "used" | "for_parts";
export type RiskFlag = { code: string; severity: "low" | "medium" | "high" };

export const listings = pgTable(
  "listings",
  {
    id: id(),
    sellerId: text("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    titleRu: text("title_ru").notNull(),
    titleEn: text("title_en").notNull(),
    descriptionRu: text("description_ru").notNull(),
    descriptionEn: text("description_en").notNull(),
    originalLang: text("original_lang").$type<"ru" | "en">().notNull().default("ru"),
    price: integer("price").notNull(), // whole rubles
    negotiable: boolean("negotiable").notNull().default(false),
    condition: text("condition").$type<ListingCondition>().notNull().default("used"),
    city: text("city").notNull(),
    attributes: jsonb("attributes").$type<Record<string, string>>().notNull().default({}),
    images: jsonb("images").$type<string[]>().notNull().default([]),
    status: text("status").$type<ListingStatus>().notNull().default("active"),
    views: integer("views").notNull().default(0),
    delivery: boolean("delivery").notNull().default(false),
    promotedUntil: timestamp("promoted_until", { withTimezone: true }),
    aiGenerated: boolean("ai_generated").notNull().default(false),
    riskScore: integer("risk_score").notNull().default(0),
    riskFlags: jsonb("risk_flags").$type<RiskFlag[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`setweight(to_tsvector('russian', coalesce(title_ru, '')), 'A') || setweight(to_tsvector('english', coalesce(title_en, '')), 'A') || setweight(to_tsvector('russian', coalesce(description_ru, '')), 'C') || setweight(to_tsvector('english', coalesce(description_en, '')), 'C')`,
    ),
  },
  (t) => [
    index("listings_status_created_idx").on(t.status, t.createdAt),
    index("listings_category_idx").on(t.category),
    index("listings_seller_idx").on(t.sellerId),
    index("listings_city_idx").on(t.city),
    index("listings_search_idx").using("gin", t.searchVector),
  ],
);

export const favorites = pgTable(
  "favorites",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    listingId: text("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.listingId] })],
);

export const conversations = pgTable(
  "conversations",
  {
    id: id(),
    listingId: text("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    buyerId: text("buyer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sellerId: text("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("conversations_listing_buyer_idx").on(t.listingId, t.buyerId),
    index("conversations_buyer_idx").on(t.buyerId),
    index("conversations_seller_idx").on(t.sellerId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: id(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    flagged: boolean("flagged").notNull().default(false),
    readAt: timestamp("read_at", { withTimezone: true }),
    // millisecond precision so the chat poller's `after` cursor round-trips through JS Dates
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetId: text("target_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    listingId: text("listing_id").references(() => listings.id, { onDelete: "set null" }),
    rating: integer("rating").notNull(),
    text: text("text").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("reviews_target_idx").on(t.targetId),
    uniqueIndex("reviews_author_target_listing_idx").on(t.authorId, t.targetId, t.listingId),
  ],
);

/** Product analytics events that power the investor dashboard. */
export const events = pgTable(
  "events",
  {
    id: id(),
    type: text("type")
      .$type<"view" | "search" | "ai_search" | "contact" | "listing_created" | "ai_listing" | "signup" | "favorite">()
      .notNull(),
    userId: text("user_id"),
    listingId: text("listing_id"),
    value: real("value"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("events_type_created_idx").on(t.type, t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Listing = typeof listings.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Review = typeof reviews.$inferSelect;
