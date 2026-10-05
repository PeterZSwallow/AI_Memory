import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(next?.startsWith("/") ? next : "/");
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-md pt-12">
      <div className="card p-8">
        <h1 className="mb-6 text-2xl font-extrabold">{t.auth.loginTitle}</h1>
        <LoginForm next={next} />
      </div>
    </div>
  );
}
