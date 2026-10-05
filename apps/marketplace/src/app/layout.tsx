import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { I18nProvider } from "@/components/i18n-provider";
import { getI18n } from "@/lib/i18n";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { default: `${t.brand} — ${t.tagline}`, template: `%s · ${t.brand}` },
    description: t.home.heroSubtitle,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale } = await getI18n();
  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body className="min-h-screen font-sans">
        <I18nProvider locale={locale}>
          <Header />
          <main className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6">{children}</main>
          <Footer />
        </I18nProvider>
      </body>
    </html>
  );
}
