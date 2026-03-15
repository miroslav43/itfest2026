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

export default function LocationPanel({ cane, location }: Props) {
  const isOnline =
    location != null &&
    Date.now() - new Date(location.recorded_at).getTime() < STALE_MS;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 animate-slide-up">
      <div className="glass rounded-2xl px-6 py-4 min-w-80 max-w-[90vw] shadow-2xl">
        <div className="flex items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-2.5">
            <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? "bg-success-400 animate-pulse-slow" : "bg-danger-400"}`} />
            <span className="font-semibold text-slate-100 text-sm">
              {cane.name || "Baston"}
            </span>
          </div>
          <Badge variant={isOnline ? "success" : "danger"}>
            {isOnline ? "Online" : "Offline"}
          </Badge>
        </div>

        {location ? (
          <div className="flex flex-col gap-1">
            <p className="text-xs text-slate-400 font-mono tabular-nums">
              {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              {location.accuracy != null && (
                <span className="ml-2 text-slate-500">
                  ±{Math.round(location.accuracy)}m
                </span>
              )}
            </p>
            <p className="text-xs text-slate-500">
              Ultima actualizare: {formatRO(location.recorded_at)}
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">
            Locația nu este disponibilă.
          </p>
        )}
      </div>
    </div>
  );
}
