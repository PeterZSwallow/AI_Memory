import { and, desc, eq, gte, sql } from "drizzle-orm";
import { Activity, Banknote, Clock, ShieldAlert, Sparkles, Users } from "lucide-react";
import { RankedBars, TrendChart } from "@/components/insights-charts";
import { db } from "@/db";
import { events, listings, users } from "@/db/schema";
import { categoryName, cityName } from "@/lib/categories";
import { compactNumber } from "@/lib/format";
import { getI18n } from "@/lib/i18n";

const DAY = 86400_000;

async function loadMetrics() {
  const since30 = new Date(Date.now() - 30 * DAY);
  const since7 = new Date(Date.now() - 7 * DAY);
  const since14 = new Date(Date.now() - 14 * DAY);

  const [totals, userCount, perDay, byCategory, byCity, funnel, times, searches, growth] = await Promise.all([
    db
      .select({
        gmv: sql<number>`coalesce(sum(${listings.price}) filter (where ${listings.status} = 'active'), 0)::float`,
        active: sql<number>`count(*) filter (where ${listings.status} = 'active')::int`,
        sold: sql<number>`count(*) filter (where ${listings.status} = 'sold')::int`,
        blocked: sql<number>`count(*) filter (where ${listings.status} = 'blocked')::int`,
        aiShare: sql<number>`round(100.0 * count(*) filter (where ${listings.aiGenerated}) / greatest(count(*), 1))::int`,
      })
      .from(listings)
      .then((r) => r[0]),
    db.select({ n: sql<number>`count(*)::int` }).from(users).then((r) => r[0].n),
    db
      .select({ day: sql<string>`to_char(date_trunc('day', ${listings.createdAt}), 'YYYY-MM-DD')`, n: sql<number>`count(*)::int` })
      .from(listings)
      .where(gte(listings.createdAt, since30))
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    db
      .select({ key: listings.category, n: sql<number>`count(*)::int` })
      .from(listings)
      .where(eq(listings.status, "active"))
      .groupBy(listings.category)
      .orderBy(desc(sql`2`)),
    db
      .select({ key: listings.city, n: sql<number>`count(*)::int` })
      .from(listings)
      .where(eq(listings.status, "active"))
      .groupBy(listings.city)
      .orderBy(desc(sql`2`)),
    db
      .select({
        views: sql<number>`count(*) filter (where ${events.type} = 'view')::int`,
        contacts: sql<number>`count(*) filter (where ${events.type} = 'contact')::int`,
      })
      .from(events)
      .where(gte(events.createdAt, since30))
      .then((r) => r[0]),
    db
      .select({
        ai: sql<number | null>`avg(${events.value}) filter (where ${events.type} = 'ai_listing')::float`,
        manual: sql<number | null>`avg(${events.value}) filter (where ${events.type} = 'listing_created')::float`,
      })
      .from(events)
      .then((r) => r[0]),
    db
      .select({ q: sql<string>`${events.payload}->>'q'`, n: sql<number>`count(*)::int` })
      .from(events)
      .where(and(eq(events.type, "ai_search"), gte(events.createdAt, since30)))
      .groupBy(sql`1`)
      .orderBy(desc(sql`2`))
      .limit(8),
    db
      .select({
        cur: sql<number>`count(*) filter (where ${events.createdAt} >= ${since7.toISOString()}::timestamptz)::int`,
        prev: sql<number>`count(*) filter (where ${events.createdAt} < ${since7.toISOString()}::timestamptz)::int`,
      })
      .from(events)
      .where(and(eq(events.type, "contact"), gte(events.createdAt, since14)))
      .then((r) => r[0]),
  ]);

  // Fill missing days so the trend line has no gaps
  const counts = new Map(perDay.map((d) => [d.day, d.n]));
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * DAY).toISOString().slice(0, 10);
    return { day: d, n: counts.get(d) ?? 0 };
  });

  return { totals, userCount, days, byCategory, byCity, funnel, times, searches, growth };
}

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.insights.title };
}

export default async function InsightsPage() {
  const { t, locale } = await getI18n();
  const m = await loadMetrics();
  const wow = m.growth.prev ? Math.round(((m.growth.cur - m.growth.prev) / m.growth.prev) * 100) : 0;
  const conv = m.funnel.views ? ((m.funnel.contacts / m.funnel.views) * 100).toFixed(1) : "0";
  const dayFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });

  const kpis = [
    { icon: Banknote, label: t.insights.gmv, compact: `${compactNumber(m.totals.gmv, locale)} ₽` },
    { icon: Activity, label: t.insights.activeListings, compact: compactNumber(m.totals.active, locale) },
    { icon: Users, label: t.insights.users, compact: compactNumber(m.userCount, locale) },
    { icon: Sparkles, label: t.insights.aiShare, compact: `${m.totals.aiShare}%` },
    {
      icon: Activity,
      label: `${t.insights.contacts} (7d)`,
      compact: compactNumber(m.growth.cur, locale),
      delta: wow,
    },
    { icon: ShieldAlert, label: t.insights.blocked, compact: String(m.totals.blocked) },
  ];

  return (
    <div className="pt-6">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight">{t.insights.title}</h1>
        <p className="mt-1 text-slate-500">{t.insights.subtitle}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="card p-4">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <k.icon className="h-4 w-4" /> {k.label}
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
              <span className="whitespace-nowrap text-2xl font-extrabold">{k.compact}</span>
              {k.delta !== undefined && (
                <span className={`text-xs font-semibold ${k.delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {k.delta >= 0 ? "▲" : "▼"} {Math.abs(k.delta)}% WoW
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="card p-5">
          <h2 className="mb-4 font-bold">{t.insights.newListings}</h2>
          <TrendChart data={m.days.map((d) => ({ label: dayFmt.format(new Date(d.day)), value: d.n }))} />
        </section>
        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-bold"><Clock className="h-4 w-4" /> {t.insights.avgTime}</h2>
          <div className="space-y-5">
            <div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="flex items-center gap-1.5 font-semibold text-fuchsia-700"><Sparkles className="h-4 w-4" /> AI</span>
                <span className="text-2xl font-extrabold">{Math.round(m.times.ai ?? 0)} {t.insights.seconds}</span>
              </div>
              <div className="mt-2 h-2.5 rounded-full bg-slate-100">
                <div className="ai-gradient h-2.5 rounded-full" style={{ width: `${Math.max(3, ((m.times.ai ?? 0) / (m.times.manual || 1)) * 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold text-slate-600">{locale === "ru" ? "Вручную" : "Manual"}</span>
                <span className="text-2xl font-extrabold">{Math.round(m.times.manual ?? 0)} {t.insights.seconds}</span>
              </div>
              <div className="mt-2 h-2.5 rounded-full bg-slate-400" />
            </div>
            {m.times.ai && m.times.manual && (
              <div className="rounded-xl bg-fuchsia-50 px-3 py-2 text-center text-sm font-semibold text-fuchsia-800">
                {Math.round(m.times.manual / m.times.ai)}× {locale === "ru" ? "быстрее с AI" : "faster with AI"}
              </div>
            )}
            <div className="border-t border-slate-100 pt-4">
              <h3 className="mb-2 text-sm font-bold">{t.insights.funnel} (30d)</h3>
              <dl className="grid grid-cols-3 gap-2 text-center">
                <div><dt className="text-lg font-extrabold">{compactNumber(m.funnel.views, locale)}</dt><dd className="text-xs text-slate-500">{t.insights.funnelViews}</dd></div>
                <div><dt className="text-lg font-extrabold">{compactNumber(m.funnel.contacts, locale)}</dt><dd className="text-xs text-slate-500">{t.insights.funnelContacts}</dd></div>
                <div><dt className="text-lg font-extrabold">{conv}%</dt><dd className="text-xs text-slate-500">CR</dd></div>
              </dl>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="card p-5">
          <h2 className="mb-4 font-bold">{t.insights.byCategory}</h2>
          <RankedBars data={m.byCategory.map((c) => ({ label: categoryName(c.key, locale), value: c.n }))} height={340} />
        </section>
        <section className="card p-5">
          <h2 className="mb-4 font-bold">{t.insights.byCity}</h2>
          <RankedBars data={m.byCity.map((c) => ({ label: cityName(c.key, locale), value: c.n }))} height={340} />
        </section>
        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-bold"><Sparkles className="h-4 w-4 text-fuchsia-600" /> {t.insights.searches}</h2>
          <ol className="space-y-2.5">
            {m.searches.map((s, i) => (
              <li key={s.q} className="flex items-center gap-3 text-sm">
                <span className="w-5 text-right font-bold text-slate-400">{i + 1}</span>
                <span className="flex-1 truncate">{s.q}</span>
                <span className="font-semibold tabular-nums text-slate-600">{s.n}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
