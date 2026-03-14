"use client";

import { useState } from "react";
import type { Cane } from "@/types";
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
  const role = getRole();

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
    <aside className="w-56 min-w-56 bg-white border-r border-gray-100 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
        <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
          Bastoane
        </span>
      </div>

      {canes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center text-gray-400 gap-2">
          <span className="text-3xl">🦯</span>
          <p className="text-xs leading-relaxed">
            {role === "admin"
              ? "Niciun baston în sistem. Adaugă un orb pentru a genera unul automat."
              : "Niciun baston asociat. Adaugă un utilizator nevăzător pentru a genera un baston automat."}
          </p>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto py-2">
          {canes.map((cane) => (
            <li key={cane.id} className="group relative mx-1">
              <button
                onClick={() => onSelectCane(cane.id)}
                disabled={removingId === cane.id}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm rounded-lg transition-colors text-left pr-8 ${
                  cane.id === activeCaneId
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-gray-600 hover:bg-gray-50"
                } disabled:opacity-50`}
              >
                <span className="text-base shrink-0">🦯</span>
                <span className="truncate">{cane.name || "Baston"}</span>
              </button>

              <button
                onClick={(e) => handleRemove(cane, e)}
                disabled={removingId === cane.id}
                title="Elimină baston"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all disabled:opacity-30"
              >
                {removingId === cane.id ? (
                  <span className="text-[9px]">…</span>
                ) : (
                  <span className="text-xs">✕</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
