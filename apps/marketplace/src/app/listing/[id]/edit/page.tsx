import { notFound } from "next/navigation";
import { ListingForm } from "@/components/listing-form";
import { requireUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n";
import { getListing } from "@/lib/queries";

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/listing/${id}/edit`);
  const data = await getListing(id);
  if (!data || data.listing.sellerId !== user.id) notFound();
  const { t, locale } = await getI18n();
  const l = data.listing;
  return (
    <div className="pt-6">
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight">{t.post.editTitle}</h1>
      <ListingForm
        defaultCity={l.city}
        initial={{
          id: l.id,
          title: locale === "ru" ? l.titleRu : l.titleEn,
          description: locale === "ru" ? l.descriptionRu : l.descriptionEn,
          category: l.category,
          price: String(l.price),
          city: l.city,
          condition: l.condition,
          negotiable: l.negotiable,
          delivery: l.delivery,
          attributes: Object.entries(l.attributes).map(([name, value]) => ({ name, value })),
          images: l.images,
        }}
      />
    </div>
  );
}
