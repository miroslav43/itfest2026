"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Cane, User } from "@/types";

interface Props {
  canes: Cane[];
  onClose: () => void;
  onCreated: (user: User) => void;
}

export default function RegisterBlindUserModal({ canes, onClose, onCreated }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [caneId, setCaneId] = useState(canes[0]?.id ?? "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!caneId) return setError("Selectează un baston.");
    if (password.length < 6) return setError("Parola trebuie să aibă cel puțin 6 caractere.");

    setLoading(true);
    try {
      const user = await api.post<User>("/blind-users/", {
        email,
        password,
        cane_id: caneId,
      });
      setSuccess(`Cont creat pentru ${user.email}`);
      onCreated(user);
      setTimeout(onClose, 1500);
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
          Creează un cont pentru persoana nevăzătoare și leagă-l de bastonul său.
          Ei se vor putea autentifica cu aceste date.
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
            Baston asociat
            <select
              className="px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500 text-sm bg-white"
              value={caneId}
              onChange={(e) => setCaneId(e.target.value)}
            >
              {canes.length === 0 && <option value="">Niciun baston disponibil</option>}
              {canes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            disabled={loading || canes.length === 0}
            className="py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors mt-1"
          >
            {loading ? "Se creează contul..." : "Creează cont"}
          </button>
        </form>
      </div>
    </div>
  );
}
