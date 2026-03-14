"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Cane, User } from "@/types";

interface BlindUserCreatedOut {
  user: User;
  cane: Cane;
}

interface Props {
  onClose: () => void;
  onCreated: (user: User, cane: Cane) => void;
}

export default function RegisterBlindUserModal({ onClose, onCreated }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [caneName, setCaneName] = useState("Baston");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (password.length < 6) return setError("Parola trebuie să aibă cel puțin 6 caractere.");

    setLoading(true);
    try {
      const result = await api.post<BlindUserCreatedOut>("/blind-users/", {
        email,
        password,
        cane_name: caneName,
      });
      setSuccess(`Cont creat pentru ${result.user.email}. Bastonul „${result.cane.name}" a fost asociat automat.`);
      onCreated(result.user, result.cane);
      setTimeout(onClose, 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "A apărut o eroare.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-blue-800">Înregistrează utilizator nevăzător</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        <p className="text-sm text-gray-500 mb-4 leading-relaxed">
          Un baston nou va fi creat automat și asociat acestui utilizator.
        </p>

        {error && (
          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{error}</div>
        )}
        {success && (
          <div className="mb-3 px-3 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Email utilizator nevăzător
            <input
              type="email"
              className="px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="orb@email.com"
              required
              autoFocus
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Parolă temporară
            <input
              type="password"
              className="px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="min. 6 caractere"
              required
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Nume baston
            <input
              type="text"
              className="px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500 text-sm"
              value={caneName}
              onChange={(e) => setCaneName(e.target.value)}
              placeholder="ex: Baston Ion"
              required
            />
          </label>

          <div className="flex items-center gap-2 py-2 px-3 bg-blue-50 rounded-lg text-xs text-blue-700">
            🦯 Bastonul „{caneName || "Baston"}" va fi creat și adăugat automat în lista ta.
          </div>

          <button
            type="submit"
            disabled={loading}
            className="py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors mt-1"
          >
            {loading ? "Se creează contul..." : "Creează cont + baston"}
          </button>
        </form>
      </div>
    </div>
  );
}
