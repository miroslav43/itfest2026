"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  OverlayView,
  DirectionsRenderer,
} from "@react-google-maps/api";
import type { Location, Destination } from "@/types";
import { Spinner } from "@/components/ui";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

/** Libraries needed for Directions */
const LIBRARIES: ("places")[] = ["places"];

const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  gestureHandling: "greedy",
};

interface Props {
  location: Location | null;
  activeDest: Destination | null;
  caneName?: string;
  isOnline: boolean;
  /** Called once with TTS text when a route is first calculated. */
  onRouteCalculated?: (text: string) => void;
}

// ── Styles ───────────────────────────────────────────────────────────────────
function useMapDotStyles() {
  useEffect(() => {
    const id = "blind-map-dot-styles";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      @keyframes blind-dot-pulse {
        0%   { transform: translate(-50%, -50%) scale(1);   opacity: 0.6; }
        70%  { transform: translate(-50%, -50%) scale(2.8); opacity: 0; }
        100% { transform: translate(-50%, -50%) scale(2.8); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }, []);
}

function CaneMarker({ isOnline }: { isOnline: boolean }) {
  return (
    <div style={{ position: "relative", transform: "translate(-50%, -50%)" }}>
      <div
        style={{
          position: "absolute", top: "50%", left: "50%",
          width: 20, height: 20, borderRadius: "50%",
          backgroundColor: isOnline ? "#4285F4" : "#93c5fd",
          animation: "blind-dot-pulse 2s ease-out infinite",
        }}
      />
      <div
        style={{
          position: "relative", zIndex: 1,
          width: 20, height: 20, borderRadius: "50%",
          backgroundColor: isOnline ? "#4285F4" : "#93c5fd",
          border: "3px solid #ffffff",
          boxShadow: "0 2px 10px rgba(66,133,244,0.5)",
          opacity: isOnline ? 1 : 0.7,
        }}
      />
    </div>
  );
}

function DestMarker({ name }: { name: string }) {
  return (
    <div style={{ position: "relative", transform: "translate(-50%, -100%)" }}>
      <div
        style={{
          width: 28, height: 28, borderRadius: "50% 50% 50% 0",
          transform: "rotate(-45deg)",
          backgroundColor: "#22c55e",
          border: "3px solid #ffffff",
          boxShadow: "0 2px 10px rgba(34,197,94,0.6)",
        }}
      />
      <div
        style={{
          position: "absolute", top: "calc(100% + 6px)", left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "rgba(17,24,39,0.92)",
          backdropFilter: "blur(4px)",
          color: "#f1f5f9",
          fontSize: 11, fontWeight: 600,
          padding: "3px 8px", borderRadius: 12,
          whiteSpace: "nowrap",
          border: "1px solid rgba(255,255,255,0.08)",
          pointerEvents: "none",
        }}
      >
        {name}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function BlindMap({ location, activeDest, caneName, isOnline, onRouteCalculated }: Props) {
  useMapDotStyles();

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: API_KEY,
    libraries: LIBRARIES,
  });

  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const lastRouteKeyRef = useRef<string | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Calculate route whenever location or activeDest changes
  useEffect(() => {
    if (!isLoaded || !location || !activeDest) {
      setDirections(null);
      lastRouteKeyRef.current = null;
      return;
    }

    const routeKey = `${location.latitude},${location.longitude}->${activeDest.id}`;
    if (routeKey === lastRouteKeyRef.current) return;
    lastRouteKeyRef.current = routeKey;

    const service = new google.maps.DirectionsService();
    service.route(
      {
        origin: { lat: location.latitude, lng: location.longitude },
        destination: { lat: activeDest.latitude, lng: activeDest.longitude },
        travelMode: google.maps.TravelMode.WALKING,
      },
      (result, status) => {
        if (status === "OK" && result) {
          setDirections(result);
          // TTS announcement
          const leg = result.routes?.[0]?.legs?.[0];
          if (leg && onRouteCalculated) {
            const dist = leg.distance?.text ?? "";
            const dur = leg.duration?.text ?? "";
            onRouteCalculated(
              `Ruta calculată. ${dist} până la ${activeDest.name}. Estimat ${dur}.`,
            );
          }
        } else {
          setDirections(null);
        }
      },
    );
  }, [isLoaded, location, activeDest, onRouteCalculated]);

  // ── Error / loading states ─────────────────────────────────────────────────
  if (!API_KEY || API_KEY === "your_google_maps_api_key_here") {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-surface-50 rounded-2xl border border-white/[0.06]">
        <p className="text-sm text-slate-500">Cheie API Google Maps lipsă.</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-surface-50 rounded-2xl border border-white/[0.06]">
        <p className="text-sm text-slate-500">Eroare la încărcarea hărții.</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-surface-50 rounded-2xl border border-white/[0.06]">
        <Spinner size="lg" />
      </div>
    );
  }

  const canePos = location
    ? { lat: location.latitude, lng: location.longitude }
    : null;

  const destPos = activeDest
    ? { lat: activeDest.latitude, lng: activeDest.longitude }
    : null;

  // Center: midpoint of cane+dest when both exist, otherwise just cane/dest
  const center = canePos
    ? destPos
      ? { lat: (canePos.lat + destPos.lat) / 2, lng: (canePos.lng + destPos.lng) / 2 }
      : canePos
    : destPos ?? { lat: 45.7661228, lng: 21.2294378 };

  const zoom = directions ? 14 : 16;

  return (
    <div className="w-full h-64 rounded-2xl overflow-hidden border border-white/[0.06]">
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={center}
        zoom={zoom}
        options={MAP_OPTIONS}
        onLoad={onMapLoad}
      >
        {/* Walking route */}
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: "#6366f1",
                strokeOpacity: 0.85,
                strokeWeight: 5,
              },
            }}
          />
        )}

        {/* Cane dot */}
        {canePos && (
          <OverlayView position={canePos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
            <CaneMarker isOnline={isOnline} />
          </OverlayView>
        )}

        {/* Destination pin */}
        {destPos && activeDest && (
          <OverlayView position={destPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
            <DestMarker name={activeDest.name} />
          </OverlayView>
        )}
      </GoogleMap>
    </div>
  );
}
