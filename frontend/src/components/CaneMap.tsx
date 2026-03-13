"use client";

import { useCallback, useRef } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import type { Location } from "@/types";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const DEFAULT_CENTER = { lat: 44.4268, lng: 26.1025 }; // București

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

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: API_KEY,
  });

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  if (loadError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400">
        <p className="font-medium">Nu s-a putut încărca harta.</p>
        <p className="text-sm mt-1">Verifică cheia API Google Maps.</p>
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
      onLoad={onLoad}
    >
      {location && (
        <Marker
          position={{ lat: location.latitude, lng: location.longitude }}
          title={caneName ?? "Baston"}
          icon={{
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 11,
            fillColor: "#2563eb",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          }}
        />
      )}
    </GoogleMap>
  );
}
