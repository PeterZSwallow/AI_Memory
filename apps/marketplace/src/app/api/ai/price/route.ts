import { z } from "zod";
import { estimatePriceWithAI } from "@/lib/ai";
import { CATEGORY_SLUGS } from "@/lib/categories";
import { getMarketPrice } from "@/lib/queries";

const Body = z.object({
  title: z.string().min(2).max(120),
  category: z.enum(CATEGORY_SLUGS),
  condition: z.string().max(20),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });
  const { title, category, condition } = parsed.data;
  const market = await getMarketPrice({ category, title });
  if (market) return Response.json({ ...market, source: "market" });
  const ai = await estimatePriceWithAI(title, category, condition);
  if (ai) return Response.json({ ...ai, count: 0, source: "ai" });
  return Response.json({ error: "no_data" }, { status: 404 });
}
