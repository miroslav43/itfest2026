"use client";

import { useState, useEffect } from "react";
import type { Cane, Role } from "@/types";
import { api, ApiError } from "@/lib/api";
import { getRole } from "@/lib/auth";

interface Props {
  canes: Cane[];
  activeCaneId: string | null;
  onSelectCane: (id: string) => void;
  onCaneAdded: (cane: Cane) => void;
  onCaneRemoved: (id: string) => void;
}

export default function CaneSidebar({
  canes,
  activeCaneId,
  onSelectCane,
  onCaneRemoved,
}: Props) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    setRole(getRole());
  }, []);

  async function handleRemove(cane: Cane, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Elimini bastonul "${cane.name}"?`)) return;
    setRemovingId(cane.id);
    try {
      await api.delete(`/canes/${cane.id}`);
      onCaneRemoved(cane.id);
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : "Eroare la eliminare.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <aside className="w-64 min-w-64 bg-surface-50 border-r border-white/[0.06] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
        <svg className="w-4 h-4 text-accent-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 2v20M8 6l4-4 4 4" />
        </svg>
        <span className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">
          Dispozitive
        </span>
        <span className="ml-auto text-xs font-medium text-slate-600 bg-surface-200 px-2 py-0.5 rounded-full">
          {canes.length}
        </span>
      </div>

      {canes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-surface-200 border border-white/[0.06] flex items-center justify-center">
            <svg className="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M12 2v20M8 6l4-4 4 4" />
            </svg>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            {role === "admin"
              ? "Niciun baston în sistem. Adaugă un nevăzător pentru a genera unul automat."
              : "Niciun baston asociat. Adaugă un utilizator nevăzător pentru a genera un baston."}
          </p>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto py-2 px-2">
          {canes.map((cane) => {
            const isActive = cane.id === activeCaneId;
            return (
              <li key={cane.id} className="group relative mb-0.5">
                <button
                  onClick={() => onSelectCane(cane.id)}
                  disabled={removingId === cane.id}
                  className={`w-full flex items-center gap-3 px-3 py-3 text-sm rounded-xl transition-all duration-150 text-left pr-9
                    ${isActive
                      ? "bg-accent-500/10 text-accent-300 border border-accent-500/20"
                      : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 border border-transparent"
                    } disabled:opacity-50`}
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${isActive ? "bg-accent-400" : "bg-slate-600"}`} />
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate">{cane.name || "Baston"}</span>
                    <span className="text-[10px] text-slate-600 font-mono truncate">{cane.id}</span>
                  </div>
                </button>

                <button
                  onClick={(e) => handleRemove(cane, e)}
                  disabled={removingId === cane.id}
                  title="Elimină baston"
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100
                    w-6 h-6 flex items-center justify-center rounded-lg
                    text-slate-500 hover:text-danger-400 hover:bg-danger-500/10
                    transition-all disabled:opacity-30"
                >
                  {removingId === cane.id ? (
                    <span className="text-[10px]">...</span>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
