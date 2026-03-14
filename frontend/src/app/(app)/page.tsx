"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { api } from "@/lib/api";
import { getRole } from "@/lib/auth";
import type { Cane, Location } from "@/types";
import CaneSidebar from "@/components/CaneSidebar";
import LocationPanel from "@/components/LocationPanel";
import OnboardingModal from "@/components/OnboardingModal";
import RegisterBlindUserModal from "@/components/RegisterBlindUserModal";
import ManageDestinationsModal from "@/components/ManageDestinationsModal";

const CaneMap = dynamic(() => import("@/components/CaneMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
      <p>Se încarcă harta…</p>
    </div>
  ),
});

const POLL_INTERVAL_MS = 3000;
const STALE_MS = 5 * 60 * 1000;

export default function TrackingPage() {
  const [canes, setCanes] = useState<Cane[]>([]);
  const [activeCaneId, setActiveCaneId] = useState<string | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [loadingCanes, setLoadingCanes] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showRegisterBlind, setShowRegisterBlind] = useState(false);
  const [showDestinations, setShowDestinations] = useState(false);
  const wasOnlineRef = useRef(false);
  const role = getRole();

  const activeCane = canes.find((c) => c.id === activeCaneId) ?? null;

  // Request notification permission once
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Onboarding
  useEffect(() => {
    if (!localStorage.getItem("solemtrix_onboarding_done")) {
      setShowOnboarding(true);
    }
  }, []);

  // Load canes
  useEffect(() => {
    api.get<Cane[]>("/canes/").then((data) => {
      setCanes(data);
      if (data.length > 0) setActiveCaneId(data[0].id);
      setLoadingCanes(false);
    }).catch(() => setLoadingCanes(false));
  }, []);

  // Poll location
  const fetchLocation = useCallback(() => {
    if (!activeCaneId) return;
    api.get<Location | null>(`/locations/${activeCaneId}/latest`)
      .then((data) => setLocation(data))
      .catch(() => {});
  }, [activeCaneId]);

  useEffect(() => {
    setLocation(null);
    fetchLocation();
    const interval = setInterval(fetchLocation, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchLocation]);

  // Browser notification when GPS goes offline
  useEffect(() => {
    const isOnline =
      location != null &&
      Date.now() - new Date(location.recorded_at).getTime() < STALE_MS;

    if (wasOnlineRef.current && !isOnline && activeCane) {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("Solemtrix — semnal pierdut", {
          body: `Bastonul "${activeCane.name}" nu mai trimite locație.`,
          icon: "/favicon.svg",
        });
      }
    }
    wasOnlineRef.current = isOnline;
  }, [location, activeCane]);

  function handleCaneAdded(cane: Cane) {
    setCanes((prev) => {
      if (prev.find((c) => c.id === cane.id)) return prev;
      return [...prev, cane];
    });
    setActiveCaneId(cane.id);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {showOnboarding && (
        <OnboardingModal onClose={() => setShowOnboarding(false)} />
      )}
      {showRegisterBlind && (
        <RegisterBlindUserModal
          canes={canes}
          onClose={() => setShowRegisterBlind(false)}
          onCreated={() => {}}
        />
      )}
      {showDestinations && (
        <ManageDestinationsModal
          canes={canes}
          onClose={() => setShowDestinations(false)}
        />
      )}

      <CaneSidebar
        canes={canes}
        activeCaneId={activeCaneId}
        onSelectCane={(id) => { setActiveCaneId(id); setLocation(null); }}
        onCaneAdded={handleCaneAdded}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-13 flex-shrink-0 bg-white border-b border-gray-100 flex items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <span className="text-xl">🦯</span>
            <span className="font-bold text-blue-800 tracking-tight">Solemtrix</span>
            {role === "admin" && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold ml-1">
                Admin
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {(role === "caregiver" || role === "admin") && canes.length > 0 && (
              <>
                <button
                  onClick={() => setShowRegisterBlind(true)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Înregistrează utilizator nevăzător"
                >
                  👤+ Orb
                </button>
                <button
                  onClick={() => setShowDestinations(true)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Gestionează destinații nevăzători"
                >
                  📍 Destinații
                </button>
              </>
            )}
            {role === "admin" && (
              <Link
                href="/admin"
                className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                🛡 Admin
              </Link>
            )}
            <Link href="/simulator" className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
              🛠 Simulator
            </Link>
            <Link href="/settings" className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
              ⚙ Setări
            </Link>
          </div>
        </header>

        <div className="flex-1 relative overflow-hidden">
          {loadingCanes ? (
            <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
              <p>Se încarcă…</p>
            </div>
          ) : canes.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center bg-slate-50">
              <div className="text-center max-w-sm px-6">
                <span className="text-6xl block mb-4">🦯</span>
                <h2 className="text-xl font-bold text-blue-800 mb-2">Niciun baston asociat</h2>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Apasă butonul <strong>+</strong> din bara laterală pentru a
                  asocia primul tău baston prin codul QR.
                </p>
              </div>
            </div>
          ) : (
            <>
              <CaneMap location={location} caneName={activeCane?.name} />
              {activeCane && <LocationPanel cane={activeCane} location={location} />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
