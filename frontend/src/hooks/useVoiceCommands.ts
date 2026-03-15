"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Destination } from "@/types";

// Web Speech API types — not included in default TS libs
interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}
interface ISpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
declare global {
  interface Window {
    SpeechRecognition: { new(): ISpeechRecognition };
    webkitSpeechRecognition: { new(): ISpeechRecognition };
  }
}

export type VoiceCommandAction =
  | { type: "activate"; destination: Destination }
  | { type: "deactivate" }
  | { type: "read_status" }
  | { type: "unknown"; transcript: string };

interface UseVoiceCommandsOptions {
  destinations: Destination[];
  onActivate: (id: string, name: string) => void;
  onDeactivate: (id: string, name: string) => void;
  onReadStatus: () => void;
  /** Called with TTS text so the page's speak() can be reused. */
  speak: (text: string) => void;
}

export interface VoiceCommandsState {
  /** True when Porcupine is running and listening for the wake word. */
  isWakeWordActive: boolean;
  /** True during the 5-second window after the wake word is detected. */
  isListening: boolean;
  /** The last recognised command transcript. */
  lastTranscript: string | null;
  /** Error initialising Porcupine (e.g. missing access key). */
  initError: string | null;
  /** Manually trigger the command-listening window (same as wake word detection). */
  startListening: () => void;
}

// ── Fuzzy-match a query against destination names ────────────────────────────
function normalise(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

function findDestination(query: string, destinations: Destination[]): Destination | null {
  const q = normalise(query);
  // Exact match
  const exact = destinations.find((d) => normalise(d.name) === q);
  if (exact) return exact;
  // Substring match
  const sub = destinations.find((d) => q.includes(normalise(d.name)) || normalise(d.name).includes(q));
  if (sub) return sub;
  // Token overlap
  const qTokens = new Set(q.split(" ").filter(Boolean));
  let best: Destination | null = null;
  let bestScore = 0;
  for (const d of destinations) {
    const dTokens = normalise(d.name).split(" ").filter(Boolean);
    const overlap = dTokens.filter((t) => qTokens.has(t)).length;
    if (overlap > bestScore) { bestScore = overlap; best = d; }
  }
  return bestScore > 0 ? best : null;
}

// ── Command parser ────────────────────────────────────────────────────────────
const ACTIVATE_RE = /(?:vreau\s+s[aă]\s+merg\s+(?:la\s+)?|du[- ]m[aă]\s+la\s+|mergi?\s+(?:la\s+)?)(.+)/i;
const DEACTIVATE_RE = /opre[sș]te|anuleaz[aă]\s+navigar/i;
const STATUS_RE = /unde\s+sunt|stare|ce\s+se\s+[iî]nt[aâ]mpl/i;

function parseCommand(
  transcript: string,
  destinations: Destination[],
): VoiceCommandAction {
  const t = transcript.trim();
  if (DEACTIVATE_RE.test(t)) return { type: "deactivate" };
  if (STATUS_RE.test(t)) return { type: "read_status" };
  const m = t.match(ACTIVATE_RE);
  if (m) {
    const destName = m[1].trim();
    const dest = findDestination(destName, destinations);
    if (dest) return { type: "activate", destination: dest };
  }
  return { type: "unknown", transcript: t };
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useVoiceCommands({
  destinations,
  onActivate,
  onDeactivate,
  onReadStatus,
  speak,
}: UseVoiceCommandsOptions): VoiceCommandsState {
  const [isWakeWordActive, setIsWakeWordActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  const porcupineRef = useRef<import("@picovoice/porcupine-web").PorcupineWorker | null>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const listenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destinationsRef = useRef(destinations);
  const callbacksRef = useRef({ onActivate, onDeactivate, onReadStatus, speak });

  // Keep refs fresh so event handlers always see the latest values
  useEffect(() => { destinationsRef.current = destinations; }, [destinations]);
  useEffect(() => { callbacksRef.current = { onActivate, onDeactivate, onReadStatus, speak }; }, [onActivate, onDeactivate, onReadStatus, speak]);

  // ── Start the 5-second speech recognition window ──────────────────────────
  const startListening = useCallback(() => {
    if (listenTimerRef.current) clearTimeout(listenTimerRef.current);

    const SpeechRecognitionCtor =
      typeof window !== "undefined"
        ? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
        : null;

    if (!SpeechRecognitionCtor) {
      callbacksRef.current.speak("Recunoașterea vocală nu este suportată de browser.");
      return;
    }

    callbacksRef.current.speak("Te ascult.");
    setIsListening(true);

    const rec: ISpeechRecognition = new SpeechRecognitionCtor();
    rec.lang = "ro-RO";
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    recognitionRef.current = rec;

    rec.onresult = (ev: SpeechRecognitionEvent) => {
      const transcript = ev.results[0][0].transcript;
      setLastTranscript(transcript);

      const action = parseCommand(transcript, destinationsRef.current);
      const { onActivate: activate, onDeactivate: deactivate, onReadStatus: readStatus, speak: tts } = callbacksRef.current;

      switch (action.type) {
        case "activate":
          tts(`Navighez spre ${action.destination.name}.`);
          activate(action.destination.id, action.destination.name);
          break;
        case "deactivate": {
          const active = destinationsRef.current.find((d) => d.active);
          if (active) {
            tts(`Opresc navigarea spre ${active.name}.`);
            deactivate(active.id, active.name);
          } else {
            tts("Nu există nicio navigare activă.");
          }
          break;
        }
        case "read_status":
          readStatus();
          break;
        case "unknown":
          tts(`Nu am înțeles "${transcript}". Spune "Alexa, vreau să merg la" urmat de destinație.`);
          break;
      }
    };

    rec.onerror = () => {
      callbacksRef.current.speak("Nu am putut recunoaște comanda. Încearcă din nou.");
    };

    rec.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    rec.start();

    // Auto-stop after 8 seconds
    listenTimerRef.current = setTimeout(() => {
      rec.stop();
    }, 8000);
  }, []);

  // ── Porcupine initialisation ───────────────────────────────────────────────
  useEffect(() => {
    const accessKey = process.env.NEXT_PUBLIC_PICOVOICE_ACCESS_KEY;
    if (!accessKey || accessKey === "your_picovoice_access_key_here") {
      setInitError("NEXT_PUBLIC_PICOVOICE_ACCESS_KEY nu este configurată. Obține o cheie gratuită de pe console.picovoice.ai");
      return;
    }

    let cancelled = false;

    async function init() {
      try {
        const { PorcupineWorker, BuiltInKeyword } = await import("@picovoice/porcupine-web");
        const { WebVoiceProcessor } = await import("@picovoice/web-voice-processor");

        const worker = await PorcupineWorker.create(
          accessKey!,
          { builtin: BuiltInKeyword.Alexa, sensitivity: 0.5 },
          (detection) => {
            if (detection.label === BuiltInKeyword.Alexa) {
              startListening();
            }
          },
          // Model file served from /public — copy porcupine_params.pv there
          { publicPath: "/porcupine_params.pv", forceWrite: false },
        );

        if (cancelled) { worker.terminate(); return; }

        porcupineRef.current = worker;
        await WebVoiceProcessor.subscribe(worker);
        setIsWakeWordActive(true);
      } catch (err) {
        if (!cancelled) {
          setInitError(String(err));
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      if (porcupineRef.current) {
        import("@picovoice/web-voice-processor").then(({ WebVoiceProcessor }) => {
          WebVoiceProcessor.unsubscribe(porcupineRef.current!);
          porcupineRef.current!.terminate();
          porcupineRef.current = null;
        });
      }
      setIsWakeWordActive(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isWakeWordActive, isListening, lastTranscript, initError, startListening };
}
