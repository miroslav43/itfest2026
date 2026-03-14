"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, ApiError } from "@/lib/api";
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
  const [showAddDest, setShowAddDest] = useState(false);
  const [destName, setDestName] = useState("");
  const [destLat, setDestLat] = useState("");
  const [destLng, setDestLng] = useState("");
  const [destError, setDestError] = useState("");
  const [loadingDest, setLoadingDest] = useState(false);
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

    api.get<Destination[]>("/destinations/").then(setDestinations).catch(() => {});
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

  async function handleAddDestination(e: React.FormEvent) {
    e.preventDefault();
    setDestError("");
    if (!cane) return;
    setLoadingDest(true);
    try {
      const dest = await api.post<Destination>("/destinations/", {
        name: destName,
        latitude: parseFloat(destLat),
        longitude: parseFloat(destLng),
        cane_id: cane.id,
      });
      setDestinations((prev) => [dest, ...prev]);
      setDestName(""); setDestLat(""); setDestLng("");
      setShowAddDest(false);
      speak(`Destinație adăugată: ${dest.name}`);
    } catch (err) {
      setDestError(err instanceof ApiError ? err.detail : "Eroare.");
    } finally {
      setLoadingDest(false);
    }
  }

  async function handleActivate(id: string, name: string) {
    try {
      const updated = await api.put<Destination>(`/destinations/${id}/activate`, {});
      setDestinations((prev) =>
        prev.map((d) => ({ ...d, active: d.id === updated.id }))
      );
      speak(`Destinație activată: ${name}`);
    } catch { /* ignore */ }
  }

  async function handleDeleteDest(id: string) {
    try {
      await api.delete(`/destinations/${id}`);
      setDestinations((prev) => prev.filter((d) => d.id !== id));
      speak("Destinație ștearsă.");
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
            <button
              onClick={() => speak(`Destinație activă: ${activeDest.name}`)}
              className="mt-4 w-full py-3 bg-blue-700 hover:bg-blue-600 rounded-2xl text-lg font-bold transition-colors"
              aria-label="Citește destinația"
            >
              🔊 Citește destinația
            </button>
          </section>
        )}

        {/* Destinations list */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-gray-200">Destinații</h2>
            <button
              onClick={() => { setShowAddDest(!showAddDest); speak("Adaugă destinație nouă"); }}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2.5 rounded-2xl text-lg transition-colors"
              aria-label="Adaugă destinație"
            >
              + Adaugă
            </button>
          </div>

          {/* Add form */}
          {showAddDest && (
            <form onSubmit={handleAddDestination} className="bg-gray-800 rounded-2xl p-5 mb-4 flex flex-col gap-3">
              {destError && (
                <p className="text-red-400 text-sm">{destError}</p>
              )}
              <label className="flex flex-col gap-1 text-gray-300 text-base font-medium">
                Nume destinație
                <input
                  type="text"
                  className="bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white text-lg outline-none focus:border-blue-400"
                  value={destName}
                  onChange={(e) => setDestName(e.target.value)}
                  placeholder="ex: Acasă, Spital"
                  required
                  autoFocus
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-gray-300 text-base font-medium">
                  Latitudine
                  <input
                    type="number"
                    step="any"
                    className="bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white text-lg outline-none focus:border-blue-400"
                    value={destLat}
                    onChange={(e) => setDestLat(e.target.value)}
                    placeholder="44.4268"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-gray-300 text-base font-medium">
                  Longitudine
                  <input
                    type="number"
                    step="any"
                    className="bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white text-lg outline-none focus:border-blue-400"
                    value={destLng}
                    onChange={(e) => setDestLng(e.target.value)}
                    placeholder="26.1025"
                    required
                  />
                </label>
              </div>
              <button
                onClick={() => {
                  if (navigator.geolocation) {
                    speak("Se obține locația curentă");
                    navigator.geolocation.getCurrentPosition((pos) => {
                      setDestLat(pos.coords.latitude.toFixed(7));
                      setDestLng(pos.coords.longitude.toFixed(7));
                    });
                  }
                }}
                type="button"
                className="py-3 bg-gray-700 hover:bg-gray-600 rounded-xl text-gray-200 text-base font-medium transition-colors"
              >
                📍 Folosește locația mea actuală
              </button>
              <button
                type="submit"
                disabled={loadingDest}
                className="py-4 bg-green-700 hover:bg-green-600 disabled:opacity-50 rounded-2xl text-xl font-bold transition-colors"
              >
                {loadingDest ? "Se salvează…" : "Salvează destinație"}
              </button>
            </form>
          )}

          {destinations.length === 0 && !showAddDest && (
            <p className="text-gray-500 text-lg text-center py-6">
              Nu ai nicio destinație salvată.
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
                </div>
                <div className="flex gap-2 shrink-0">
                  {!dest.active && (
                    <button
                      onClick={() => handleActivate(dest.id, dest.name)}
                      className="bg-blue-700 hover:bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-semibold transition-colors"
                      aria-label={`Activează ${dest.name}`}
                    >
                      ✓ Activează
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteDest(dest.id)}
                    className="bg-gray-700 hover:bg-red-700 text-gray-300 hover:text-white px-3 py-2 rounded-xl text-sm transition-colors"
                    aria-label={`Șterge ${dest.name}`}
                  >
                    ✕
                  </button>
                </div>
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
