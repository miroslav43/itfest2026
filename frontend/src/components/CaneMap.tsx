"use client";

import { useCallback, useRef } from "react";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import type { Location } from "@/types";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const DEFAULT_CENTER = { lat: 44.4268, lng: 26.1025 }; // București
const LIBRARIES: ("places")[] = ["places"]; // must be stable reference

const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: true,
  styles: [
    { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  ],
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

  // Update or create marker when location changes
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
          scale: 12,
          fillColor: "#2563eb",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
      });
    }
  }, [location, caneName]);

  // Remove marker when location is null
  const handleLocationCleared = useCallback(() => {
    if (!location && markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }
  }, [location]);

  if (!API_KEY || API_KEY === "your_google_maps_api_key_here") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-500 gap-2">
        <p className="font-semibold">Cheie API Google Maps lipsă</p>
        <p className="text-sm text-slate-400 text-center max-w-xs">
          Adaugă <code className="bg-slate-200 px-1 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>{" "}
          în <code className="bg-slate-200 px-1 rounded">frontend/.env.local</code>{" "}
          și repornește serverul.
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-500 gap-1">
        <p className="font-semibold">Nu s-a putut încărca harta.</p>
        <p className="text-sm text-slate-400">Verifică cheia API și conexiunea la internet.</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
        <p>Se încarcă harta…</p>
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
      onLoad={(map) => {
        onLoad(map);
        handleLocationCleared();
      }}
      onIdle={onMapIdle}
    />
  );
}
