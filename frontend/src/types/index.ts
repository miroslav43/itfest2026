export type Role = "admin" | "caregiver" | "blind_user";

export interface User {
  id: string;
  email: string;
  role: Role;
  created_at: string;
}

export interface Cane {
  id: string;
  name: string;
  created_at: string;
}

export interface Location {
  cane_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recorded_at: string;
  source: string;
}

export interface LocationHistoryPoint {
  id: string;
  cane_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recorded_at: string;
  source: string;
}

export interface Destination {
  id: string;
  blind_user_id: string;
  cane_id: string;
  name: string;
  latitude: number;
  longitude: number;
  active: boolean;
  created_at: string;
}

export interface ApiError {
  detail: string;
}

// ─── Indoor 3D Map ───────────────────────────────────────────────────────────

export type IndoorMarkerType = "start" | "end" | "waypoint" | "obstacle" | "router";

export interface IndoorMarker {
  id: string;
  position: [number, number, number];
  type: IndoorMarkerType;
  label?: string;
}

export interface IndoorModel {
  name: string;
  url: string;
}
