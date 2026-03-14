"use client";

import { useState, useEffect } from "react";
import { api, ApiError } from "@/lib/api";
import type { Cane, Destination, User } from "@/types";

interface Props {
  canes: Cane[];
  onClose: () => void;
}

export default function ManageDestinationsModal({ canes, onClose }: Props) {
  const [blindUsers, setBlindUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingDests, setLoadingDests] = useState(false);

  // Add form
  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [caneId, setCaneId] = useState(canes[0]?.id ?? "");
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Load blind users linked to this caregiver's canes
  useEffect(() => {
    api.get<User[]>("/admin/users")
      .then((all) => {
        setBlindUsers(all.filter((u) => u.role === "blind_user"));
        setLoadingUsers(false);
      })
      .catch(() => {
        // Non-admin caregiver — fetch from blind-users endpoint
        // For now, show empty and let them type the id via a different approach
        setLoadingUsers(false);
      });
  }, []);

  async function loadDestinations(user: User) {
    setSelectedUser(user);
    setDestinations([]);
    setLoadingDests(true);
    try {
      const data = await api.get<Destination[]>(`/destinations/for/${user.id}`);
      setDestinations(data);
    } catch {
      setDestinations([]);
    } finally {
      setLoadingDests(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    setAddError("");
    setAddLoading(true);
    try {
      const dest = await api.post<Destination>("/destinations/", {
        blind_user_id: selectedUser.id,
        cane_id: caneId,
        name,
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
      });
      setDestinations((prev) => [dest, ...prev]);
      setName(""); setLat(""); setLng("");
      setShowForm(false);
    } catch (err) {
      setAddError(err instanceof ApiError ? err.detail : "Eroare la adăugare.");
    } finally {
      setAddLoading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/destinations/${id}`);
      setDestinations((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : "Eroare la ștergere.");
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setLat(pos.coords.latitude.toFixed(7));
      setLng(pos.coords.longitude.toFixed(7));
    });
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-blue-800">Destinații utilizatori nevăzători</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Blind users list */}
          <div className="w-44 border-r border-gray-100 overflow-y-auto py-2">
            {loadingUsers ? (
              <p className="text-xs text-gray-400 text-center py-4">Se încarcă…</p>
            ) : blindUsers.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4 px-3 leading-relaxed">
                Nu există utilizatori nevăzători înregistrați.
              </p>
            ) : (
              blindUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => { loadDestinations(u); setShowForm(false); setAddError(""); }}
                  className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                    selectedUser?.id === u.id
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-xs block text-gray-400 mb-0.5">Nevăzător</span>
                  <span className="truncate block">{u.email}</span>
                </button>
              ))
            )}
          </div>

          {/* Destinations panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedUser ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm p-6 text-center">
                Selectează un utilizator nevăzător din stânga pentru a gestiona destinațiile sale.
              </div>
            ) : (
              <>
                {/* Actions bar */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <span className="text-sm font-semibold text-gray-700 truncate max-w-[180px]">{selectedUser.email}</span>
                  <button
                    onClick={() => { setShowForm(!showForm); setAddError(""); }}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors"
                  >
                    {showForm ? "Anulează" : "+ Adaugă"}
                  </button>
                </div>

                {/* Add form */}
                {showForm && (
                  <form onSubmit={handleAdd} className="px-4 py-3 border-b border-gray-100 flex flex-col gap-2 bg-blue-50">
                    {addError && (
                      <p className="text-red-600 text-xs">{addError}</p>
                    )}
                    <input
                      className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500"
                      placeholder="Nume destinație (ex: Acasă)"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoFocus
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        step="any"
                        className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500"
                        placeholder="Latitudine"
                        value={lat}
                        onChange={(e) => setLat(e.target.value)}
                        required
                      />
                      <input
                        type="number"
                        step="any"
                        className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500"
                        placeholder="Longitudine"
                        value={lng}
                        onChange={(e) => setLng(e.target.value)}
                        required
                      />
                    </div>
                    <button
                      type="button"
                      onClick={useMyLocation}
                      className="text-xs text-blue-600 hover:underline text-left"
                    >
                      📍 Folosește locația mea actuală
                    </button>
                    {canes.length > 1 && (
                      <select
                        className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-blue-500"
                        value={caneId}
                        onChange={(e) => setCaneId(e.target.value)}
                      >
                        {canes.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    )}
                    <button
                      type="submit"
                      disabled={addLoading}
                      className="py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors"
                    >
                      {addLoading ? "Se salvează…" : "Salvează destinație"}
                    </button>
                  </form>
                )}

                {/* Destinations list */}
                <div className="flex-1 overflow-y-auto">
                  {loadingDests ? (
                    <p className="text-sm text-gray-400 text-center py-6">Se încarcă…</p>
                  ) : destinations.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">
                      Nicio destinație adăugată.
                    </p>
                  ) : (
                    <ul className="divide-y divide-gray-50">
                      {destinations.map((dest) => (
                        <li key={dest.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-gray-800 truncate">{dest.name}</p>
                              {dest.active && (
                                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">
                                  activă
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {dest.latitude.toFixed(5)}, {dest.longitude.toFixed(5)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDelete(dest.id)}
                            className="text-red-400 hover:text-red-600 text-sm px-2 py-1 rounded hover:bg-red-50 transition-colors shrink-0"
                            title="Șterge destinație"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
