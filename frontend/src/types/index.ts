export interface User {
  id: string;
  email: string;
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

export interface ApiError {
  detail: string;
}
