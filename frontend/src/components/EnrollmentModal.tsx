"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Button, Input, Modal, Spinner } from "@/components/ui";
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
    <Modal title="Adaugă baston" description="Introdu codul QR de pe baston sau generează unul de test." onClose={onClose}>
      {error && (
        <div className="mb-4 px-4 py-3 bg-danger-500/10 border border-danger-500/20 text-danger-400 rounded-xl text-sm font-medium animate-fade-in">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 px-4 py-3 bg-success-500/10 border border-success-500/20 text-success-400 rounded-xl text-sm font-medium animate-fade-in">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          type="text"
          label="Cod baston"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="ex: cane_abc123"
          autoFocus
        />

        <Input
          type="text"
          label="Nume baston (opțional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex: Bastonul lui Andrei"
        />

        <button
          type="button"
          className="text-xs text-accent-400 hover:text-accent-300 text-left font-medium transition-colors"
          onClick={() => setCode(`cane_demo_${Date.now().toString(36)}`)}
        >
          + Generează cod de test
        </button>

        <Button type="submit" disabled={loading} size="lg" className="w-full">
          {loading ? <><Spinner size="sm" /> Se asociază...</> : "Asociază baston"}
        </Button>
      </form>
    </Modal>
  );
}
