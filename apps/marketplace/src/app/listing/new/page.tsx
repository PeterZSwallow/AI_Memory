import { ListingForm } from "@/components/listing-form";
import { requireUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.post.title };
}

export default async function NewListingPage() {
  const user = await requireUser("/listing/new");
  const { t } = await getI18n();
  return (
    <div className="pt-6">
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight">{t.post.title}</h1>
      <ListingForm defaultCity={user.city ?? "Москва"} />
    </div>
  );
}
