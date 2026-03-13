"use client";

import type { Cane, Location } from "@/types";

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
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm rounded-2xl px-5 py-3.5 shadow-lg min-w-72 max-w-[90vw] z-10">
      <div className="flex items-center justify-between gap-4 mb-1">
        <span className="font-bold text-blue-800 text-base truncate">
          {cane.name || "Baston"}
        </span>
        <span
          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
            isOnline
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-600"
          }`}
        >
          {isOnline ? "● Online" : "● Offline"}
        </span>
      </div>

      {location ? (
        <>
          <p className="text-xs text-gray-400">
            {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            {location.accuracy != null && (
              <span className="ml-2 bg-gray-100 rounded px-1">
                ± {Math.round(location.accuracy)} m
              </span>
            )}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Ultima actualizare: {formatRO(location.recorded_at)}
          </p>
        </>
      ) : (
        <p className="text-xs text-gray-400 italic mt-0.5">
          Locația nu este disponibilă.
        </p>
      )}
    </div>
  );
}
