"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";
import { useRouter } from "next/navigation";
import type { Cane, Location, Destination } from "@/types";
import { useVoiceCommands } from "@/hooks/useVoiceCommands";
import { hapticMedium, hapticHeavy } from "@/lib/haptics";

// BlindMap is client-only (Google Maps cannot SSR)
const BlindMap = dynamic(() => import("@/components/BlindMap"), { ssr: false });

const POLL_MS = 3000;
const PENDING_TIMEOUT_MS = 15000;
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

// ── Audio queue ───────────────────────────────────────────────────────────────
let audioQueue: string[] = [];
let isPlaying = false;

async function playNext() {
  if (isPlaying || audioQueue.length === 0) return;
  const text = audioQueue.shift()!;
  isPlaying = true;
  try {
    const token = getToken();
    const res = await fetch(`${API_URL}/tts/speak`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error("TTS error");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => { URL.revokeObjectURL(url); isPlaying = false; playNext(); };
    audio.onerror = () => { isPlaying = false; playNext(); };
    audio.play();
  } catch {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = "ro-RO";
      utt.rate = 0.95;
      utt.onend = () => { isPlaying = false; playNext(); };
      window.speechSynthesis.speak(utt);
    } else {
      isPlaying = false;
      playNext();
    }
  }
}

function speak(text: string) { audioQueue.push(text); playNext(); }
function speakNow(text: string) { audioQueue = [text]; isPlaying = false; playNext(); }

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ro-RO", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

interface PendingAction {
  id: string;
  label: string;
  action: () => void;
}

export default function BlindPage() {
  const router = useRouter();
  const [cane, setCane] = useState<Cane | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fix TTS loop — announce only on real state changes ────────────────────
  const initializedRef = useRef(false);
  const lastAnnouncedStateRef = useRef<"online" | "offline" | null>(null);

  // Cane is considered online whenever it's associated with this account
  const isOnline = cane != null;

  const activeDest = destinations.find((d) => d.active) ?? null;

  // ── Actions ───────────────────────────────────────────────────────────────
  function tap(id: string, announceText: string, action: () => void) {
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    if (pending?.id === id) {
      // Second tap — confirm action with a strong haptic pulse
      hapticHeavy();
      setPending(null);
      action();
    } else {
      // First tap — light haptic to acknowledge
      hapticMedium();
      speakNow(`${announceText}. Apasă din nou pentru a confirma.`);
      setPending({ id, label: announceText, action });
      pendingTimerRef.current = setTimeout(() => {
        setPending(null);
        speakNow("Anulat.");
      }, PENDING_TIMEOUT_MS);
    }
  }

  async function doActivate(id: string, name: string) {
    try {
      const updated = await api.put<Destination>(`/destinations/${id}/activate`, {});
      setDestinations((prev) => prev.map((d) => ({ ...d, active: d.id === updated.id })));
      speakNow(`Destinație activată: ${name}`);
    } catch { /* ignore */ }
  }

  async function doDeactivate(id: string, name: string) {
    try {
      await api.put<Destination>(`/destinations/${id}/deactivate`, {});
      setDestinations((prev) => prev.map((d) => (d.id === id ? { ...d, active: false } : d)));
      speakNow(`Destinație dezactivată: ${name}`);
    } catch { /* ignore */ }
  }

  function doLogout() { clearToken(); router.push("/auth"); }

  function doReadStatus() {
    const msg = cane
      ? `Bastonul ${cane.name} este ${isOnline ? "online" : "offline"}. ${
          activeDest ? `Destinație activă: ${activeDest.name}.` : "Nicio destinație activă."
        }`
      : "Niciun baston asociat contului tău.";
    speakNow(msg);
  }

  function isPending(id: string) { return pending?.id === id; }

  // ── Load cane + destinations on mount ────────────────────────────────────
  useEffect(() => {
    api.get<Cane | null>("/blind-users/me/cane").then(setCane).catch(() => {});
    api.get<Destination[]>("/destinations/mine").then(setDestinations).catch(() => {});
  }, []);

  // ── Poll location ─────────────────────────────────────────────────────────
  const fetchLocation = useCallback(() => {
    if (!cane) return;
    api.get<Location | null>(`/locations/${cane.id}/latest`)
      .then(setLocation).catch(() => {});
  }, [cane]);

  useEffect(() => {
    if (!cane) return;
    fetchLocation();
    const interval = setInterval(fetchLocation, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchLocation, cane]);

  // ── TTS: announce only on first load and real transitions ─────────────────
  useEffect(() => {
    if (!cane) return;
    const currentState = isOnline ? "online" : "offline";

    if (!initializedRef.current) {
      // Single announcement after data is first available
      initializedRef.current = true;
      lastAnnouncedStateRef.current = currentState;
      if (isOnline) speak("Bastonul este online.");
      else speak("Bastonul este offline. Verifică conexiunea.");
      return;
    }

    // Only speak when the state actually transitions
    if (currentState !== lastAnnouncedStateRef.current) {
      lastAnnouncedStateRef.current = currentState;
      if (!isOnline) speak("Atenție! Bastonul a pierdut semnalul GPS.");
      else speak("Bastonul s-a reconectat.");
    }
  }, [isOnline, cane]);

  // ── Voice commands hook ───────────────────────────────────────────────────
  const { isWakeWordActive, isListening, initError, startListening } = useVoiceCommands({
    destinations,
    onActivate: doActivate,
    onDeactivate: doDeactivate,
    onReadStatus: doReadStatus,
    speak: speakNow,
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface-0 text-white flex flex-col">
      {/* Header */}
      <header className="bg-surface-50 px-6 py-5 flex items-center justify-between border-b border-white/[0.06]" role="banner">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-accent-500/15 border border-accent-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-accent-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2v20M8 6l4-4 4 4" />
            </svg>
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-100">Solemtrix</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Mic button — wake word indicator or manual trigger */}
          <button
            onClick={startListening}
            title={
              initError
                ? `Voce indisponibilă: ${initError}`
                : isListening
                ? "Ascult comanda..."
                : isWakeWordActive
                ? "Spune «Alexa» pentru a activa"
                : "Apasă pentru comenzi vocale"
            }
            aria-label={isListening ? "Ascult comanda vocală" : "Activează comenzi vocale"}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center border transition-all duration-200
              ${initError
                ? "border-danger-500/30 text-danger-400 bg-danger-500/10"
                : isListening
                ? "border-accent-400/60 text-accent-300 bg-accent-500/20 animate-pulse"
                : isWakeWordActive
                ? "border-success-500/30 text-success-400 bg-success-500/10"
                : "border-white/[0.08] text-slate-400 bg-white/[0.04] hover:bg-white/[0.08]"
              }`}
          >
            {isListening ? (
              /* Waveform icon while listening */
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 1v22M8 5v14M16 5v14M4 9v6M20 9v6" />
              </svg>
            ) : (
              /* Mic icon */
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10a7 7 0 0014 0M12 19v3M8 22h8" />
              </svg>
            )}
          </button>

          <button
            onClick={() => tap("logout", "Ieșire din aplicație", doLogout)}
            className={`text-sm font-semibold px-5 py-3 rounded-2xl transition-all duration-200
              ${isPending("logout")
                ? "bg-warning-500 text-surface-0 ring-4 ring-warning-400/40 scale-95"
                : "text-slate-400 hover:text-white hover:bg-white/[0.06]"
              }`}
            aria-label="Deconectare"
          >
            Ieșire
          </button>
        </div>
      </header>

      {/* Pending confirmation toast */}
      {pending && (
        <div
          className="mx-4 mt-4 px-6 py-4 bg-warning-500 text-surface-0 rounded-2xl text-center font-bold text-lg animate-fade-in shadow-lg"
          role="alert"
          aria-live="assertive"
        >
          Apasă din nou: {pending.label}
        </div>
      )}

      {/* Voice listening overlay */}
      {isListening && (
        <div
          className="mx-4 mt-4 px-6 py-4 bg-accent-500/20 border border-accent-500/30 text-accent-300 rounded-2xl text-center font-semibold text-base animate-fade-in"
          role="status"
          aria-live="polite"
        >
          Ascult... Spune comanda ta.
        </div>
      )}

      <main className="flex-1 flex flex-col gap-5 p-5 max-w-2xl mx-auto w-full" role="main">

        {/* Status card */}
        <section
          className={`rounded-3xl p-8 text-center transition-all duration-300 border-2 ${
            isOnline
              ? "bg-success-50 border-success-500/30"
              : "bg-danger-50 border-danger-500/30"
          }`}
          aria-live="polite"
          role="status"
        >
          <div className={`w-20 h-20 mx-auto mb-5 rounded-full flex items-center justify-center ${
            isOnline ? "bg-success-500/20" : "bg-danger-500/20"
          }`}>
            {isOnline ? (
              <svg className="w-10 h-10 text-success-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M5 12.55a11 11 0 0114.08 0M8.53 16.11a6 6 0 016.95 0M12 20h.01" />
              </svg>
            ) : (
              <svg className="w-10 h-10 text-danger-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            )}
          </div>
          <h1 className="text-4xl font-extrabold mb-2 text-slate-100">
            {cane ? cane.name : "Niciun baston asociat"}
          </h1>
          <p className={`text-2xl font-bold tracking-wider ${isOnline ? "text-success-400" : "text-danger-400"}`}>
            {isOnline ? "ONLINE" : "OFFLINE"}
          </p>
          {location && (
            <p className="text-base text-slate-500 mt-3">
              Ultima actualizare: {formatTime(location.recorded_at)}
            </p>
          )}
        </section>

        {/* Map — always shown (compact 256px strip) */}
        <section aria-label="Hartă navigare">
          <BlindMap
            location={location}
            activeDest={activeDest}
            caneName={cane?.name}
            isOnline={isOnline}
            onRouteCalculated={speak}
          />
        </section>

        {/* Active destination hero */}
        {activeDest && (
          <section className="bg-accent-500/10 border-2 border-accent-500/25 rounded-3xl p-6" aria-label="Destinație activă">
            <p className="text-xs font-bold text-accent-300 uppercase tracking-[0.2em] mb-2">
              Destinație activă
            </p>
            <p className="text-3xl font-extrabold text-slate-100">{activeDest.name}</p>
            <p className="text-accent-300/60 text-base mt-1 font-mono tabular-nums">
              {activeDest.latitude.toFixed(5)}, {activeDest.longitude.toFixed(5)}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => tap("read-active", `Citire: ${activeDest.name}`, () => speakNow(`Destinație activă: ${activeDest.name}`))}
                className={`py-5 rounded-2xl text-lg font-bold transition-all duration-200
                  ${isPending("read-active")
                    ? "bg-warning-500 text-surface-0 ring-4 ring-warning-400/40 scale-95"
                    : "bg-accent-500/20 hover:bg-accent-500/30 text-accent-300 border border-accent-500/20"
                  }`}
                aria-label="Citește destinația activă"
              >
                Citește
              </button>
              <button
                onClick={() => tap("deactivate-active", `Oprire: ${activeDest.name}`, () => doDeactivate(activeDest.id, activeDest.name))}
                className={`py-5 rounded-2xl text-lg font-bold transition-all duration-200
                  ${isPending("deactivate-active")
                    ? "bg-warning-500 text-surface-0 ring-4 ring-warning-400/40 scale-95"
                    : "bg-danger-500/15 hover:bg-danger-500/25 text-danger-400 border border-danger-500/20"
                  }`}
                aria-label="Oprește destinația activă"
              >
                Oprește
              </button>
            </div>
          </section>
        )}

        {/* Destinations list */}
        <section aria-label="Lista destinații">
          <h2 className="text-lg font-bold text-slate-300 mb-3 px-1">Destinații disponibile</h2>

          {destinations.length === 0 && (
            <div className="text-center py-10 text-slate-600 text-lg">
              Aparținătorul tău nu a adăugat încă destinații.
            </div>
          )}

          <ul className="flex flex-col gap-2">
            {destinations.map((dest) => (
              <li
                key={dest.id}
                className={`rounded-2xl p-5 flex items-center justify-between gap-4 transition-all border-2 ${
                  dest.active
                    ? "bg-accent-500/8 border-accent-500/25"
                    : "bg-surface-100 border-white/[0.06] hover:border-white/[0.1]"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xl font-bold truncate text-slate-100">{dest.name}</p>
                  <p className="text-slate-500 text-sm mt-0.5 font-mono tabular-nums">
                    {dest.latitude.toFixed(5)}, {dest.longitude.toFixed(5)}
                  </p>
                  {dest.active && (
                    <span className="inline-block mt-1.5 text-xs font-bold text-accent-300 uppercase tracking-wider">
                      Activă
                    </span>
                  )}
                </div>
                {dest.active ? (
                  <button
                    onClick={() => tap(`deact-${dest.id}`, `Oprire: ${dest.name}`, () => doDeactivate(dest.id, dest.name))}
                    className={`px-5 py-3.5 rounded-xl text-sm font-bold transition-all shrink-0
                      ${isPending(`deact-${dest.id}`)
                        ? "bg-warning-500 text-surface-0 ring-4 ring-warning-400/40 scale-95"
                        : "bg-danger-500/15 hover:bg-danger-500/25 text-danger-400 border border-danger-500/20"
                      }`}
                    aria-label={`Dezactivează ${dest.name}`}
                  >
                    Oprește
                  </button>
                ) : (
                  <button
                    onClick={() => tap(`act-${dest.id}`, `Activare: ${dest.name}`, () => doActivate(dest.id, dest.name))}
                    className={`px-5 py-3.5 rounded-xl text-sm font-bold transition-all shrink-0
                      ${isPending(`act-${dest.id}`)
                        ? "bg-warning-500 text-surface-0 ring-4 ring-warning-400/40 scale-95"
                        : "bg-accent-500/15 hover:bg-accent-500/25 text-accent-300 border border-accent-500/20"
                      }`}
                    aria-label={`Activează ${dest.name}`}
                  >
                    Activează
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Read status */}
        <button
          onClick={() => tap("read-status", "Citire stare curentă", doReadStatus)}
          className={`w-full py-6 rounded-3xl text-xl font-bold transition-all duration-200
            ${isPending("read-status")
              ? "bg-warning-500 text-surface-0 ring-4 ring-warning-400/40 scale-[0.98]"
              : "bg-surface-100 hover:bg-surface-200 border-2 border-white/[0.06] hover:border-white/[0.1] text-slate-200"
            }`}
          aria-label="Citește starea curentă"
        >
          Citește starea curentă
        </button>

        {/* Voice commands hint */}
        <div className="px-4 pb-4 text-center">
          {initError ? (
            <p className="text-xs text-danger-400/70">
              Comenzi vocale inactive: {initError}
            </p>
          ) : (
            <p className="text-xs text-slate-600">
              {isWakeWordActive
                ? "Spune «Alexa, vreau să merg la [destinație]» sau apasă microfon."
                : "Configurează NEXT_PUBLIC_PICOVOICE_ACCESS_KEY pentru wake word."}
            </p>
          )}
        </div>

      </main>
    </div>
  );
}
