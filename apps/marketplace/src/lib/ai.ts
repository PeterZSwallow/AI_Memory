import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import { CATEGORIES, CATEGORY_SLUGS, CITIES, CONDITIONS, type Locale } from "./categories";
import { heuristicParseQuery, heuristicRisk, type RiskResult, type SearchFilters } from "./heuristics";

const MODEL = process.env.AI_MODEL ?? "claude-opus-5-5";

export const aiEnabled = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const client = aiEnabled ? new Anthropic() : null;

type ImageInput = { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" };

/**
 * One structured-output call. Server-side refusal fallback is enabled so a
 * safety decline is re-served by a fallback model instead of failing the request.
 */
async function structured<S extends z.ZodType>(opts: {
  schema: S;
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[] | string;
  effort: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<z.infer<S> | null> {
  if (!client) return null;
  try {
    const res = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: opts.system,
      output_config: { effort: opts.effort, format: betaZodOutputFormat(opts.schema) },
      messages: [{ role: "user", content: opts.content }],
    });
    if (res.stop_reason === "refusal") return null;
    return (res.parsed_output as z.infer<S> | null) ?? null;
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) console.warn("[ai] rate limited");
    else if (err instanceof Anthropic.APIError) console.error(`[ai] API error ${err.status}: ${err.message}`);
    else console.error("[ai] unexpected error", err);
    return null;
  }
}

const categoryGuide = CATEGORIES.map((c) => `${c.slug} (${c.en})`).join(", ");

// ---------------------------------------------------------------------------
// 1. Listing from photos
// ---------------------------------------------------------------------------

const ListingDraftSchema = z.object({
  category: z.enum(CATEGORY_SLUGS),
  titleRu: z.string(),
  titleEn: z.string(),
  descriptionRu: z.string(),
  descriptionEn: z.string(),
  condition: z.enum(CONDITIONS),
  attributes: z.array(z.object({ name: z.string(), value: z.string() })),
  suggestedPrice: z.number().int(),
  priceReasoning: z.string(),
});
export type ListingDraft = z.infer<typeof ListingDraftSchema> & { demo?: boolean };

export async function draftListingFromImages(
  images: ImageInput[],
  locale: Locale,
  notes?: string,
): Promise<ListingDraft> {
  const result = await structured({
    schema: ListingDraftSchema,
    effort: "medium",
    system: `You write listings for a Russian second-hand marketplace (like Avito/eBay). Prices are in whole Russian rubles at current Russian second-hand market levels.
From the seller's photos, identify the item as precisely as you can (brand, model, size, color, visible wear) and write an honest, appealing listing.
- category: one of ${categoryGuide}
- titleRu/titleEn: concise, searchable, max 60 characters, brand + model + key spec
- descriptionRu/descriptionEn: 3-6 short sentences or a short bulleted list; mention visible condition honestly; no invented facts you cannot see; no contact details
- attributes: 3-6 key specs, names and values in ${locale === "ru" ? "Russian" : "English"}
- suggestedPrice: realistic used-market price in rubles for this condition
- priceReasoning: one short sentence in ${locale === "ru" ? "Russian" : "English"}`,
    content: [
      ...images.map(
        (img): Anthropic.Beta.BetaContentBlockParam => ({
          type: "image",
          source: { type: "base64", media_type: img.mediaType, data: img.data },
        }),
      ),
      { type: "text", text: notes ? `Seller notes: ${notes}` : "Create the listing." },
    ],
  });
  if (result) return result;
  return {
    demo: true,
    category: "electronics",
    titleRu: "Товар в отличном состоянии",
    titleEn: "Item in great condition",
    descriptionRu:
      "Демо-режим: подключите ANTHROPIC_API_KEY, чтобы AI распознал товар на фото и написал описание автоматически.",
    descriptionEn: "Demo mode: set ANTHROPIC_API_KEY so AI can recognize the item in the photos and write the listing.",
    condition: "used",
    attributes: [],
    suggestedPrice: 5000,
    priceReasoning: locale === "ru" ? "Демо-оценка" : "Demo estimate",
  };
}

// ---------------------------------------------------------------------------
// 2. Natural-language search
// ---------------------------------------------------------------------------

const SearchSchema = z.object({
  keywords: z.string(),
  category: z.enum(CATEGORY_SLUGS).nullable(),
  city: z.enum(CITIES.map((c) => c.ru) as [string, ...string[]]).nullable(),
  priceMin: z.number().int().nullable(),
  priceMax: z.number().int().nullable(),
  condition: z.enum(CONDITIONS).nullable(),
  delivery: z.boolean().nullable(),
  sort: z.enum(["relevance", "newest", "cheap", "expensive"]).nullable(),
});

// Pagination and filter tweaks re-run the same query, so keep recent parses.
const searchCache = new Map<string, SearchFilters & { ai: boolean }>();

export async function parseSearchQuery(q: string): Promise<SearchFilters & { ai: boolean }> {
  const key = q.trim().toLowerCase();
  const cached = searchCache.get(key);
  if (cached) return cached;
  const parsed = await parseSearchQueryUncached(q);
  if (searchCache.size > 500) searchCache.delete(searchCache.keys().next().value!);
  searchCache.set(key, parsed);
  return parsed;
}

async function parseSearchQueryUncached(q: string): Promise<SearchFilters & { ai: boolean }> {
  const result = await structured({
    schema: SearchSchema,
    effort: "low",
    maxTokens: 2000,
    system: `Convert a marketplace search query (Russian or English) into filters. Prices are in rubles; "50к", "50 тыс", "50k" mean 50000.
- keywords: the item being searched for, short, without price/city/condition words; include both a Russian and an English variant when they differ (e.g. "айфон iphone"). Empty string if only filters were given.
- category: one of ${categoryGuide}, or null if unclear
- city: one of the listed Russian city names (map English names to Russian), or null
- condition: "new" for new, "like_new" for "как новый/отличное состояние/excellent", "used" for б/у, else null
- delivery: true only if delivery/shipping is explicitly requested
- sort: "cheap" for cheapest/подешевле, "newest" for newest/свежие, else null`,
    content: q,
  });
  if (result) return { ...result, ai: true };
  return { ...heuristicParseQuery(q), ai: false };
}

// ---------------------------------------------------------------------------
// 3. Translation
// ---------------------------------------------------------------------------

const TranslationSchema = z.object({ title: z.string(), description: z.string() });

export async function translateListing(
  title: string,
  description: string,
  from: Locale,
): Promise<{ title: string; description: string }> {
  const to = from === "ru" ? "English" : "Russian";
  const result = await structured({
    schema: TranslationSchema,
    effort: "low",
    maxTokens: 4000,
    system: `Translate a marketplace listing into natural, idiomatic ${to}. Keep brand names, model numbers and units. Do not add or remove information.`,
    content: `Title: ${title}\n\nDescription:\n${description}`,
  });
  return result ?? { title, description };
}

// ---------------------------------------------------------------------------
// 4. Anti-fraud
// ---------------------------------------------------------------------------

const RiskSchema = z.object({
  score: z.number().int(),
  flags: z.array(z.object({ code: z.string(), severity: z.enum(["low", "medium", "high"]) })),
});

export async function assessListingRisk(input: {
  title: string;
  description: string;
  price: number;
  category: string;
  marketMedian: number | null;
}): Promise<RiskResult> {
  const base = heuristicRisk(input);
  const result = await structured({
    schema: RiskSchema,
    effort: "low",
    maxTokens: 2000,
    system: `You are the anti-fraud reviewer for a classifieds marketplace. Score 0-100 how likely this listing is a scam or prohibited.
Typical red flags: requests for prepayment or card transfers, moving the conversation to other messengers, links, price far below market, prohibited goods (weapons, drugs, documents, counterfeit), contact details in text, pressure tactics.
Use short snake_case codes for flags (e.g. prepayment_request, off_platform_contact, price_too_low, prohibited_item). Return an empty list for clean listings.`,
    content: JSON.stringify(input),
  });
  if (!result) return base;
  const flags = [...base.flags];
  for (const f of result.flags) if (!flags.some((x) => x.code === f.code)) flags.push(f);
  return { score: Math.max(base.score, Math.min(100, Math.max(0, result.score))), flags };
}

// ---------------------------------------------------------------------------
// 5. Price estimate when there are too few comparable listings
// ---------------------------------------------------------------------------

const PriceSchema = z.object({ low: z.number().int(), median: z.number().int(), high: z.number().int() });

export async function estimatePriceWithAI(title: string, category: string, condition: string) {
  return structured({
    schema: PriceSchema,
    effort: "low",
    maxTokens: 1500,
    system:
      "Estimate the current Russian second-hand market price range in whole rubles for the item. low and high are the typical 25th/75th percentile asking prices.",
    content: JSON.stringify({ title, category, condition }),
  });
}
