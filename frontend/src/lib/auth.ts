import type { Role } from "@/types";

const TOKEN_KEY = "solemtrix_token";
const ROLE_KEY = "solemtrix_role";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string, role: Role): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, role);
}

export function getRole(): Role | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ROLE_KEY) as Role | null;
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem("solemtrix_onboarding_done");
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
