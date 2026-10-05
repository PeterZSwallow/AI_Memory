import "server-only";
import { and, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { conversations, listings, messages, users } from "@/db/schema";

const buyer = alias(users, "buyer");
const seller = alias(users, "seller");

export async function getConversations(userId: string) {
  const lastMessage = sql<string | null>`(select ${messages.body} from ${messages} where ${messages.conversationId} = ${conversations.id} order by ${messages.createdAt} desc limit 1)`;
  const unread = sql<number>`(select count(*)::int from ${messages} where ${messages.conversationId} = ${conversations.id} and ${messages.senderId} <> ${userId} and ${messages.readAt} is null)`;
  return db
    .select({
      id: conversations.id,
      lastMessageAt: conversations.lastMessageAt,
      listingId: listings.id,
      titleRu: listings.titleRu,
      titleEn: listings.titleEn,
      price: listings.price,
      image: sql<string | null>`${listings.images}->>0`,
      category: listings.category,
      buyerId: conversations.buyerId,
      buyerName: buyer.name,
      sellerName: seller.name,
      lastMessage,
      unread,
    })
    .from(conversations)
    .innerJoin(listings, eq(listings.id, conversations.listingId))
    .innerJoin(buyer, eq(buyer.id, conversations.buyerId))
    .innerJoin(seller, eq(seller.id, conversations.sellerId))
    .where(or(eq(conversations.buyerId, userId), eq(conversations.sellerId, userId)))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(100);
}

export async function getConversation(id: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .select({
      id: conversations.id,
      buyerId: conversations.buyerId,
      sellerId: conversations.sellerId,
      listing: {
        id: listings.id,
        titleRu: listings.titleRu,
        titleEn: listings.titleEn,
        price: listings.price,
        images: listings.images,
        category: listings.category,
        status: listings.status,
      },
      buyerName: buyer.name,
      sellerName: seller.name,
    })
    .from(conversations)
    .innerJoin(listings, eq(listings.id, conversations.listingId))
    .innerJoin(buyer, eq(buyer.id, conversations.buyerId))
    .innerJoin(seller, eq(seller.id, conversations.sellerId))
    .where(and(eq(conversations.id, id), or(eq(conversations.buyerId, userId), eq(conversations.sellerId, userId))))
    .limit(1);
  if (!row) return null;
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(messages.createdAt)
    .limit(500);
  await db
    .update(messages)
    .set({ readAt: new Date() })
    .where(and(eq(messages.conversationId, id), ne(messages.senderId, userId), isNull(messages.readAt)));
  return { ...row, messages: msgs };
}
