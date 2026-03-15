"use client";

import { useState, useEffect } from "react";
import { api, ApiError } from "@/lib/api";
import type { Cane, Destination, User } from "@/types";
import AddressAutocomplete from "./AddressAutocomplete";
import { Button, Input, Spinner, Badge } from "@/components/ui";

interface Props {
  canes: Cane[];
  onClose: () => void;
}

export default function ManageDestinationsModal({ onClose }: Props) {
  const [blindUsers, setBlindUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUserCane, setSelectedUserCane] = useState<Cane | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingDests, setLoadingDests] = useState(false);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    api.get<User[]>("/blind-users/my-users")
      .then((users) => { setBlindUsers(users); setLoadingUsers(false); })
      .catch(() => setLoadingUsers(false));
  }, []);

  async function selectUser(user: User) {
    setSelectedUser(user);
    setDestinations([]);
    setSelectedUserCane(null);
    setShowForm(false);
    setAddError("");
    setLoadingDests(true);
    try {
      const [dests, cane] = await Promise.all([
        api.get<Destination[]>(`/destinations/for/${user.id}`),
        api.get<Cane | null>(`/blind-users/${user.id}/cane`),
      ]);
      setDestinations(dests);
      setSelectedUserCane(cane);
    } catch {
      setDestinations([]);
    } finally {
      setLoadingDests(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser || !selectedUserCane) return;
    setAddError("");
    setAddLoading(true);
    try {
      const dest = await api.post<Destination>("/destinations/", {
        blind_user_id: selectedUser.id,
        cane_id: selectedUserCane.id,
        name,
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
      });
      setDestinations((prev) => [dest, ...prev]);
      setName(""); setLat(""); setLng(""); setAddress("");
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

  function handleAddressSelect(selLat: number, selLng: number, formattedAddress: string) {
    setLat(selLat.toFixed(7));
    setLng(selLng.toFixed(7));
    if (!name) setName(formattedAddress.split(",")[0]);
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setLat(pos.coords.latitude.toFixed(7));
      setLng(pos.coords.longitude.toFixed(7));
      setAddress("Locația mea actuală");
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface-100 border border-white/[0.06] rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-slide-up overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Gestionare destinații</h2>
            <p className="text-xs text-slate-500 mt-0.5">Adaugă și gestionează destinații pentru utilizatorii nevăzători</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Users sidebar */}
          <div className="w-52 border-r border-white/[0.06] overflow-y-auto py-2 shrink-0">
            {loadingUsers ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : blindUsers.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6 px-4 leading-relaxed">
                Nu există utilizatori nevăzători înregistrați.
              </p>
            ) : (
              blindUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => selectUser(u)}
                  className={`w-full text-left px-4 py-3 text-sm transition-all ${
                    selectedUser?.id === u.id
                      ? "bg-accent-500/10 text-accent-300 border-l-2 border-accent-500"
                      : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 border-l-2 border-transparent"
                  }`}
                >
                  <span className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold block mb-0.5">
                    Nevăzător
                  </span>
                  <span className="truncate block font-medium">{u.email}</span>
                </button>
              ))
            )}
          </div>

          {/* Content area */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {!selectedUser ? (
              <div className="flex-1 flex items-center justify-center text-slate-500 text-sm p-8 text-center">
                <div>
                  <div className="text-3xl mb-3 opacity-40">
                    <svg className="w-10 h-10 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <p>Selectează un utilizator din stânga</p>
                </div>
              </div>
            ) : (
              <>
                {/* User header + add button */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-slate-200 truncate block">{selectedUser.email}</span>
                    {selectedUserCane && (
                      <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M12 2v20M8 6l4-4 4 4" />
                        </svg>
                        {selectedUserCane.name}
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={showForm ? "ghost" : "primary"}
                    onClick={() => { setShowForm(!showForm); setAddError(""); setAddress(""); setLat(""); setLng(""); setName(""); }}
                  >
                    {showForm ? "Anulează" : "+ Adaugă"}
                  </Button>
                </div>

                {/* Add form */}
                {showForm && (
                  <form onSubmit={handleAdd} className="px-5 py-4 border-b border-white/[0.06] flex flex-col gap-3 bg-surface-200/50">
                    {addError && <p className="text-danger-400 text-xs font-medium">{addError}</p>}

                    <Input
                      placeholder="Nume destinație (ex: Acasă)"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoFocus
                    />

                    <AddressAutocomplete
                      value={address}
                      onChange={setAddress}
                      onSelect={handleAddressSelect}
                      placeholder="Caută adresă (ex: Piața Unirii, București)"
                      className="w-full px-4 py-2.5 bg-surface-200 border border-white/[0.06] rounded-xl text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-all focus:border-accent-500/50 focus:ring-2 focus:ring-accent-500/20"
                    />

                    {(lat && lng) ? (
                      <div className="flex items-center gap-2 px-3 py-2 bg-success-500/10 border border-success-500/20 rounded-xl text-xs text-success-400 font-mono">
                        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        {parseFloat(lat).toFixed(5)}, {parseFloat(lng).toFixed(5)}
                        <button type="button" onClick={() => { setLat(""); setLng(""); setAddress(""); }} className="ml-auto text-slate-500 hover:text-slate-300">
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={useMyLocation} className="text-xs text-accent-400 hover:text-accent-300 text-left font-medium transition-colors">
                        + Folosește locația mea actuală
                      </button>
                    )}

                    <input type="hidden" value={lat} required />
                    <input type="hidden" value={lng} required />

                    <Button type="submit" disabled={addLoading || !selectedUserCane || !lat || !lng} size="md" className="w-full">
                      {addLoading ? <><Spinner size="sm" /> Se salvează...</> : "Salvează destinație"}
                    </Button>
                  </form>
                )}

                {/* Destinations list */}
                <div className="flex-1 overflow-y-auto">
                  {loadingDests ? (
                    <div className="flex justify-center py-8"><Spinner /></div>
                  ) : destinations.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-10">Nicio destinație adăugată.</p>
                  ) : (
                    <ul className="py-1">
                      {destinations.map((dest) => (
                        <li key={dest.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors border-b border-white/[0.03] last:border-0">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-slate-200 truncate">{dest.name}</p>
                              {dest.active && <Badge variant="success">activă</Badge>}
                            </div>
                            <p className="text-xs text-slate-500 font-mono mt-0.5 tabular-nums">
                              {dest.latitude.toFixed(5)}, {dest.longitude.toFixed(5)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDelete(dest.id)}
                            className="text-slate-500 hover:text-danger-400 hover:bg-danger-500/10 p-2 rounded-lg transition-colors shrink-0"
                            title="Șterge destinație"
                          >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
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
