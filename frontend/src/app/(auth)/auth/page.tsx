"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { setToken, isAuthenticated } from "@/lib/auth";
import type { Role } from "@/types";

type Mode = "login" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
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

    setLoading(true);
    try {
      const data = await api.post<{ access_token: string; role: Role }>(
        `/auth/${mode === "login" ? "login" : "signup"}`,
        { email, password }
      );
      setToken(data.access_token, data.role);
      // Redirect based on role
      if (data.role === "blind_user") router.push("/blind");
      else if (data.role === "admin") router.push("/admin");
      else router.push("/");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail);
      } else if (err instanceof TypeError) {
        setError("Nu s-a putut conecta la server (localhost:8000). Verifică că backend-ul rulează.");
      } else {
        setError(String(err));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-4xl">🦯</span>
          <h1 className="text-2xl font-bold text-blue-800 tracking-tight">
            Solemtrix
          </h1>
        </div>
        <p className="text-center text-gray-500 text-sm mb-6">
          {mode === "login" ? "Bine ai revenit" : "Creează cont nou"}
        </p>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Email
            <input
              type="email"
              className="px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500 text-sm transition-colors"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="adresa@email.com"
              required
              autoFocus
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Parolă
            <input
              type="password"
              className="px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500 text-sm transition-colors"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              required
            />
          </label>

          {mode === "signup" && (
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Confirmă parola
              <input
                type="password"
                className="px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500 text-sm transition-colors"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••"
                required
              />
            </label>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm"
          >
            {loading
              ? "Se procesează..."
              : mode === "login"
              ? "Intră în cont"
              : "Creează cont"}
          </button>
        </form>

        <p className="text-center mt-5 text-sm text-gray-500">
          {mode === "login" ? "Nu ai cont?" : "Ai deja cont?"}{" "}
          <button
            className="text-blue-600 font-semibold hover:underline"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "Înregistrează-te" : "Autentifică-te"}
          </button>
        </p>
      </div>
    </div>
  );
}
