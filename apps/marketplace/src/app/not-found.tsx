import Link from "next/link";
import { getI18n } from "@/lib/i18n";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <div className="ai-text text-7xl font-extrabold">404</div>
      <p className="mt-4 text-lg text-slate-600">{t.common.notFound}</p>
      <Link href="/" className="btn-primary mt-6">{t.common.home}</Link>
    </div>
  );
}
