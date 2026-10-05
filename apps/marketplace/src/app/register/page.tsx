import { RegisterForm } from "@/components/auth-forms";
import { getI18n } from "@/lib/i18n";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-md pt-12">
      <div className="card p-8">
        <h1 className="mb-6 text-2xl font-extrabold">{t.auth.registerTitle}</h1>
        <RegisterForm next={next} />
      </div>
    </div>
  );
}
