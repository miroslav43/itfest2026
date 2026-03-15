"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { setToken, isAuthenticated } from "@/lib/auth";
import { Button, Input, Logo, Spinner } from "@/components/ui";
import type { Role } from "@/types";

export default function AuthPage() {
  const router = useRouter();
  const [canSignup, setCanSignup] = useState(false);
  const [checkingCount, setCheckingCount] = useState(true);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) { router.replace("/"); return; }
    api.get<{ count: number }>("/auth/user-count")
      .then(({ count }) => setCanSignup(count === 0))
      .catch(() => {
        setCanSignup(false);
        setError(
          `Nu s-a putut conecta la server (${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}). ` +
          "Verifică că backend-ul rulează."
        );
      })
      .finally(() => setCheckingCount(false));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (mode === "signup" && password !== confirmPassword) {
      return setError("Parolele nu coincid.");
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
      else if (err instanceof TypeError)
        setError(
          `Nu s-a putut conecta la server (${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}). ` +
          "Verifică că backend-ul rulează."
        );
      else setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  if (checkingCount) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Ambient gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-accent-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-accent-500/8 rounded-full blur-[100px]" />
      </div>

      <div className="relative w-full max-w-[400px] animate-slide-up">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <Logo size="lg" />
        </div>

        {/* Card */}
        <div className="bg-surface-100 border border-white/[0.06] rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-slate-100">
              {mode === "login" ? "Bine ai revenit" : "Configurare inițială"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {mode === "login"
                ? "Autentifică-te pentru a continua"
                : "Creează contul de administrator"}
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
                <>
                  <Spinner size="sm" />
                  Se procesează...
                </>
              ) : mode === "login" ? (
                "Intră în cont"
              ) : (
                "Creează cont administrator"
              )}
            </Button>
          </form>

          {canSignup && (
            <p className="text-center mt-6 text-sm text-slate-500">
              {mode === "login" ? "Prima configurare?" : "Ai deja cont?"}{" "}
              <button
                className="text-accent-400 font-semibold hover:text-accent-300 transition-colors"
                onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
              >
                {mode === "login" ? "Creează cont admin" : "Autentifică-te"}
              </button>
            </p>
          )}

          {!canSignup && mode === "login" && (
            <p className="text-center mt-6 text-xs text-slate-600 leading-relaxed">
              Contul tău a fost creat de administrator sau de aparținătorul tău.
            </p>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-600 mt-6">
          Solemtrix v0.1.0 — Smart Cane Platform
        </p>
      </div>
    </div>
  );
}
