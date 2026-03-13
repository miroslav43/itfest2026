"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { clearToken } from "@/lib/auth";
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
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-md mx-auto">
        <Link
          href="/"
          className="inline-block text-sm text-blue-600 hover:underline mb-4"
        >
          ← Înapoi la hartă
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Setări</h1>

        {/* Account */}
        <section className="bg-white rounded-2xl shadow-sm p-5 mb-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
            Cont
          </h2>
          <Row label="Email" value={user?.email ?? "—"} />
          <Row label="Bastoane asociate" value={String(canes.length)} />
        </section>

        {/* App */}
        <section className="bg-white rounded-2xl shadow-sm p-5 mb-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
            Aplicație
          </h2>
          <Row label="Versiune" value={APP_VERSION} />
          <div className="flex items-center justify-between py-2 text-sm">
            <span className="text-gray-600">Simulator locație</span>
            <Link href="/simulator" className="text-blue-600 hover:underline">
              Deschide →
            </Link>
          </div>
        </section>

        {/* Logout */}
        <section className="bg-white rounded-2xl shadow-sm p-5">
          <button
            onClick={handleLogout}
            className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-semibold rounded-xl transition-colors text-sm"
          >
            Deconectare
          </button>
        </section>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="text-gray-400 text-right break-all">{value}</span>
    </div>
  );
}
