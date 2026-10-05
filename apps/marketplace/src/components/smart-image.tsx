"use client";

import { useState } from "react";
import { getCategory } from "@/lib/categories";

/** Image with a branded category placeholder when the source is missing or fails. */
export function SmartImage({
  src,
  alt,
  category,
  className = "",
  eager = false,
}: {
  src?: string;
  alt: string;
  category: string;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const cat = getCategory(category);
  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br ${cat?.color ?? "from-slate-300 to-slate-500"} ${className}`}
        aria-label={alt}
      >
        <span className="text-5xl drop-shadow-sm">{cat?.emoji ?? "📦"}</span>
      </div>
    );
  }
  return (
    // biome-ignore lint/performance/noImgElement: user uploads come from arbitrary storage backends
    <img src={src} alt={alt} loading={eager ? "eager" : "lazy"} onError={() => setFailed(true)} className={`object-cover ${className}`} />
  );
}
