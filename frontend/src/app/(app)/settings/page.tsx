"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import { Button, Card, Logo, Badge } from "@/components/ui";
import type { User, Cane } from "@/types";

const APP_VERSION = "0.1.0 MVP";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [canes, setCanes] = useState<Cane[]>([]);

  useEffect(() => {
    api.get<User>("/users/me").then(setUser).catch(() => {});
    api.get<Cane[]>("/canes/").then(setCanes).catch(() => {});
  }, []);

  function handleLogout() {
    clearToken();
    router.push("/auth");
  }

  return (
    <div className="min-h-screen bg-surface-0 py-10 px-4">
      <div className="max-w-lg mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-accent-400 transition-colors mb-6"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Înapoi la hartă
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <Logo size="sm" />
          <div className="h-5 w-px bg-white/[0.08]" />
          <h1 className="text-xl font-bold text-slate-100">Setări</h1>
        </div>

        {/* Account */}
        <Card className="p-6 mb-4">
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500 mb-4">
            Cont
          </h2>
          <Row label="Email" value={user?.email ?? "—"} />
          <Row label="Rol" value={
            user?.role === "admin" ? "Administrator"
              : user?.role === "caregiver" ? "Aparținător"
              : user?.role === "blind_user" ? "Nevăzător" : "—"
          } badge={user?.role === "admin" ? "accent" : user?.role === "caregiver" ? "success" : "warning"} />
          <Row label="Bastoane asociate" value={String(canes.length)} />
        </Card>

        {/* App */}
        <Card className="p-6 mb-4">
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500 mb-4">
            Aplicație
          </h2>
          <Row label="Versiune" value={APP_VERSION} />
          <div className="flex items-center justify-between py-3 text-sm">
            <span className="text-slate-400">Simulator locație</span>
            <Link href="/simulator" className="text-accent-400 hover:text-accent-300 transition-colors font-medium text-sm">
              Deschide
            </Link>
          </div>
        </Card>

        {/* Logout */}
        <Card className="p-6">
          <Button variant="danger" size="lg" className="w-full" onClick={handleLogout}>
            Deconectare
          </Button>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, badge }: { label: string; value: string; badge?: "accent" | "success" | "warning" }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0 text-sm">
      <span className="text-slate-400">{label}</span>
      {badge ? (
        <Badge variant={badge}>{value}</Badge>
      ) : (
        <span className="text-slate-300 text-right font-medium">{value}</span>
      )}
    </div>
  );
}
