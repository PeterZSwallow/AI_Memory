import { and, asc, eq, gt, isNull, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

/** Polling endpoint for the chat: messages newer than `after`, marking incoming ones read. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  const { id } = await params;
  const [c] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, id), or(eq(conversations.buyerId, user.id), eq(conversations.sellerId, user.id))))
    .limit(1);
  if (!c) return Response.json({ error: "not_found" }, { status: 404 });

  const after = new URL(req.url).searchParams.get("after");
  const afterDate = after ? new Date(after) : null;
  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, id),
        afterDate && !Number.isNaN(afterDate.getTime()) ? gt(messages.createdAt, afterDate) : undefined,
      ),
    )
    .orderBy(asc(messages.createdAt))
    .limit(200);
  await db
    .update(messages)
    .set({ readAt: new Date() })
    .where(and(eq(messages.conversationId, id), ne(messages.senderId, user.id), isNull(messages.readAt)));
  return Response.json({ messages: rows });
}
