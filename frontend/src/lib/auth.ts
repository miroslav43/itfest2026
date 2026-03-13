const TOKEN_KEY = "solemtrix_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("solemtrix_onboarding_done");
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
