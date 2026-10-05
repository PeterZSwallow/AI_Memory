"use client";

import { ImagePlus, Loader2, Plus, Sparkles, Trash2, Wand2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { type ListingInput, saveListing } from "@/app/actions";
import { CATEGORIES, CITIES, CONDITIONS, type ListingConditionValue } from "@/lib/categories";
import { formatPrice } from "@/lib/format";
import { useI18n } from "./i18n-provider";

type Photo = { url: string; key?: string; uploading?: boolean; preview?: string };
type Attr = { name: string; value: string };

export type ListingFormInitial = {
  id?: string;
  title: string;
  description: string;
  category: string;
  price: string;
  city: string;
  condition: ListingConditionValue;
  negotiable: boolean;
  delivery: boolean;
  attributes: Attr[];
  images: string[];
};

const MAX_PHOTOS = 8;

/** Downscales a photo in the browser so uploads are fast and fit the AI image limits. */
async function resizeImage(file: File, maxSide = 1600): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.85));
}

function keyFromUrl(url: string) {
  return url.startsWith("/api/uploads/") ? url.slice("/api/uploads/".length) : undefined;
}

export function ListingForm({ initial, defaultCity }: { initial?: ListingFormInitial; defaultCity: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const startedAt = useRef<number | null>(null);

  const [photos, setPhotos] = useState<Photo[]>(initial?.images.map((url) => ({ url, key: keyFromUrl(url) })) ?? []);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "electronics");
  const [price, setPrice] = useState(initial?.price ?? "");
  const [city, setCity] = useState(initial?.city ?? defaultCity);
  const [condition, setCondition] = useState<ListingConditionValue>(initial?.condition ?? "used");
  const [negotiable, setNegotiable] = useState(initial?.negotiable ?? true);
  const [delivery, setDelivery] = useState(initial?.delivery ?? false);
  const [attributes, setAttributes] = useState<Attr[]>(initial?.attributes ?? []);

  const [translation, setTranslation] = useState<{
    title: string;
    description: string;
    srcTitle: string;
    srcDescription: string;
  } | null>(null);
  const [aiUsed, setAiUsed] = useState(false);
  const [aiState, setAiState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [aiSeconds, setAiSeconds] = useState<number | null>(null);
  const [aiDemo, setAiDemo] = useState(false);
  const [priceHint, setPriceHint] = useState<{ low: number; median: number; high: number; count: number; source: string } | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const uploading = photos.some((p) => p.uploading);

  async function addFiles(files: FileList | File[]) {
    startedAt.current ??= Date.now();
    const list = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, MAX_PHOTOS - photos.length);
    const pending = list.map((f) => ({ url: "", preview: URL.createObjectURL(f), uploading: true }));
    setPhotos((p) => [...p, ...pending]);
    await Promise.all(
      list.map(async (file, i) => {
        const body = new FormData();
        body.append("file", await resizeImage(file), file.name.replace(/\.\w+$/, ".jpg"));
        const res = await fetch("/api/upload", { method: "POST", body });
        const preview = pending[i].preview;
        if (!res.ok) {
          if (res.status === 401) router.push("/login?next=/listing/new");
          setPhotos((p) => p.filter((x) => x.preview !== preview));
          return;
        }
        const { url, key } = (await res.json()) as { url: string; key: string };
        setPhotos((p) => p.map((x) => (x.preview === preview ? { url, key, preview } : x)));
      }),
    );
  }

  async function runAI() {
    const keys = photos.map((p) => p.key).filter((k): k is string => Boolean(k));
    if (!keys.length) return setError(t.post.errors.photos);
    setAiState("loading");
    setError(null);
    const t0 = performance.now();
    try {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys, locale, notes: title || undefined }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const d = await res.json();
      setCategory(d.category);
      const [srcTitle, srcDescription] = locale === "ru" ? [d.titleRu, d.descriptionRu] : [d.titleEn, d.descriptionEn];
      setTitle(srcTitle);
      setDescription(srcDescription);
      setTranslation(
        locale === "ru"
          ? { title: d.titleEn, description: d.descriptionEn, srcTitle, srcDescription }
          : { title: d.titleRu, description: d.descriptionRu, srcTitle, srcDescription },
      );
      setCondition(d.condition);
      setAttributes(d.attributes ?? []);
      if (d.suggestedPrice > 0) setPrice(String(d.suggestedPrice));
      setAiDemo(Boolean(d.demo));
      setAiUsed(true);
      setAiSeconds((performance.now() - t0) / 1000);
      setAiState("done");
      void suggestPrice(locale === "ru" ? d.titleRu : d.titleEn, d.category, d.condition);
    } catch {
      setAiState("error");
      setError(t.common.error);
    }
  }

  async function suggestPrice(forTitle = title, forCategory = category, forCondition: string = condition) {
    if (forTitle.trim().length < 2) return;
    setPriceLoading(true);
    try {
      const res = await fetch("/api/ai/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: forTitle, category: forCategory, condition: forCondition }),
      });
      setPriceHint(res.ok ? await res.json() : null);
    } finally {
      setPriceLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const images = photos.filter((p) => p.url).map((p) => p.url);
    if (!images.length) return setError(t.post.errors.photos);
    if (title.trim().length < 3) return setError(t.post.errors.title);
    if (description.trim().length < 10) return setError(t.post.errors.description);
    if (!/^\d+$/.test(price.trim())) return setError(t.post.errors.price);

    // Reuse the AI translation only if the user did not edit the text afterwards
    const input: ListingInput = {
      title,
      description,
      category,
      price: Number(price),
      city,
      condition,
      negotiable,
      delivery,
      attributes,
      images,
      aiGenerated: aiUsed,
      draftSeconds: startedAt.current ? (Date.now() - startedAt.current) / 1000 : undefined,
      ...(translation && translation.srcTitle === title && translation.srcDescription === description
        ? { translatedTitle: translation.title, translatedDescription: translation.description }
        : {}),
    };
    setSaving(true);
    const res = await saveListing(input, locale, initial?.id);
    if ("error" in res) {
      setSaving(false);
      if (res.error === "auth") router.push("/login?next=/listing/new");
      else setError(t.post.errors.generic);
      return;
    }
    router.push(`/listing/${res.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        {/* Photos + AI */}
        <section className="card overflow-hidden">
          <div className="ai-gradient px-5 py-4 text-white">
            <div className="flex items-center gap-2 text-lg font-bold">
              <Sparkles className="h-5 w-5" /> {t.post.aiTitle}
            </div>
            <p className="mt-0.5 text-sm text-white/85">{t.post.aiSubtitle}</p>
          </div>
          <div className="space-y-4 p-5">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                void addFiles(e.dataTransfer.files);
              }}
              className={`grid grid-cols-3 gap-3 rounded-2xl border-2 border-dashed p-3 sm:grid-cols-4 ${dragOver ? "border-brand-500 bg-brand-50" : "border-slate-200"}`}
            >
              {photos.map((p, i) => (
                <div key={p.preview ?? p.url} className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100">
                  {/* biome-ignore lint/performance/noImgElement: local previews */}
                  <img src={p.preview ?? p.url} alt="" className="h-full w-full object-cover" />
                  {p.uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                      <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
                    </div>
                  )}
                  {i === 0 && <span className="absolute bottom-1.5 left-1.5 rounded bg-slate-900/70 px-1.5 text-[10px] font-semibold text-white">1</span>}
                  <button
                    type="button"
                    onClick={() => setPhotos((ps) => ps.filter((x) => x !== p))}
                    className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 opacity-0 shadow transition group-hover:opacity-100"
                    aria-label={t.post.removePhoto}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-xl bg-slate-50 text-slate-500 hover:bg-brand-50 hover:text-brand-700 ${photos.length === 0 ? "col-span-3 py-12 sm:col-span-4" : "aspect-square"}`}
                >
                  <ImagePlus className="h-7 w-7" />
                  <span className="px-2 text-center text-xs font-medium">{photos.length === 0 ? t.post.dropHint : t.post.uploadPhotos}</span>
                </button>
              )}
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files) void addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
            <button
              type="button"
              onClick={runAI}
              disabled={!photos.some((p) => p.key) || uploading || aiState === "loading"}
              className="btn-ai w-full py-3 text-base"
            >
              {aiState === "loading" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wand2 className="h-5 w-5" />}
              {aiState === "loading" ? t.post.generating : t.post.generate}
            </button>
            {aiState === "done" && (
              <div className={`rounded-xl px-3 py-2 text-sm ${aiDemo ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
                ✓ {t.post.aiDone}
                {aiSeconds != null && <b> ({aiSeconds.toFixed(1)} {t.insights.seconds})</b>}
              </div>
            )}
          </div>
        </section>

        {/* Details */}
        <section className="card space-y-5 p-5">
          <div>
            <label className="label" htmlFor="title">{t.post.fieldTitle}</label>
            <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className="input" />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="category">{t.post.fieldCategory}</label>
              <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className="input">
                {CATEGORIES.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.emoji} {c[locale]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="condition">{t.post.fieldCondition}</label>
              <select id="condition" value={condition} onChange={(e) => setCondition(e.target.value as ListingConditionValue)} className="input">
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>{t.listing.condition[c]}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="description">{t.post.fieldDescription}</label>
            <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={7} maxLength={5000} className="input resize-y" />
            <p className="mt-1.5 text-xs text-slate-400">{t.post.translationNote}</p>
          </div>
          <div>
            <span className="label">{t.post.fieldAttributes}</span>
            <div className="space-y-2">
              {attributes.map((a, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={a.name}
                    placeholder={t.post.attrName}
                    onChange={(e) => setAttributes((as) => as.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    className="input"
                  />
                  <input
                    value={a.value}
                    placeholder={t.post.attrValue}
                    onChange={(e) => setAttributes((as) => as.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                    className="input"
                  />
                  <button type="button" onClick={() => setAttributes((as) => as.filter((_, j) => j !== i))} className="rounded-xl px-2 text-slate-400 hover:text-rose-500" aria-label="remove">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setAttributes((as) => [...as, { name: "", value: "" }])} className="flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
                <Plus className="h-4 w-4" /> {t.post.addAttribute}
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Price & publish */}
      <aside className="space-y-4">
        <section className="card space-y-4 p-5 lg:sticky lg:top-20">
          <div>
            <label className="label" htmlFor="price">{t.post.fieldPrice}</label>
            <input id="price" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="input text-lg font-bold" />
            <button type="button" onClick={() => suggestPrice()} disabled={priceLoading || title.trim().length < 2} className="mt-2 flex items-center gap-1.5 text-sm font-medium text-fuchsia-700 hover:underline disabled:opacity-50">
              {priceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {t.post.suggestPrice}
            </button>
            {priceHint && (
              <div className="mt-2 rounded-xl bg-fuchsia-50 p-3 text-sm ring-1 ring-fuchsia-200">
                <div className="text-xs text-fuchsia-800">{t.post.suggestedPrice}</div>
                <button type="button" onClick={() => setPrice(String(priceHint.median))} className="text-lg font-bold text-fuchsia-900 hover:underline">
                  {formatPrice(priceHint.median, locale)}
                </button>
                <div className="text-xs text-fuchsia-700">
                  {formatPrice(priceHint.low, locale)} — {formatPrice(priceHint.high, locale)}
                  {priceHint.count > 0 ? ` · ${priceHint.count} ${t.listing.basedOn}` : " · AI"}
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="label" htmlFor="city">{t.post.fieldCity}</label>
            <select id="city" value={city} onChange={(e) => setCity(e.target.value)} className="input">
              {CITIES.map((c) => (
                <option key={c.ru} value={c.ru}>{c[locale]}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={negotiable} onChange={(e) => setNegotiable(e.target.checked)} className="h-4 w-4 accent-brand-600" /> {t.post.fieldNegotiable}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} className="h-4 w-4 accent-brand-600" /> {t.post.fieldDelivery}
          </label>
          {error && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
          <button type="submit" disabled={saving || uploading} className="btn-primary w-full py-3 text-base">
            {saving && <Loader2 className="h-5 w-5 animate-spin" />}
            {saving ? t.post.publishing : initial?.id ? t.post.save : t.post.publish}
          </button>
        </section>
      </aside>
    </form>
  );
}
