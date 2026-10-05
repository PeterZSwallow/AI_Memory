"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { SmartImage } from "./smart-image";

export function Gallery({ images, alt, category }: { images: string[]; alt: string; category: string }) {
  const [i, setI] = useState(0);
  const list = images.length ? images : [""];
  const go = (d: number) => setI((x) => (x + d + list.length) % list.length);
  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-slate-100">
        <SmartImage key={list[i]} src={list[i]} alt={alt} category={category} className="h-full w-full" eager />
        {list.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white" aria-label="previous">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => go(1)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white" aria-label="next">
              <ChevronRight className="h-5 w-5" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-slate-900/60 px-2.5 py-1 text-xs font-medium text-white">
              {i + 1} / {list.length}
            </span>
          </>
        )}
      </div>
      {list.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {list.map((src, idx) => (
            <button
              key={src + idx}
              type="button"
              onClick={() => setI(idx)}
              className={`h-16 w-20 shrink-0 overflow-hidden rounded-xl ring-2 ${idx === i ? "ring-brand-600" : "ring-transparent opacity-70 hover:opacity-100"}`}
            >
              <SmartImage src={src} alt="" category={category} className="h-full w-full" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
