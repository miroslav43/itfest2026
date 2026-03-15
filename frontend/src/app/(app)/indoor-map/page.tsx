"use client";

import { useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { IndoorMarker, IndoorMarkerType, IndoorModel } from "@/types";
import { Logo, Button, Badge } from "@/components/ui";

const IndoorMapViewer = dynamic(
  () => import("@/components/IndoorMapViewer"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#2a2725]">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-slate-600 border-t-accent-500 rounded-full animate-spin mb-3" />
          <p className="text-sm text-slate-400">Se încarcă vizualizatorul 3D...</p>
        </div>
      </div>
    ),
  }
);

const MODELS: IndoorModel[] = [
  { name: "Clădire scanată (Part 1)", url: "/models/part1.glb" },
];

type PlacementMode = IndoorMarkerType | "view";

const MODES: { key: PlacementMode; label: string; icon: string; color: string }[] = [
  { key: "view",     label: "Vizualizare", icon: "👁",  color: "bg-slate-600" },
  { key: "start",    label: "Start",       icon: "🟢",  color: "bg-green-600" },
  { key: "end",      label: "Destinație",  icon: "🔴",  color: "bg-red-600" },
  { key: "waypoint", label: "Waypoint",    icon: "🔵",  color: "bg-blue-600" },
  { key: "obstacle", label: "Obstacol",    icon: "⚠️",  color: "bg-orange-500" },
];

let markerId = 0;

export default function IndoorMapPage() {
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [mode, setMode] = useState<PlacementMode>("view");
  const [markers, setMarkers] = useState<IndoorMarker[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [showRoute, setShowRoute] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const routePath = useMemo(() => {
    if (!showRoute) return [];
    const start = markers.find((m) => m.type === "start");
    const end = markers.find((m) => m.type === "end");
    if (!start || !end) return [];
    const waypoints = markers.filter((m) => m.type === "waypoint").map((m) => m.position);
    return [start.position, ...waypoints, end.position];
  }, [markers, showRoute]);

  const handleSurfaceClick = useCallback(
    (position: [number, number, number]) => {
      if (mode === "view") return;

      setMarkers((prev) => {
        if (mode === "start") {
          return [...prev.filter((m) => m.type !== "start"),
            { id: `m_${++markerId}`, position, type: "start" as IndoorMarkerType, label: "Start" }];
        }
        if (mode === "end") {
          return [...prev.filter((m) => m.type !== "end"),
            { id: `m_${++markerId}`, position, type: "end" as IndoorMarkerType, label: "Destinație" }];
        }
        if (mode === "obstacle") {
          return [...prev, {
            id: `m_${++markerId}`, position, type: "obstacle" as IndoorMarkerType,
            label: `Obstacol ${prev.filter((m) => m.type === "obstacle").length + 1}`,
          }];
        }
        return [...prev, {
          id: `m_${++markerId}`, position, type: "waypoint" as IndoorMarkerType,
          label: `WP ${prev.filter((m) => m.type === "waypoint").length + 1}`,
        }];
      });
    },
    [mode]
  );

  const removeMarker = useCallback((id: string) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const clearMarkers = useCallback(() => {
    setMarkers([]);
    setIsAnimating(false);
    setAnimationProgress(0);
  }, []);

  const handlePlay = () => { if (routePath.length >= 2) setIsAnimating(true); };
  const handlePause = () => setIsAnimating(false);
  const handleReset = () => { setIsAnimating(false); setAnimationProgress(0); };

  const activeMode = MODES.find((m) => m.key === mode)!;

  const stats = useMemo(() => {
    let dist = 0;
    for (let i = 1; i < routePath.length; i++) {
      const [ax, ay, az] = routePath[i - 1];
      const [bx, by, bz] = routePath[i];
      dist += Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2 + (bz - az) ** 2);
    }
    return {
      markers: markers.filter((m) => m.type !== "obstacle").length,
      obstacles: markers.filter((m) => m.type === "obstacle").length,
      routeLength: dist,
    };
  }, [markers, routePath]);

  const sidebarContent = (
    <>
      {/* Header */}
      <div className="p-4 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-accent-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <h2 className="font-bold text-slate-100 text-sm tracking-tight">Indoor Map 3D</h2>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden w-6 h-6 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <p className="text-[11px] text-slate-500">Vizualizare și simulare navigare indoor</p>
      </div>

      {/* Model */}
      <div className="p-4 border-b border-white/[0.06]">
        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Model 3D</label>
        <select
          value={selectedModel.url}
          onChange={(e) => { const m = MODELS.find((m) => m.url === e.target.value); if (m) setSelectedModel(m); }}
          className="mt-1 w-full text-sm bg-surface-200 border border-white/[0.06] rounded-xl px-3 py-2 outline-none text-slate-200 focus:border-accent-500/50 transition-colors"
        >
          {MODELS.map((m) => <option key={m.url} value={m.url}>{m.name}</option>)}
        </select>
      </div>

      {/* Mode selector */}
      <div className="p-4 border-b border-white/[0.06]">
        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Mod plasare</label>
        <div className="grid grid-cols-2 gap-1.5">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-all ${
                mode === m.key ? `${m.color} text-white shadow-sm` : "bg-surface-200 text-slate-400 hover:bg-surface-300 hover:text-slate-200"
              }`}
            >
              <span className="text-sm">{m.icon}</span>{m.label}
            </button>
          ))}
        </div>
        {mode !== "view" && (
          <p className="mt-2 text-[11px] text-accent-300 bg-accent-500/10 border border-accent-500/15 px-3 py-1.5 rounded-xl">
            Click pe model: <strong>{activeMode.label.toLowerCase()}</strong>
          </p>
        )}
      </div>

      {/* Markers list */}
      <div className="p-4 border-b border-white/[0.06] flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Marcaje ({markers.length})
          </label>
          {markers.length > 0 && (
            <button onClick={clearMarkers} className="text-[10px] text-danger-400 hover:text-danger-300 font-medium transition-colors">
              Șterge tot
            </button>
          )}
        </div>
        {markers.length === 0 ? (
          <p className="text-xs text-slate-600 italic">Niciun marcaj plasat.</p>
        ) : (
          <ul className="space-y-1">
            {markers.map((m) => (
              <li key={m.id} className="flex items-center justify-between bg-surface-200 rounded-xl px-2.5 py-2 group">
                <div className="flex items-center gap-2 min-w-0">
                  {m.type === "obstacle" ? (
                    <span className="text-xs text-orange-400">⚠</span>
                  ) : (
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{
                      backgroundColor: m.type === "start" ? "#22c55e" : m.type === "end" ? "#ef4444" : "#3b82f6",
                    }} />
                  )}
                  <span className="text-xs text-slate-300 truncate">{m.label}</span>
                </div>
                <button onClick={() => removeMarker(m.id)}
                  className="text-slate-600 hover:text-danger-400 text-xs opacity-0 group-hover:opacity-100 transition-all">
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Route & animation */}
      <div className="p-4 border-b border-white/[0.06]">
        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Simulare traseu</label>
        <label className="flex items-center gap-2 text-xs text-slate-400 mb-3 cursor-pointer">
          <input type="checkbox" checked={showRoute} onChange={(e) => setShowRoute(e.target.checked)}
            className="rounded border-white/[0.1] bg-surface-200 text-accent-500 focus:ring-accent-500/20" />
          Afișează traseu
        </label>
        <div className="flex gap-1.5 mb-3">
          {!isAnimating ? (
            <Button onClick={handlePlay} disabled={routePath.length < 2} size="sm" className="flex-1">
              ▶ Play
            </Button>
          ) : (
            <Button onClick={handlePause} variant="secondary" size="sm" className="flex-1">
              ⏸ Pauză
            </Button>
          )}
          <Button onClick={handleReset} variant="ghost" size="sm">
            ↺ Reset
          </Button>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-500">Viteză</span>
            <span className="text-[11px] font-mono text-slate-400">{animationSpeed.toFixed(1)}x</span>
          </div>
          <input type="range" min="0.1" max="5" step="0.1" value={animationSpeed}
            onChange={(e) => setAnimationSpeed(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-surface-300 rounded-lg appearance-none cursor-pointer accent-accent-500" />
        </div>
      </div>

      {/* Stats */}
      <div className="p-4">
        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Informații</label>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-accent-500/10 border border-accent-500/15 rounded-xl p-2.5 text-center">
            <span className="block text-accent-300 font-bold text-lg">{stats.markers}</span>
            <span className="text-accent-400/70 text-[10px]">Marcaje</span>
          </div>
          <div className="bg-warning-500/10 border border-warning-500/15 rounded-xl p-2.5 text-center">
            <span className="block text-warning-400 font-bold text-lg">{stats.obstacles}</span>
            <span className="text-warning-400/70 text-[10px]">Obstacole</span>
          </div>
          <div className="bg-success-500/10 border border-success-500/15 rounded-xl p-2.5 text-center">
            <span className="block text-success-400 font-bold text-lg">
              {stats.routeLength > 0 ? `${stats.routeLength.toFixed(1)}` : "—"}
            </span>
            <span className="text-success-400/70 text-[10px]">Dist.</span>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-surface-0">
      {/* Mobile toggle */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden fixed bottom-4 right-4 z-40 w-12 h-12 bg-accent-500 hover:bg-accent-600 text-white rounded-2xl shadow-glow-lg flex items-center justify-center transition-all"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-72 flex-shrink-0 bg-surface-50 border-r border-white/[0.06] flex-col overflow-y-auto">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      <aside className={`lg:hidden fixed inset-y-0 right-0 z-50 w-80 max-w-[85vw] bg-surface-50 border-l border-white/[0.06] flex flex-col overflow-y-auto transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "translate-x-full"}`}>
        {sidebarContent}
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top nav */}
        <header className="h-14 flex-shrink-0 bg-surface-50 border-b border-white/[0.06] flex items-center justify-between px-3 md:px-5">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-1.5 text-slate-400 hover:text-accent-400 transition-colors">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span className="text-xs font-medium hidden sm:inline">Înapoi</span>
            </Link>
            <div className="w-px h-5 bg-white/[0.06] mx-1" />
            <Logo size="sm" showText={false} />
            <span className="text-sm text-slate-300 font-medium hidden sm:inline">Indoor Map 3D</span>
          </div>
          <nav className="flex items-center gap-1">
            <Link href="/" className="px-2 md:px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] rounded-lg transition-colors whitespace-nowrap">
              Hartă GPS
            </Link>
            <Link href="/simulator" className="px-2 md:px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] rounded-lg transition-colors whitespace-nowrap hidden sm:block">
              Simulator
            </Link>
            <Link href="/settings" className="px-2 md:px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] rounded-lg transition-colors whitespace-nowrap hidden sm:block">
              Setări
            </Link>
          </nav>
        </header>

        <div className="flex-1 relative overflow-hidden">
          <IndoorMapViewer
            modelUrl={selectedModel.url}
            markers={markers}
            routePath={routePath}
            animationProgress={animationProgress}
            isAnimating={isAnimating}
            placementMode={mode}
            animationSpeed={animationSpeed}
            onSurfaceClick={handleSurfaceClick}
            onAnimationTick={setAnimationProgress}
          />

          {mode !== "view" && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-surface-100/90 backdrop-blur border border-white/[0.06] text-slate-200 px-4 py-2 rounded-2xl text-sm font-medium flex items-center gap-2 pointer-events-none shadow-lg">
              <span className="text-base">{activeMode.icon}</span>
              Click pe model: <strong>{activeMode.label}</strong>
            </div>
          )}

          {routePath.length >= 2 && (
            <div className="absolute bottom-4 left-4 right-4">
              <div className="bg-surface-200/80 backdrop-blur rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-accent-500 transition-all duration-100 rounded-full"
                  style={{ width: `${animationProgress * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
