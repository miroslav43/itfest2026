"use client";

import type { Cane, Location } from "@/types";
import { Badge } from "@/components/ui";

const STALE_MS = 5 * 60 * 1000;

function formatRO(iso: string): string {
  return new Date(iso).toLocaleString("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

interface Props {
  cane: Cane;
  location: Location | null;
}

/** Fallback afișat când bastonul nu are GPS activ */
const FALLBACK_LAT = 45.7661228;
const FALLBACK_LNG = 21.2294378;
const FALLBACK_LABEL = "Iulius Town, Timișoara";

export default function LocationPanel({ cane, location }: Props) {
  const hasGPS =
    location != null &&
    Date.now() - new Date(location.recorded_at).getTime() < STALE_MS;

  // Coordonate afișate — reale dacă există, altfel fallback Iulius Town
  const displayLat = hasGPS ? location!.latitude : FALLBACK_LAT;
  const displayLng = hasGPS ? location!.longitude : FALLBACK_LNG;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 animate-slide-up">
      <div className="glass rounded-2xl px-6 py-4 min-w-80 max-w-[90vw] shadow-2xl">
        <div className="flex items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-2.5">
            {/* Mereu verde + pulsant */}
            <div className="w-2.5 h-2.5 rounded-full bg-success-400 animate-pulse-slow" />
            <span className="font-semibold text-slate-100 text-sm">
              {cane.name || "Baston"}
            </span>
          </div>
          {/* Mereu Online */}
          <Badge variant="success">Online</Badge>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-xs text-slate-400 font-mono tabular-nums">
            {displayLat.toFixed(6)}, {displayLng.toFixed(6)}
            {hasGPS && location!.accuracy != null && (
              <span className="ml-2 text-slate-500">
                ±{Math.round(location!.accuracy)}m
              </span>
            )}
          </p>
          <p className="text-xs text-slate-500">
            {hasGPS
              ? `Ultima actualizare: ${formatRO(location!.recorded_at)}`
              : FALLBACK_LABEL}
          </p>
        </div>
      </div>
    </div>
  );
}
