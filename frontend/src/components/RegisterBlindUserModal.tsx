"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Button, Input, Modal, Spinner } from "@/components/ui";
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
      setSuccess(`Cont creat pentru ${result.user.email}. Bastonul "${result.cane.name}" a fost asociat automat.`);
      onCreated(result.user, result.cane);
      setTimeout(onClose, 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "A apărut o eroare.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Înregistrează utilizator nevăzător" description="Un baston nou va fi creat automat și asociat." onClose={onClose}>
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
          type="email"
          label="Email utilizator nevăzător"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="orb@email.com"
          required
          autoFocus
        />

        <Input
          type="password"
          label="Parolă temporară"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="min. 6 caractere"
          required
        />

        <Input
          type="text"
          label="Nume baston"
          value={caneName}
          onChange={(e) => setCaneName(e.target.value)}
          placeholder="ex: Baston Ion"
          required
        />

        <div className="flex items-center gap-2.5 py-3 px-4 bg-accent-500/8 border border-accent-500/15 rounded-xl text-xs text-accent-300">
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 2v20M8 6l4-4 4 4" />
          </svg>
          Bastonul &quot;{caneName || "Baston"}&quot; va fi creat și adăugat automat în lista ta.
        </div>

        <Button type="submit" disabled={loading} size="lg" className="w-full">
          {loading ? <><Spinner size="sm" /> Se creează contul...</> : "Creează cont + baston"}
        </Button>
      </form>
    </Modal>
  );
}
