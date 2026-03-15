"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { setToken, isAuthenticated } from "@/lib/auth";
import { Button, Input, Logo, Spinner } from "@/components/ui";
import type { Role } from "@/types";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) router.replace("/");
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (mode === "signup" && password !== confirmPassword) {
      return setError("Parolele nu coincid.");
    }
    if (mode === "signup" && password.length < 6) {
      return setError("Parola trebuie să aibă cel puțin 6 caractere.");
    }
    setLoading(true);
    try {
      const data = await api.post<{ access_token: string; role: Role }>(
        `/auth/${mode === "login" ? "login" : "signup"}`,
        { email, password }
      );
      setToken(data.access_token, data.role);
      if (data.role === "blind_user") router.push("/blind");
      else if (data.role === "admin") router.push("/admin");
      else router.push("/");
    } catch (err) {
      if (err instanceof ApiError) setError(err.detail);
      else if (err instanceof TypeError) setError("Nu s-a putut conecta la server. Verifică dacă backend-ul rulează.");
      else setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-accent-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-accent-500/8 rounded-full blur-[100px]" />
      </div>

      <div className="relative w-full max-w-[420px] animate-slide-up">
        <div className="flex justify-center mb-10">
          <Logo size="lg" />
        </div>

        <div className="bg-surface-100 border border-white/[0.06] rounded-3xl p-8 shadow-2xl">
          {/* Tab switcher */}
          <div className="flex bg-surface-200 rounded-xl p-1 mb-6">
            <button
              onClick={() => { setMode("login"); setError(""); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                mode === "login"
                  ? "bg-accent-500 text-white shadow-glow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Autentificare
            </button>
            <button
              onClick={() => { setMode("signup"); setError(""); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                mode === "signup"
                  ? "bg-accent-500 text-white shadow-glow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Cont nou
            </button>
          </div>

          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-slate-100">
              {mode === "login" ? "Bine ai revenit" : "Creează cont aparținător"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {mode === "login"
                ? "Autentifică-te pentru a continua"
                : "Înregistrează-te ca aparținător pentru a monitoriza bastoanele"}
            </p>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 bg-danger-500/10 border border-danger-500/20 text-danger-400 rounded-xl text-sm font-medium animate-fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              type="email"
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="adresa@email.com"
              required
              autoFocus
            />

            <Input
              type="password"
              label="Parolă"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

            {mode === "signup" && (
              <Input
                type="password"
                label="Confirmă parola"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            )}

            <Button type="submit" disabled={loading} size="lg" className="w-full mt-2">
              {loading ? (
                <><Spinner size="sm" /> Se procesează...</>
              ) : mode === "login" ? (
                "Intră în cont"
              ) : (
                "Creează cont"
              )}
            </Button>
          </form>

          {mode === "signup" && (
            <div className="mt-5 flex items-start gap-2.5 py-3 px-4 bg-accent-500/8 border border-accent-500/15 rounded-xl text-xs text-accent-300">
              <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              <span>Contul tău va fi de tip <strong>aparținător</strong>. Vei putea adăuga bastoane și utilizatori nevăzători pe care îi ai în grijă.</span>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Solemtrix v0.2.0 — Smart Cane Platform
        </p>
      </div>
    </div>
  );
}
