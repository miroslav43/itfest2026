"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { GoogleMap, useJsApiLoader, OverlayView } from "@react-google-maps/api";
import type { Location } from "@/types";
import { Spinner } from "@/components/ui";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

/** Lângă @FABRIKA / Iulius Town, Timișoara — coordonate exacte */
const IULIUS_TOWN: google.maps.LatLngLiteral = { lat: 45.7661228, lng: 21.2294378 };

const LIBRARIES: ("places")[] = ["places"];

const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: true,
};

interface Props {
  location: Location | null;
  caneName?: string;
}

function isMobileDevice(): boolean {
  return typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
}

/** Inject pulse keyframes once into <head> */
function useMapDotStyles() {
  useEffect(() => {
    const id = "cane-map-dot-styles";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      @keyframes cane-dot-pulse {
        0%   { transform: translate(-50%, -50%) scale(1);   opacity: 0.6; }
        70%  { transform: translate(-50%, -50%) scale(2.8); opacity: 0; }
        100% { transform: translate(-50%, -50%) scale(2.8); opacity: 0; }
      }
      @keyframes cane-dot-pulse-offline {
        0%   { transform: translate(-50%, -50%) scale(1);   opacity: 0.3; }
        70%  { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
        100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }, []);
}

interface DotProps {
  isOnline: boolean;
  label: string;
}

/**
 * Custom map pin that mimics the Google Maps "My Location" blue dot.
 * Rendered via OverlayView so it's positioned in lat/lng space.
 */
function LocationDot({ isOnline, label }: DotProps) {
  return (
    <div style={{ position: "relative", transform: "translate(-50%, -50%)" }}>
      {/* Accuracy / pulse ring */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 20,
          height: 20,
          borderRadius: "50%",
          backgroundColor: isOnline ? "#4285F4" : "#93c5fd",
          animation: isOnline
            ? "cane-dot-pulse 2s ease-out infinite"
            : "cane-dot-pulse-offline 3s ease-out infinite",
        }}
      />

      {/* Core dot */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: 20,
          height: 20,
          borderRadius: "50%",
          backgroundColor: isOnline ? "#4285F4" : "#93c5fd",
          border: "3px solid #ffffff",
          boxShadow: "0 2px 10px rgba(66,133,244,0.5)",
          opacity: isOnline ? 1 : 0.7,
        }}
      />

      {/* Label pill */}
      <div
        style={{
          position: "absolute",
          top: "calc(100% + 8px)",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 5,
          backgroundColor: isOnline ? "rgba(17, 24, 39, 0.92)" : "rgba(30, 41, 59, 0.80)",
          backdropFilter: "blur(4px)",
          color: "#f1f5f9",
          fontSize: 12,
          fontWeight: 600,
          fontFamily: "system-ui, sans-serif",
          padding: "4px 10px",
          borderRadius: 20,
          whiteSpace: "nowrap",
          boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.08)",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            backgroundColor: isOnline ? "#22c55e" : "#64748b",
            flexShrink: 0,
            boxShadow: isOnline ? "0 0 6px #22c55e" : "none",
          }}
        />
        {label}
      </div>
    </div>
  );
}

export default function CaneMap({ location, caneName }: Props) {
  useMapDotStyles();

  /** Start at Iulius Town; if on mobile and no cane loc, replace with GPS. */
  const [deviceCenter, setDeviceCenter] =
    useState<google.maps.LatLngLiteral>(IULIUS_TOWN);
  const [usingDeviceGPS, setUsingDeviceGPS] = useState(false);

  useEffect(() => {
    if (!isMobileDevice()) return;
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDeviceCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setUsingDeviceGPS(true);
      },
      () => { /* stay on Iulius Town fallback */ },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 }
    );
  }, []);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: API_KEY,
    libraries: LIBRARIES,
  });

  const onLoad = useCallback((_map: google.maps.Map) => {}, []);

  if (!API_KEY || API_KEY === "your_google_maps_api_key_here") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-surface-50 gap-3">
        <div className="w-12 h-12 rounded-2xl bg-surface-200 border border-white/[0.06] flex items-center justify-center">
          <svg className="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>
        <p className="font-semibold text-slate-300 text-sm">Cheie API Google Maps lipsă</p>
        <p className="text-xs text-slate-500 text-center max-w-xs">
          Adaugă{" "}
          <code className="text-accent-400 bg-accent-500/10 px-1.5 py-0.5 rounded">
            NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
          </code>{" "}
          în{" "}
          <code className="text-accent-400 bg-accent-500/10 px-1.5 py-0.5 rounded">
            frontend/.env.local
          </code>
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-surface-50 text-slate-400 gap-2">
        <p className="font-semibold text-sm">Nu s-a putut încărca harta.</p>
        <p className="text-xs text-slate-500">Verifică cheia API și conexiunea.</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface-50">
        <Spinner size="lg" />
      </div>
    );
  }

  const hasRealGPS = location != null;
  const dotPosition = hasRealGPS
    ? { lat: location!.latitude, lng: location!.longitude }
    : deviceCenter;

  // Label is always "Online" regardless of GPS status
  const dotLabel = `${caneName ?? "Baston"} • Online`;

  const center = hasRealGPS ? dotPosition : deviceCenter;
  const zoom = hasRealGPS ? 16 : usingDeviceGPS ? 15 : 16;

  return (
    <GoogleMap
      mapContainerStyle={{ width: "100%", height: "100%" }}
      center={center}
      zoom={zoom}
      options={MAP_OPTIONS}
      onLoad={onLoad}
    >
      <OverlayView
        position={dotPosition}
        mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
      >
        {/* isOnline=true mereu — label și culoare mereu "live" */}
        <LocationDot isOnline={true} label={dotLabel} />
      </OverlayView>
    </GoogleMap>
  );
}
