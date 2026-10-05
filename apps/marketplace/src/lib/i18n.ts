import "server-only";
import { cookies, headers } from "next/headers";
import type { Locale } from "./categories";
import { dictionaries } from "./dictionaries";

export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get("lang")?.value;
  if (c === "ru" || c === "en") return c;
  const accept = (await headers()).get("accept-language") ?? "";
  return accept.toLowerCase().startsWith("en") ? "en" : "ru";
}

export async function getI18n() {
  const locale = await getLocale();
  return { locale, t: dictionaries[locale] };
}
