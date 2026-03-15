"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { Button, Input, Card, Logo, Badge, Spinner } from "@/components/ui";
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
        latitude: la, longitude: lo, accuracy: parseFloat(acc) || null, source: "simulator",
      });
      setStatus(`Trimis: ${result.latitude.toFixed(6)}, ${result.longitude.toFixed(6)} — ${new Date(result.recorded_at).toLocaleTimeString("ro-RO")}`);
    } catch (err) {
      setStatus(err instanceof ApiError ? err.detail : "Eroare necunoscută.");
    }
  }

  function handleManual() { sendLocation(parseFloat(lat), parseFloat(lng), accuracy); }

  function useMyLocation() {
    if (!navigator.geolocation) { setStatus("Browserul nu suportă geolocation."); return; }
    setStatus("Se obține locația GPS...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = pos.coords.latitude;
        const lo = pos.coords.longitude;
        const acc = pos.coords.accuracy?.toFixed(1) ?? "5";
        setLat(la.toFixed(7)); setLng(lo.toFixed(7)); setAccuracy(acc);
        sendLocation(la, lo, acc);
      },
      (err) => setStatus(`Nu s-a putut obține locația: ${err.message}`),
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
      setLat(next.lat.toFixed(7)); setLng(next.lng.toFixed(7));
      sendLocation(next.lat, next.lng, accuracy);
    }, 3000);
  }

  async function stopAuto() {
    clearInterval(intervalRef.current!);
    intervalRef.current = null;
    setAutoRunning(false);
    setStatus("Simulare oprită...");
    if (selectedId) {
      try {
        await api.delete(`/locations/${selectedId}/clear`);
        setStatus("Simulare oprită — pinul a fost șters de pe hartă.");
      } catch { setStatus("Simulare oprită."); }
    }
  }

  return (
    <div className="min-h-screen bg-surface-0 pb-10">
      {/* Live banner */}
      {autoRunning && (
        <div className="sticky top-0 z-50 bg-danger-500 text-white px-6 py-3.5 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
            </span>
            <span className="font-semibold text-sm">Simulare activă — locație trimisă la fiecare 3s</span>
          </div>
          <Button size="sm" variant="ghost" onClick={stopAuto} className="!text-white !hover:bg-white/20">
            Oprește
          </Button>
        </div>
      )}

      <div className="max-w-lg mx-auto px-6 pt-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-accent-400 transition-colors mb-6">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Înapoi la hartă
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <Logo size="sm" />
          <div className="h-5 w-px bg-white/[0.08]" />
          <h1 className="text-xl font-bold text-slate-100">Simulator GPS</h1>
          {autoRunning && <Badge variant="danger">LIVE</Badge>}
        </div>
        <p className="text-slate-500 text-sm mb-8 leading-relaxed">
          Simulează datele GPS trimise de hardware. API-ul rămâne identic la integrarea cu dispozitivul real.
        </p>

        <Card className="p-6 flex flex-col gap-5 mb-5">
          {/* Cane selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Baston țintă</label>
            <select
              className="w-full px-4 py-2.5 bg-surface-200 border border-white/[0.06] rounded-xl text-sm text-slate-100 outline-none transition-all focus:border-accent-500/50 focus:ring-2 focus:ring-accent-500/20 cursor-pointer"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {canes.length === 0 && <option value="">Niciun baston disponibil</option>}
              {canes.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
              ))}
            </select>
          </div>

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Latitudine" type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} />
            <Input label="Longitudine" type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} />
          </div>

          <Input label="Precizie GPS (metri)" type="number" value={accuracy} onChange={(e) => setAccuracy(e.target.value)} />

          {/* My location */}
          <Button variant="success" size="lg" className="w-full" onClick={useMyLocation} disabled={autoRunning}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            Folosește locația mea actuală
          </Button>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button size="lg" onClick={handleManual} disabled={autoRunning}>
              Trimite manual
            </Button>
            {autoRunning ? (
              <Button size="lg" variant="danger" onClick={stopAuto}>
                <Spinner size="sm" /> Oprește
              </Button>
            ) : (
              <Button size="lg" variant="secondary" onClick={startAuto}>
                Simulare auto (3s)
              </Button>
            )}
          </div>

          {/* Status */}
          {status && (
            <div className="px-4 py-3 bg-surface-200 border border-white/[0.06] rounded-xl text-sm text-slate-300 font-mono animate-fade-in">
              {status}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <p className="text-sm text-slate-400 leading-relaxed">
            <strong className="text-slate-300">Integrare hardware:</strong> Dispozitivul real va apela{" "}
            <code className="text-accent-400 bg-accent-500/10 px-1.5 py-0.5 rounded text-xs font-mono">
              POST /locations/{"{cane_id}"}/update
            </code>{" "}
            cu același format JSON.
          </p>
        </Card>
      </div>
    </div>
  );
}
