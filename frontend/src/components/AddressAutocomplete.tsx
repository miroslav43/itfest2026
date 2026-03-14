"use client";

import { useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (lat: number, lng: number, formattedAddress: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Caută adresă…",
  className = "",
  autoFocus = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    // Poll until google.maps.places is available (loaded by CaneMap via useJsApiLoader)
    let attempts = 0;
    const init = () => {
      if (!inputRef.current) return;
      if (!window.google?.maps?.places) {
        if (attempts++ < 50) setTimeout(init, 200);
        return;
      }
      if (autocompleteRef.current) return;

      const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
        fields: ["formatted_address", "geometry"],
      });
      autocompleteRef.current = ac;

      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (!place.geometry?.location) return;
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const addr = place.formatted_address ?? inputRef.current?.value ?? "";
        onChange(addr);
        onSelect(lat, lng, addr);
      });
    };
    init();

    return () => {
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      autoFocus={autoFocus}
      autoComplete="off"
    />
  );
}
