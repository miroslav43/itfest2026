"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import type { Cane, Location } from "@/types";

function randomWalk(lat: number, lng: number, stepM = 8): { lat: number; lng: number } {
  const deg = stepM / 111320;
  return {
    lat: lat + (Math.random() - 0.5) * 2 * deg,
    lng: lng + (Math.random() - 0.5) * 2 * deg,
  };
}

export default function SimulatorPage() {
  const [canes, setCanes] = useState<Cane[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [lat, setLat] = useState("44.4268");
  const [lng, setLng] = useState("26.1025");
  const [accuracy, setAccuracy] = useState("5");
  const [status, setStatus] = useState("");
  const [autoRunning, setAutoRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const posRef = useRef({ lat: 44.4268, lng: 26.1025 });

  useEffect(() => {
    api.get<Cane[]>("/canes/").then((data) => {
      setCanes(data);
      if (data.length > 0) setSelectedId(data[0].id);
    }).catch(() => {});
    return () => clearInterval(intervalRef.current!);
  }, []);

  async function sendLocation(la: number, lo: number, acc: string) {
    if (!selectedId) return setStatus("Selectează un baston mai întâi.");
    try {
      const result = await api.post<Location>(`/locations/${selectedId}/update`, {
        latitude: la,
        longitude: lo,
        accuracy: parseFloat(acc) || null,
        source: "simulator",
      });
      setStatus(
        `✅ Trimis: ${result.latitude.toFixed(6)}, ${result.longitude.toFixed(6)} — ${new Date(result.recorded_at).toLocaleTimeString("ro-RO")}`
      );
    } catch (err) {
      setStatus(`❌ ${err instanceof ApiError ? err.detail : "Eroare necunoscută."}`);
    }
  }

  function handleManual() {
    sendLocation(parseFloat(lat), parseFloat(lng), accuracy);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setStatus("❌ Browserul tău nu suportă geolocation.");
      return;
    }
    setStatus("📡 Se obține locația GPS...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = pos.coords.latitude;
        const lo = pos.coords.longitude;
        const acc = pos.coords.accuracy?.toFixed(1) ?? "5";
        setLat(la.toFixed(7));
        setLng(lo.toFixed(7));
        setAccuracy(acc);
        sendLocation(la, lo, acc);
      },
      (err) => {
        setStatus(`❌ Nu s-a putut obține locația: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function startAuto() {
    if (intervalRef.current) return;
    posRef.current = { lat: parseFloat(lat) || 44.4268, lng: parseFloat(lng) || 26.1025 };
    setAutoRunning(true);
    intervalRef.current = setInterval(() => {
      const next = randomWalk(posRef.current.lat, posRef.current.lng);
      posRef.current = next;
      setLat(next.lat.toFixed(7));
      setLng(next.lng.toFixed(7));
      sendLocation(next.lat, next.lng, accuracy);
    }, 3000);
  }

  async function stopAuto() {
    clearInterval(intervalRef.current!);
    intervalRef.current = null;
    setAutoRunning(false);
    setStatus("Simulare oprită. Se șterge locația de pe hartă…");

    if (selectedId) {
      try {
        await api.delete(`/locations/${selectedId}/clear`);
        setStatus("⏹ Simulare oprită — pinul a fost șters de pe hartă.");
      } catch {
        setStatus("⏹ Simulare oprită. (locația veche rămâne până la următorul update)");
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">

      {/* ── Sticky banner când simularea e activă ── */}
      {autoRunning && (
        <div className="sticky top-0 z-50 bg-red-500 text-white px-4 py-3 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
            </span>
            <span className="font-semibold text-sm">
              Simulare activă — se trimite locație la fiecare 3s
            </span>
          </div>
          <button
            onClick={stopAuto}
            className="bg-white text-red-600 font-bold px-4 py-1.5 rounded-lg text-sm hover:bg-red-50 transition-colors"
          >
            ⏹ Oprește
          </button>
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 pt-8">
        <Link href="/" className="inline-block text-sm text-blue-600 hover:underline mb-4">
          ← Înapoi la hartă
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">🛠 Simulator locație</h1>
        <p className="text-gray-500 text-sm mb-6 leading-relaxed">
          Simulează datele GPS care vor fi trimise de telefonul/bastonul real în backend.
          Schema API rămâne identică când se înlocuiește cu dispozitivul real.
        </p>

        <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col gap-4 mb-4">
          {/* Cane selector */}
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Baston țintă
            <select
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 bg-white"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {canes.length === 0 && (
                <option value="">Niciun baston — adaugă din pagina principală</option>
              )}
              {canes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.id})
                </option>
              ))}
            </select>
          </label>

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Latitudine
              <input
                type="number"
                step="any"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Longitudine
              <input
                type="number"
                step="any"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
              />
            </label>
          </div>

          {/* Accuracy */}
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Precizie GPS (metri)
            <input
              type="number"
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500"
              value={accuracy}
              onChange={(e) => setAccuracy(e.target.value)}
            />
          </label>

          {/* Current location */}
          <button
            onClick={useMyLocation}
            disabled={autoRunning}
            className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            📍 Folosește locația mea actuală
          </button>

          {/* Actions */}
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleManual}
              disabled={autoRunning}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold rounded-lg text-sm transition-colors min-w-32"
            >
              Trimite manual
            </button>
            {autoRunning ? (
              <button
                onClick={stopAuto}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg text-sm transition-colors min-w-32 flex items-center justify-center gap-2"
              >
                <span className="animate-pulse">⏹</span> Oprește simulare
              </button>
            ) : (
              <button
                onClick={startAuto}
                className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg text-sm transition-colors min-w-32"
              >
                ▶ Simulare auto (3s)
              </button>
            )}
          </div>

          {status && (
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-mono">
              {status}
            </div>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800 leading-relaxed">
          <strong>Notă de integrare:</strong> Când bastonul sau telefonul real trimite
          locația, va apela{" "}
          <code className="bg-blue-100 px-1 rounded">
            POST /locations/{"{cane_id}"}/update
          </code>{" "}
          cu același format JSON. Nicio modificare la front-end nu este necesară.
        </div>
      </div>
    </div>
  );
}
