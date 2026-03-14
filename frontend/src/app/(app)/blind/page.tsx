"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import { useRouter } from "next/navigation";
import type { Cane, Location, Destination } from "@/types";

const POLL_MS = 3000;
const STALE_MS = 5 * 60 * 1000;

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = "ro-RO";
  utt.rate = 0.95;
  window.speechSynthesis.speak(utt);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ro-RO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function BlindPage() {
  const router = useRouter();
  const [cane, setCane] = useState<Cane | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const wasOnlineRef = useRef(false);

  const isOnline =
    location != null &&
    Date.now() - new Date(location.recorded_at).getTime() < STALE_MS;

  const activeDest = destinations.find((d) => d.active) ?? null;

  // Load cane and destinations
  useEffect(() => {
    api.get<Cane | null>("/blind-users/me/cane").then((c) => {
      setCane(c);
      if (c) speak(`Baston conectat: ${c.name}`);
    }).catch(() => {});

    api.get<Destination[]>("/destinations/mine").then(setDestinations).catch(() => {});
  }, []);

  // Poll location
  const fetchLocation = useCallback(() => {
    if (!cane) return;
    api.get<Location | null>(`/locations/${cane.id}/latest`)
      .then(setLocation)
      .catch(() => {});
  }, [cane]);

  useEffect(() => {
    if (!cane) return;
    fetchLocation();
    const interval = setInterval(fetchLocation, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchLocation, cane]);

  // TTS when status changes
  useEffect(() => {
    if (!cane) return;
    if (wasOnlineRef.current && !isOnline) {
      speak("Atenție! Bastonul a pierdut semnalul GPS.");
    } else if (!wasOnlineRef.current && isOnline) {
      speak("Bastonul este online. Locație actualizată.");
    }
    wasOnlineRef.current = isOnline;
  }, [isOnline, cane]);

  async function handleActivate(id: string, name: string) {
    try {
      const updated = await api.put<Destination>(`/destinations/${id}/activate`, {});
      setDestinations((prev) =>
        prev.map((d) => ({ ...d, active: d.id === updated.id }))
      );
      speak(`Destinație activată: ${name}`);
    } catch { /* ignore */ }
  }

  async function handleDeactivate(id: string) {
    try {
      const updated = await api.put<Destination>(`/destinations/${id}/deactivate`, {});
      setDestinations((prev) =>
        prev.map((d) => (d.id === updated.id ? { ...d, active: false } : d))
      );
      speak("Destinație dezactivată.");
    } catch { /* ignore */ }
  }

  function handleLogout() {
    clearToken();
    router.push("/auth");
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 px-6 py-5 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🦯</span>
          <span className="text-2xl font-bold tracking-tight">Solemtrix</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-gray-400 hover:text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          aria-label="Deconectare"
        >
          Ieșire
        </button>
      </header>

      <main className="flex-1 flex flex-col gap-6 p-6 max-w-2xl mx-auto w-full">

        {/* Status card */}
        <section
          className={`rounded-3xl p-8 text-center transition-colors ${
            isOnline ? "bg-green-800" : "bg-red-900"
          }`}
          aria-live="polite"
        >
          <div className="text-6xl mb-4">{isOnline ? "📶" : "❌"}</div>
          <h1 className="text-4xl font-bold mb-2">
            {cane ? cane.name : "Niciun baston asociat"}
          </h1>
          <p className="text-2xl font-semibold">
            {isOnline ? "ONLINE" : "OFFLINE"}
          </p>
          {location && (
            <p className="text-lg text-white/70 mt-3">
              Ultima actualizare: {formatTime(location.recorded_at)}
            </p>
          )}
        </section>

        {/* Active destination */}
        {activeDest && (
          <section className="bg-blue-800 rounded-3xl p-6">
            <p className="text-sm font-semibold text-blue-200 uppercase tracking-widest mb-2">
              Destinație activă
            </p>
            <p className="text-3xl font-bold">{activeDest.name}</p>
            <p className="text-blue-300 text-lg mt-1">
              {activeDest.latitude.toFixed(5)}, {activeDest.longitude.toFixed(5)}
            </p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => speak(`Destinație activă: ${activeDest.name}`)}
                className="flex-1 py-3 bg-blue-700 hover:bg-blue-600 rounded-2xl text-lg font-bold transition-colors"
                aria-label="Citește destinația"
              >
                🔊 Citește
              </button>
              <button
                onClick={() => handleDeactivate(activeDest.id)}
                className="flex-1 py-3 bg-red-800 hover:bg-red-700 rounded-2xl text-lg font-bold transition-colors"
                aria-label="Oprește destinația activă"
              >
                ✕ Oprește
              </button>
            </div>
          </section>
        )}

        {/* Destinations list — read-only, only activate */}
        <section>
          <h2 className="text-xl font-bold text-gray-200 mb-3">Destinații disponibile</h2>

          {destinations.length === 0 && (
            <p className="text-gray-500 text-lg text-center py-6">
              Aparținătorul tău nu a adăugat încă nicio destinație.
            </p>
          )}

          <ul className="flex flex-col gap-3">
            {destinations.map((dest) => (
              <li
                key={dest.id}
                className={`rounded-2xl p-5 flex items-center justify-between gap-3 ${
                  dest.active ? "bg-blue-900 border-2 border-blue-500" : "bg-gray-800"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xl font-bold truncate">{dest.name}</p>
                  <p className="text-gray-400 text-sm mt-0.5">
                    {dest.latitude.toFixed(5)}, {dest.longitude.toFixed(5)}
                  </p>
                  {dest.active && (
                    <span className="inline-block mt-1 text-xs font-semibold text-blue-300 uppercase tracking-wider">
                      ✓ Activă
                    </span>
                  )}
                </div>
                {dest.active ? (
                  <button
                    onClick={() => handleDeactivate(dest.id)}
                    className="bg-gray-700 hover:bg-red-800 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shrink-0"
                    aria-label={`Dezactivează ${dest.name}`}
                  >
                    ✕ Oprește
                  </button>
                ) : (
                  <button
                    onClick={() => handleActivate(dest.id, dest.name)}
                    className="bg-blue-700 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shrink-0"
                    aria-label={`Activează ${dest.name}`}
                  >
                    ✓ Activează
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Read status button */}
        <button
          onClick={() => {
            const msg = cane
              ? `Bastonul ${cane.name} este ${isOnline ? "online" : "offline"}. ${
                  activeDest ? `Destinație activă: ${activeDest.name}.` : "Nicio destinație activă."
                }`
              : "Niciun baston asociat contului tău.";
            speak(msg);
          }}
          className="w-full py-5 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-3xl text-2xl font-bold transition-colors"
          aria-label="Citește starea curentă"
        >
          🔊 Citește starea curentă
        </button>
      </main>
    </div>
  );
}
