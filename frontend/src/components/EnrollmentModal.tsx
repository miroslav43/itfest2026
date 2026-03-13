"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Cane } from "@/types";

interface Props {
  onClose: () => void;
  onEnrolled: (cane: Cane) => void;
}

export default function EnrollmentModal({ onClose, onEnrolled }: Props) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    const trimmed = code.trim();
    if (!trimmed) return setError("Introdu codul bastonului.");

    setLoading(true);
    try {
      const cane = await api.post<Cane>("/canes/enroll", {
        id: trimmed,
        name: name.trim() || "Baston",
      });
      setSuccess("Bastonul a fost asociat cu succes!");
      onEnrolled(cane);
      setTimeout(onClose, 1200);
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
          <h2 className="text-lg font-bold text-blue-800">Adaugă baston</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4 leading-relaxed">
          Introdu codul QR de pe baston (ex: <code className="bg-gray-100 px-1 rounded">cane_abc123</code>
          ) sau generează un cod de test.
        </p>

        {error && (
          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-3 px-3 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Cod baston
            <input
              type="text"
              className="px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500 text-sm transition-colors"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ex: cane_abc123"
              autoFocus
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Nume baston{" "}
            <span className="text-gray-400 font-normal">(opțional)</span>
            <input
              type="text"
              className="px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500 text-sm transition-colors"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Bastonul lui Andrei"
            />
          </label>

          {/* Quick-fill helper for testing */}
          <button
            type="button"
            className="text-xs text-blue-500 hover:underline text-left"
            onClick={() => setCode(`cane_demo_${Date.now().toString(36)}`)}
          >
            ↗ Generează cod de test
          </button>

          <button
            type="submit"
            disabled={loading}
            className="py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm mt-1"
          >
            {loading ? "Se asociază..." : "Asociază baston"}
          </button>
        </form>
      </div>
    </div>
  );
}
