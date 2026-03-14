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

interface CreateUserForm {
  email: string;
  password: string;
  role: Role;
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [canes, setCanes] = useState<Cane[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"users" | "canes">("users");

  // Create user modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateUserForm>({ email: "", password: "", role: "caregiver" });
  const [createError, setCreateError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    const role = getRole();
    if (role !== "admin") { router.replace("/"); return; }
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

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

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreateLoading(true);
    try {
      const user = await api.post<User>("/admin/users", form);
      setUsers((prev) => [...prev, user]);
      setStats((s) => s ? { ...s, total_users: s.total_users + 1 } : s);
      setForm({ email: "", password: "", role: "caregiver" });
      setShowCreate(false);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.detail : "A apărut o eroare.");
    } finally {
      setCreateLoading(false);
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
      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">🛡</span>
          <span className="font-bold text-blue-800 text-lg">Panou Administrator</span>
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
            Solemtrix
          </span>
        </div>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← Hartă
        </Link>
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

        {/* Tabs + create button */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-0 border border-gray-200 rounded-xl overflow-hidden w-fit">
            <button
              onClick={() => setTab("users")}
              className={`px-5 py-2 text-sm font-medium transition-colors ${tab === "users" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              Utilizatori ({users.length})
            </button>
            <button
              onClick={() => setTab("canes")}
              className={`px-5 py-2 text-sm font-medium transition-colors ${tab === "canes" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              Bastoane ({canes.length})
            </button>
          </div>

          {tab === "users" && (
            <button
              onClick={() => { setShowCreate(true); setCreateError(""); }}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              + Adaugă utilizator
            </button>
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
                        title="Șterge utilizator"
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
                </tr>
              </thead>
              <tbody>
                {canes.map((cane) => (
                  <tr key={cane.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{cane.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">🦯 {cane.name}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(cane.created_at).toLocaleDateString("ro-RO")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create user modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 px-4"
          onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-blue-800">Adaugă utilizator nou</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            {createError && (
              <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                Email
                <input
                  type="email"
                  className="px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500 text-sm"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="utilizator@email.com"
                  required
                  autoFocus
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                Parolă
                <input
                  type="password"
                  className="px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500 text-sm"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="min. 6 caractere"
                  required
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                Rol
                <select
                  className="px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500 text-sm bg-white"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                >
                  <option value="caregiver">Aparținător</option>
                  <option value="blind_user">Nevăzător</option>
                  <option value="admin">Administrator</option>
                </select>
              </label>

              <button
                type="submit"
                disabled={createLoading}
                className="py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors mt-1"
              >
                {createLoading ? "Se creează…" : "Creează cont"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
