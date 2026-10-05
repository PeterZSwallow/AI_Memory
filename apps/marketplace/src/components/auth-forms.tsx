"use client";

import Link from "next/link";
import { useActionState } from "react";
import { demoLogin, login, register } from "@/app/actions";
import { CITIES } from "@/lib/categories";
import { useI18n } from "./i18n-provider";

export function LoginForm({ next }: { next?: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next ?? "/"} />
        <div>
          <label className="label" htmlFor="email">{t.auth.email}</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="password">{t.auth.password}</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
        </div>
        {state?.error && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{t.auth.invalid}</div>}
        <button type="submit" disabled={pending} className="btn-primary w-full py-3">{t.auth.submitLogin}</button>
      </form>
      <form action={demoLogin}>
        <input type="hidden" name="next" value={next ?? "/"} />
        <button type="submit" className="btn-ai w-full py-3">✨ {t.auth.demoHint}</button>
      </form>
      <p className="text-center text-sm text-slate-500">
        {t.auth.noAccount}{" "}
        <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand-700 hover:underline">
          {t.nav.register}
        </Link>
      </p>
    </div>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState(register, undefined);
  const errors: Record<string, string> = { exists: t.auth.exists, weak: t.auth.weak, invalid: t.common.error };
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? "/"} />
      <div>
        <label className="label" htmlFor="name">{t.auth.name}</label>
        <input id="name" name="name" required minLength={2} autoComplete="name" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="email">{t.auth.email}</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">{t.auth.password}</label>
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="city">{t.auth.city}</label>
        <select id="city" name="city" className="input" defaultValue="Москва">
          {CITIES.map((c) => (
            <option key={c.ru} value={c.ru}>{c[locale]}</option>
          ))}
        </select>
      </div>
      {state?.error && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{errors[state.error] ?? t.common.error}</div>}
      <button type="submit" disabled={pending} className="btn-primary w-full py-3">{t.auth.submitRegister}</button>
      <p className="text-center text-sm text-slate-500">
        {t.auth.haveAccount}{" "}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">{t.nav.login}</Link>
      </p>
    </form>
  );
}
