"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { getRole } from "@/lib/auth";
import { useRouter } from "next/navigation";
import type { User, Cane, Role } from "@/types";

const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  caregiver: "Aparținător",
  blind_user: "Nevăzător",
};

const ROLE_COLORS: Record<Role, string> = {
  admin: "bg-purple-100 text-purple-700",
  caregiver: "bg-blue-100 text-blue-700",
  blind_user: "bg-amber-100 text-amber-700",
};

interface Stats {
  total_users: number;
  total_caregivers: number;
  total_blind_users: number;
  total_canes: number;
}

type ModalType = "caregiver" | "blind" | null;

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [canes, setCanes] = useState<Cane[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"users" | "canes">("users");
  const [modal, setModal] = useState<ModalType>(null);

  // Caregiver form
  const [cgEmail, setCgEmail] = useState("");
  const [cgPassword, setCgPassword] = useState("");
  const [cgError, setCgError] = useState("");
  const [cgLoading, setCgLoading] = useState(false);

  // Blind user form
  const [buEmail, setBuEmail] = useState("");
  const [buPassword, setBuPassword] = useState("");
  const [buCaneName, setBuCaneName] = useState("Baston");
  const [buCaregiverId, setBuCaregiverId] = useState("");
  const [buError, setBuError] = useState("");
  const [buLoading, setBuLoading] = useState(false);

  const caregivers = users.filter((u) => u.role === "caregiver");

  useEffect(() => {
    const role = getRole();
    if (role !== "admin") { router.replace("/"); return; }
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Pre-select first caregiver when modal opens
  useEffect(() => {
    if (modal === "blind" && caregivers.length > 0 && !buCaregiverId) {
      setBuCaregiverId(caregivers[0].id);
    }
  }, [modal, caregivers, buCaregiverId]);

  async function loadData() {
    try {
      const [u, c, s] = await Promise.all([
        api.get<User[]>("/admin/users"),
        api.get<Cane[]>("/admin/canes"),
        api.get<Stats>("/admin/stats"),
      ]);
      setUsers(u);
      setCanes(c);
      setStats(s);
    } finally {
      setLoading(false);
    }
  }

  function openModal(type: ModalType) {
    setCgEmail(""); setCgPassword(""); setCgError("");
    setBuEmail(""); setBuPassword(""); setBuCaneName("Baston"); setBuCaregiverId(""); setBuError("");
    setModal(type);
  }

  async function handleRoleChange(userId: string, newRole: Role) {
    setUpdatingId(userId);
    try {
      const updated = await api.put<User>(`/admin/users/${userId}/role`, { role: newRole });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: updated.role } : u)));
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : "Eroare la schimbarea rolului.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(userId: string, email: string) {
    if (!confirm(`Ștergi contul ${email}? Această acțiune nu poate fi anulată.`)) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setStats((s) => s ? { ...s, total_users: s.total_users - 1 } : s);
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : "Eroare la ștergere.");
    }
  }

  async function handleCreateCaregiver(e: React.FormEvent) {
    e.preventDefault();
    setCgError("");
    setCgLoading(true);
    try {
      const user = await api.post<User>("/admin/users", { email: cgEmail, password: cgPassword, role: "caregiver" });
      setUsers((prev) => [...prev, user]);
      setStats((s) => s ? { ...s, total_users: s.total_users + 1, total_caregivers: s.total_caregivers + 1 } : s);
      setModal(null);
    } catch (err) {
      setCgError(err instanceof ApiError ? err.detail : "A apărut o eroare.");
    } finally {
      setCgLoading(false);
    }
  }

  async function handleCreateBlindUser(e: React.FormEvent) {
    e.preventDefault();
    setBuError("");
    if (!buCaregiverId) return setBuError("Selectează un aparținător.");
    setBuLoading(true);
    try {
      const result = await api.post<{ user: User; cane: Cane }>("/blind-users/", {
        email: buEmail,
        password: buPassword,
        cane_name: buCaneName,
        caregiver_id: buCaregiverId,
      });
      setUsers((prev) => [...prev, result.user]);
      setCanes((prev) => [...prev, result.cane]);
      setStats((s) => s ? {
        ...s,
        total_users: s.total_users + 1,
        total_blind_users: s.total_blind_users + 1,
        total_canes: s.total_canes + 1,
      } : s);
      setModal(null);
    } catch (err) {
      setBuError(err instanceof ApiError ? err.detail : "A apărut o eroare.");
    } finally {
      setBuLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Se încarcă panoul admin…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">🛡</span>
          <span className="font-bold text-blue-800 text-lg">Panou Administrator</span>
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">Solemtrix</span>
        </div>
        <Link href="/" className="text-sm text-blue-600 hover:underline">← Hartă</Link>
      </header>

      <div className="max-w-4xl mx-auto px-4 pt-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Utilizatori total", value: stats.total_users, color: "text-blue-700" },
              { label: "Aparținători", value: stats.total_caregivers, color: "text-blue-600" },
              { label: "Nevăzători", value: stats.total_blind_users, color: "text-amber-600" },
              { label: "Bastoane", value: stats.total_canes, color: "text-gray-700" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl shadow-sm p-4 text-center">
                <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs + action buttons */}
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="flex gap-0 border border-gray-200 rounded-xl overflow-hidden w-fit">
            <button onClick={() => setTab("users")} className={`px-5 py-2 text-sm font-medium transition-colors ${tab === "users" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>
              Utilizatori ({users.length})
            </button>
            <button onClick={() => setTab("canes")} className={`px-5 py-2 text-sm font-medium transition-colors ${tab === "canes" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>
              Bastoane ({canes.length})
            </button>
          </div>

          {tab === "users" && (
            <div className="flex gap-2">
              <button
                onClick={() => openModal("caregiver")}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                + Aparținător
              </button>
              <button
                onClick={() => openModal("blind")}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                + Orb
              </button>
            </div>
          )}
        </div>

        {/* Users table */}
        {tab === "users" && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Rol curent</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Schimbă rol</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Înregistrat</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-800 font-medium">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_COLORS[user.role as Role]}`}>
                        {ROLE_LABELS[user.role as Role]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:border-blue-500 disabled:opacity-40"
                        value={user.role}
                        disabled={updatingId === user.id}
                        onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                      >
                        <option value="admin">Administrator</option>
                        <option value="caregiver">Aparținător</option>
                        <option value="blind_user">Nevăzător</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(user.created_at).toLocaleDateString("ro-RO")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(user.id, user.email)}
                        className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors"
                      >
                        Șterge
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Canes table */}
        {tab === "canes" && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">ID Baston</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Nume</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Creat</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {canes.map((cane) => (
                  <tr key={cane.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{cane.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">🦯 {cane.name}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(cane.created_at).toLocaleDateString("ro-RO")}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={async () => {
                          if (!confirm(`Ștergi bastonul "${cane.name}" complet din sistem?`)) return;
                          try {
                            await api.delete(`/admin/canes/${cane.id}`);
                            setCanes((prev) => prev.filter((c) => c.id !== cane.id));
                            setStats((s) => s ? { ...s, total_canes: s.total_canes - 1 } : s);
                          } catch (err) {
                            alert(err instanceof ApiError ? err.detail : "Eroare la ștergere.");
                          }
                        }}
                        className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors"
                      >
                        Șterge
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal: Adaugă aparținător ── */}
      {modal === "caregiver" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 px-4" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-blue-800">Adaugă aparținător</h2>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            {cgError && <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{cgError}</div>}
            <form onSubmit={handleCreateCaregiver} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                Email
                <input type="email" className="px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500 text-sm" value={cgEmail} onChange={(e) => setCgEmail(e.target.value)} placeholder="aparti nator@email.com" required autoFocus />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                Parolă
                <input type="password" className="px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500 text-sm" value={cgPassword} onChange={(e) => setCgPassword(e.target.value)} placeholder="min. 6 caractere" required />
              </label>
              <button type="submit" disabled={cgLoading} className="py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors mt-1">
                {cgLoading ? "Se creează…" : "Creează cont aparținător"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Adaugă orb ── */}
      {modal === "blind" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 px-4" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-amber-700">Adaugă utilizator nevăzător</h2>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-sm text-gray-500 mb-4 leading-relaxed">
              Un baston nou va fi creat automat și atribuit aparținătorului selectat.
            </p>
            {buError && <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{buError}</div>}

            {caregivers.length === 0 ? (
              <div className="py-6 text-center text-gray-500 text-sm">
                Nu există aparținători înregistrați. Adaugă mai întâi un aparținător.
              </div>
            ) : (
              <form onSubmit={handleCreateBlindUser} className="flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Email utilizator nevăzător
                  <input type="email" className="px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500 text-sm" value={buEmail} onChange={(e) => setBuEmail(e.target.value)} placeholder="orb@email.com" required autoFocus />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Parolă
                  <input type="password" className="px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500 text-sm" value={buPassword} onChange={(e) => setBuPassword(e.target.value)} placeholder="min. 6 caractere" required />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Nume baston
                  <input type="text" className="px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500 text-sm" value={buCaneName} onChange={(e) => setBuCaneName(e.target.value)} placeholder="ex: Baston Ion" required />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Aparținător responsabil
                  <select
                    className="px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500 text-sm bg-white"
                    value={buCaregiverId}
                    onChange={(e) => setBuCaregiverId(e.target.value)}
                    required
                  >
                    {caregivers.map((c) => (
                      <option key={c.id} value={c.id}>{c.email}</option>
                    ))}
                  </select>
                </label>
                <div className="flex items-center gap-2 py-2 px-3 bg-amber-50 rounded-lg text-xs text-amber-700">
                  🦯 Bastonul „{buCaneName || "Baston"}" va fi adăugat automat în contul aparținătorului selectat.
                </div>
                <button type="submit" disabled={buLoading} className="py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors mt-1">
                  {buLoading ? "Se creează…" : "Creează cont + baston"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
