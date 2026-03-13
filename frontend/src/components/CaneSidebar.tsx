"use client";

import { useState } from "react";
import type { Cane } from "@/types";
import EnrollmentModal from "./EnrollmentModal";

interface Props {
  canes: Cane[];
  activeCaneId: string | null;
  onSelectCane: (id: string) => void;
  onCaneAdded: (cane: Cane) => void;
}

export default function CaneSidebar({
  canes,
  activeCaneId,
  onSelectCane,
  onCaneAdded,
}: Props) {
  const [showEnroll, setShowEnroll] = useState(false);

  return (
    <>
      <aside className="w-56 min-w-56 bg-white border-r border-gray-100 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
          <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
            Bastoane
          </span>
          <button
            onClick={() => setShowEnroll(true)}
            title="Adaugă baston"
            className="w-7 h-7 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-lg font-bold leading-none transition-colors"
          >
            +
          </button>
        </div>

        {canes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-4 text-center text-gray-400 gap-2">
            <span className="text-3xl">🦯</span>
            <p className="text-xs leading-relaxed">
              Nu ai niciun baston asociat.{" "}
              <button
                className="text-blue-500 hover:underline font-medium"
                onClick={() => setShowEnroll(true)}
              >
                Adaugă primul
              </button>
              .
            </p>
          </div>
        ) : (
          <ul className="flex-1 overflow-y-auto py-2">
            {canes.map((cane) => (
              <li key={cane.id}>
                <button
                  onClick={() => onSelectCane(cane.id)}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg mx-1 transition-colors text-left ${
                    cane.id === activeCaneId
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                  style={{ width: "calc(100% - 8px)" }}
                >
                  <span className="text-base shrink-0">🦯</span>
                  <span className="truncate">{cane.name || "Baston"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {showEnroll && (
        <EnrollmentModal
          onClose={() => setShowEnroll(false)}
          onEnrolled={(cane) => {
            onCaneAdded(cane);
            setShowEnroll(false);
          }}
        />
      )}
    </>
  );
}
