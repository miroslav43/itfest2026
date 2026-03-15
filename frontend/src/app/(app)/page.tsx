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
import { Badge, Logo, EmptyState, Spinner } from "@/components/ui";

const CaneMap = dynamic(() => import("@/components/CaneMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-surface-50">
      <Spinner size="lg" />
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

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("solemtrix_onboarding_done")) {
      setShowOnboarding(true);
    }
  }, []);

  useEffect(() => {
    api.get<Cane[]>("/canes/").then((data) => {
      setCanes(data);
      if (data.length > 0) setActiveCaneId(data[0].id);
      setLoadingCanes(false);
    }).catch(() => setLoadingCanes(false));
  }, []);

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

  useEffect(() => {
    const isOnline =
      location != null &&
      Date.now() - new Date(location.recorded_at).getTime() < STALE_MS;

    if (wasOnlineRef.current && !isOnline && activeCane) {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("Solemtrix — semnal pierdut", {
          body: `Bastonul "${activeCane.name}" nu mai trimite locație.`,
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

  function handleCaneRemoved(id: string) {
    setCanes((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (activeCaneId === id) {
        setActiveCaneId(next.length > 0 ? next[0].id : null);
        setLocation(null);
      }
      return next;
    });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-0">
      {showOnboarding && (
        <OnboardingModal onClose={() => setShowOnboarding(false)} />
      )}
      {showRegisterBlind && (
        <RegisterBlindUserModal
          onClose={() => setShowRegisterBlind(false)}
          onCreated={(_user, cane) => {
            if (cane) handleCaneAdded(cane);
            api.get<Cane[]>("/canes/").then((data) => {
              setCanes(data);
              if (!activeCaneId && data.length > 0) setActiveCaneId(data[0].id);
            }).catch(() => {});
          }}
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
        onCaneRemoved={handleCaneRemoved}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top nav */}
        <header className="h-14 flex-shrink-0 bg-surface-50 border-b border-white/[0.06] flex items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            {role === "admin" && <Badge variant="accent">Admin</Badge>}
          </div>

          <nav className="flex items-center gap-1">
            {role === "caregiver" && (
              <button
                onClick={() => setShowRegisterBlind(true)}
                className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] rounded-lg transition-colors"
              >
                + Nevăzător
              </button>
            )}
            {(role === "caregiver" || role === "admin") && canes.length > 0 && (
              <button
                onClick={() => setShowDestinations(true)}
                className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] rounded-lg transition-colors"
              >
                Destinații
              </button>
            )}
            {role === "admin" && (
              <Link href="/admin" className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] rounded-lg transition-colors">
                Admin
              </Link>
            )}
            <Link href="/simulator" className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] rounded-lg transition-colors">
              Simulator
            </Link>
            <Link href="/settings" className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] rounded-lg transition-colors">
              Setări
            </Link>
          </nav>
        </header>

        <div className="flex-1 relative overflow-hidden">
          {loadingCanes ? (
            <div className="w-full h-full flex items-center justify-center bg-surface-50">
              <Spinner size="lg" />
            </div>
          ) : canes.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center bg-surface-50">
              <EmptyState
                icon={
                  <svg className="w-12 h-12 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M12 2v20M8 6l4-4 4 4" />
                  </svg>
                }
                title="Niciun baston asociat"
                description="Adaugă un utilizator nevăzător pentru a genera automat un baston și a-l urmări pe hartă."
              />
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
