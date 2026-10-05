import { z } from "zod";
import { draftListingFromImages } from "@/lib/ai";
import { getCurrentUser } from "@/lib/auth";
import { readImage } from "@/lib/storage";

const Body = z.object({
  keys: z.array(z.string().max(200)).min(1).max(8),
  locale: z.enum(["ru", "en"]),
  notes: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });

  // The first 4 photos are plenty to identify an item
  const files = await Promise.all(parsed.data.keys.slice(0, 4).map(readImage));
  const images = files
    .filter((f) => f !== null)
    .map((f) => ({ data: f.data.toString("base64"), mediaType: f.contentType as "image/jpeg" }));
  if (!images.length) return Response.json({ error: "no_images" }, { status: 400 });

  const draft = await draftListingFromImages(images, parsed.data.locale, parsed.data.notes);
  return Response.json(draft);
}
