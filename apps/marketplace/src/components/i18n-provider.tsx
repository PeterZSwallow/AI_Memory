"use client";

import { createContext, useContext } from "react";
import type { Locale } from "@/lib/categories";
import { type Dictionary, dictionaries } from "@/lib/dictionaries";

const I18nContext = createContext<{ locale: Locale; t: Dictionary }>({ locale: "ru", t: dictionaries.ru });

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <I18nContext.Provider value={{ locale, t: dictionaries[locale] }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
