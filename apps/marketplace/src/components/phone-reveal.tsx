"use client";

import { Phone } from "lucide-react";
import { useState } from "react";
import { useI18n } from "./i18n-provider";

export function PhoneReveal({ phone }: { phone: string }) {
  const { t } = useI18n();
  const [shown, setShown] = useState(false);
  return shown ? (
    <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="btn-outline w-full">
      <Phone className="h-4 w-4" /> {phone}
    </a>
  ) : (
    <button type="button" onClick={() => setShown(true)} className="btn-outline w-full">
      <Phone className="h-4 w-4" /> {t.listing.showPhone}
    </button>
  );
}
