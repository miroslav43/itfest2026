"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { getRole, clearToken } from "@/lib/auth";
import { useRouter } from "next/navigation";
import type { User, Cane, Role } from "@/types";
import { Button, Input, Badge, Card, StatCard, Modal, Logo, Spinner } from "@/components/ui";

const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  caregiver: "Aparținător",
  blind_user: "Nevăzător",
};

const ROLE_BADGE: Record<Role, "accent" | "success" | "warning"> = {
  admin: "accent",
  caregiver: "success",
  blind_user: "warning",
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

  const [cgEmail, setCgEmail] = useState("");
  const [cgPassword, setCgPassword] = useState("");
  const [cgError, setCgError] = useState("");
  const [cgLoading, setCgLoading] = useState(false);

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
      setUsers(u); setCanes(c); setStats(s);
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
    if (!confirm(`Ștergi contul ${email}?`)) return;
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
    setCgError(""); setCgLoading(true);
    try {
      const user = await api.post<User>("/admin/users", { email: cgEmail, password: cgPassword, role: "caregiver" });
      setUsers((prev) => [...prev, user]);
      setStats((s) => s ? { ...s, total_users: s.total_users + 1, total_caregivers: s.total_caregivers + 1 } : s);
      setModal(null);
    } catch (err) {
      setCgError(err instanceof ApiError ? err.detail : "A apărut o eroare.");
    } finally { setCgLoading(false); }
  }

  async function handleCreateBlindUser(e: React.FormEvent) {
    e.preventDefault();
    setBuError("");
    if (!buCaregiverId) return setBuError("Selectează un aparținător.");
    setBuLoading(true);
    try {
      const result = await api.post<{ user: User; cane: Cane }>("/blind-users/", {
        email: buEmail, password: buPassword, cane_name: buCaneName, caregiver_id: buCaregiverId,
      });
      setUsers((prev) => [...prev, result.user]);
      setCanes((prev) => [...prev, result.cane]);
      setStats((s) => s ? { ...s, total_users: s.total_users + 1, total_blind_users: s.total_blind_users + 1, total_canes: s.total_canes + 1 } : s);
      setModal(null);
    } catch (err) {
      setBuError(err instanceof ApiError ? err.detail : "A apărut o eroare.");
    } finally { setBuLoading(false); }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-0 pb-10">
      {/* Header */}
      <header className="bg-surface-50 border-b border-white/[0.06] px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <Logo size="sm" />
          <div className="h-5 w-px bg-white/[0.08]" />
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-200 text-sm">Panou Administrator</span>
            <Badge variant="accent">Admin</Badge>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-slate-400 hover:text-accent-400 transition-colors flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Hartă
          </Link>
          <div className="w-px h-5 bg-white/[0.06]" />
          <button
            onClick={() => { clearToken(); router.push("/auth"); }}
            className="text-sm text-danger-400 hover:text-danger-300 hover:bg-danger-500/10 px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            Ieșire
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 pt-8">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total utilizatori" value={stats.total_users} color="accent" icon={
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v-2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>
            } />
            <StatCard label="Aparținători" value={stats.total_caregivers} color="success" icon={
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4-4V9" /><circle cx="12" cy="7" r="4" /></svg>
            } />
            <StatCard label="Nevăzători" value={stats.total_blind_users} color="warning" icon={
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="3" /><path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8" /></svg>
            } />
            <StatCard label="Bastoane" value={stats.total_canes} color="accent" icon={
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 2v20M8 6l4-4 4 4" /></svg>
            } />
          </div>
        )}

        {/* Tabs + actions */}
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div className="flex gap-1 p-1 bg-surface-100 rounded-xl border border-white/[0.06]">
            {(["users", "canes"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
                  tab === t
                    ? "bg-accent-500 text-white shadow-glow"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                }`}
              >
                {t === "users" ? `Utilizatori (${users.length})` : `Bastoane (${canes.length})`}
              </button>
            ))}
          </div>

          {tab === "users" && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => openModal("caregiver")}>
                + Aparținător
              </Button>
              <Button size="sm" variant="secondary" onClick={() => openModal("blind")}>
                + Nevăzător
              </Button>
            </div>
          )}
        </div>

        {/* Users table */}
        {tab === "users" && (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rol</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Schimbă rol</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Înregistrat</th>
                    <th className="px-5 py-3.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5 text-slate-200 font-medium">{user.email}</td>
                      <td className="px-5 py-3.5">
                        <Badge variant={ROLE_BADGE[user.role as Role]}>
                          {ROLE_LABELS[user.role as Role]}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <select
                          className="text-xs bg-surface-200 border border-white/[0.06] rounded-lg px-3 py-1.5 text-slate-300 outline-none focus:border-accent-500/50 disabled:opacity-40 cursor-pointer"
                          value={user.role}
                          disabled={updatingId === user.id}
                          onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                        >
                          <option value="admin">Administrator</option>
                          <option value="caregiver">Aparținător</option>
                          <option value="blind_user">Nevăzător</option>
                        </select>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 text-xs tabular-nums">
                        {new Date(user.created_at).toLocaleDateString("ro-RO")}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button size="sm" variant="danger" onClick={() => handleDelete(user.id, user.email)}>
                          Șterge
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Canes table */}
        {tab === "canes" && (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">ID Baston</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nume</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Creat</th>
                    <th className="px-5 py-3.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {canes.map((cane) => (
                    <tr key={cane.id} className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{cane.id}</td>
                      <td className="px-5 py-3.5 font-medium text-slate-200">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-accent-400" />
                          {cane.name}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 text-xs tabular-nums">{new Date(cane.created_at).toLocaleDateString("ro-RO")}</td>
                      <td className="px-5 py-3.5 text-right">
                        <Button size="sm" variant="danger" onClick={async () => {
                          if (!confirm(`Ștergi bastonul "${cane.name}"?`)) return;
                          try {
                            await api.delete(`/admin/canes/${cane.id}`);
                            setCanes((prev) => prev.filter((c) => c.id !== cane.id));
                            setStats((s) => s ? { ...s, total_canes: s.total_canes - 1 } : s);
                          } catch (err) {
                            alert(err instanceof ApiError ? err.detail : "Eroare la ștergere.");
                          }
                        }}>
                          Șterge
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Modal: Adaugă aparținător */}
      {modal === "caregiver" && (
        <Modal title="Adaugă aparținător" description="Creează un cont nou de tip aparținător." onClose={() => setModal(null)}>
          {cgError && (
            <div className="mb-4 px-4 py-3 bg-danger-500/10 border border-danger-500/20 text-danger-400 rounded-xl text-sm font-medium">{cgError}</div>
          )}
          <form onSubmit={handleCreateCaregiver} className="flex flex-col gap-4">
            <Input type="email" label="Email" value={cgEmail} onChange={(e) => setCgEmail(e.target.value)} placeholder="aparti nator@email.com" required autoFocus />
            <Input type="password" label="Parolă" value={cgPassword} onChange={(e) => setCgPassword(e.target.value)} placeholder="min. 6 caractere" required />
            <Button type="submit" disabled={cgLoading} size="lg" className="w-full mt-2">
              {cgLoading ? <><Spinner size="sm" /> Se creează...</> : "Creează cont aparținător"}
            </Button>
          </form>
        </Modal>
      )}

      {/* Modal: Adaugă orb */}
      {modal === "blind" && (
        <Modal title="Adaugă utilizator nevăzător" description="Un baston va fi creat automat și atribuit aparținătorului." onClose={() => setModal(null)}>
          {buError && (
            <div className="mb-4 px-4 py-3 bg-danger-500/10 border border-danger-500/20 text-danger-400 rounded-xl text-sm font-medium">{buError}</div>
          )}
          {caregivers.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">
              Nu există aparținători. Adaugă mai întâi un aparținător.
            </div>
          ) : (
            <form onSubmit={handleCreateBlindUser} className="flex flex-col gap-4">
              <Input type="email" label="Email" value={buEmail} onChange={(e) => setBuEmail(e.target.value)} placeholder="orb@email.com" required autoFocus />
              <Input type="password" label="Parolă" value={buPassword} onChange={(e) => setBuPassword(e.target.value)} placeholder="min. 6 caractere" required />
              <Input type="text" label="Nume baston" value={buCaneName} onChange={(e) => setBuCaneName(e.target.value)} placeholder="ex: Baston Ion" required />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Aparținător responsabil</label>
                <select
                  className="w-full px-4 py-2.5 bg-surface-200 border border-white/[0.06] rounded-xl text-sm text-slate-100 outline-none transition-all focus:border-accent-500/50 focus:ring-2 focus:ring-accent-500/20 cursor-pointer"
                  value={buCaregiverId}
                  onChange={(e) => setBuCaregiverId(e.target.value)}
                  required
                >
                  {caregivers.map((c) => (
                    <option key={c.id} value={c.id}>{c.email}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2.5 py-3 px-4 bg-warning-500/8 border border-warning-500/15 rounded-xl text-xs text-warning-400">
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 2v20M8 6l4-4 4 4" />
                </svg>
                Bastonul &quot;{buCaneName || "Baston"}&quot; va fi creat automat.
              </div>
              <Button type="submit" disabled={buLoading} size="lg" className="w-full mt-1">
                {buLoading ? <><Spinner size="sm" /> Se creează...</> : "Creează cont + baston"}
              </Button>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
