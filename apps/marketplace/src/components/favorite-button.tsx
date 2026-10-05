"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleFavorite } from "@/app/actions";
import { useI18n } from "./i18n-provider";

export function FavoriteButton({
  listingId,
  initial,
  variant = "icon",
}: {
  listingId: string;
  initial: boolean;
  variant?: "icon" | "button";
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [fav, setFav] = useState(initial);
  const [pending, start] = useTransition();
  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFav((f) => !f);
    start(async () => {
      const res = await toggleFavorite(listingId);
      if ("error" in res) {
        setFav(initial);
        router.push(`/login?next=/listing/${listingId}`);
      } else setFav(res.favorite);
    });
  };
  if (variant === "button") {
    return (
      <button type="button" onClick={onClick} disabled={pending} className="btn-outline w-full">
        <Heart className={`h-4 w-4 ${fav ? "fill-rose-500 text-rose-500" : ""}`} />
        {fav ? t.listing.removeFavorite : t.listing.addFavorite}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t.listing.addFavorite}
      className="absolute right-2.5 top-2.5 rounded-full bg-white/90 p-2 shadow-sm backdrop-blur transition hover:scale-110"
    >
      <Heart className={`h-4 w-4 ${fav ? "fill-rose-500 text-rose-500" : "text-slate-700"}`} />
    </button>
  );
}
