import { getCurrentUser } from "@/lib/auth";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, saveImage } from "@/lib/storage";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "no_file" }, { status: 400 });
  if (!ALLOWED_IMAGE_TYPES[file.type]) return Response.json({ error: "type" }, { status: 415 });
  if (file.size > MAX_IMAGE_BYTES) return Response.json({ error: "size" }, { status: 413 });
  const saved = await saveImage(Buffer.from(await file.arrayBuffer()), file.type);
  return Response.json(saved);
}
