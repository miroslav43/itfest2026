"use client";

import { useCallback, useRef } from "react";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import type { Location } from "@/types";
import { Spinner } from "@/components/ui";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const DEFAULT_CENTER = { lat: 44.4268, lng: 26.1025 };
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

export default function CaneMap({ location, caneName }: Props) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: API_KEY,
    libraries: LIBRARIES,
  });

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const onMapIdle = useCallback(() => {
    if (!mapRef.current || !location) return;
    const pos = { lat: location.latitude, lng: location.longitude };
    if (markerRef.current) {
      markerRef.current.setPosition(pos);
    } else {
      markerRef.current = new window.google.maps.Marker({
        map: mapRef.current,
        position: pos,
        title: caneName ?? "Baston",
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: "#6366f1",
          fillOpacity: 1,
          strokeColor: "#a5b4fc",
          strokeWeight: 4,
        },
      });
    }
  }, [location, caneName]);

  const handleLocationCleared = useCallback(() => {
    if (!location && markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }
  }, [location]);

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
          Adaugă <code className="text-accent-400 bg-accent-500/10 px-1.5 py-0.5 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> în{" "}
          <code className="text-accent-400 bg-accent-500/10 px-1.5 py-0.5 rounded">frontend/.env.local</code>
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

  const center = location
    ? { lat: location.latitude, lng: location.longitude }
    : DEFAULT_CENTER;

  return (
    <GoogleMap
      mapContainerStyle={{ width: "100%", height: "100%" }}
      center={center}
      zoom={location ? 16 : 12}
      options={MAP_OPTIONS}
      onLoad={(map) => { onLoad(map); handleLocationCleared(); }}
      onIdle={onMapIdle}
    />
  );
}
