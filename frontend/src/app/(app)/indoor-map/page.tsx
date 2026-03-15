"use client";

import { useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { IndoorMarker, IndoorMarkerType, IndoorModel } from "@/types";

const IndoorMapViewer = dynamic(
  () => import("@/components/IndoorMapViewer"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#e8e4df] text-gray-400">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-gray-300 border-t-blue-400 rounded-full animate-spin mb-3" />
          <p className="text-sm">Se încarcă vizualizatorul 3D…</p>
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

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <aside className="w-72 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🏗</span>
            <h2 className="font-bold text-blue-800 text-sm tracking-tight">Indoor Map 3D</h2>
          </div>
          <p className="text-[11px] text-gray-400">Vizualizare și simulare navigare în spații interioare</p>
        </div>

        {/* Model */}
        <div className="p-4 border-b border-gray-100">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Model 3D</label>
          <select
            value={selectedModel.url}
            onChange={(e) => { const m = MODELS.find((m) => m.url === e.target.value); if (m) setSelectedModel(m); }}
            className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400"
          >
            {MODELS.map((m) => <option key={m.url} value={m.url}>{m.name}</option>)}
          </select>
        </div>

        {/* Mode selector */}
        <div className="p-4 border-b border-gray-100">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Mod plasare</label>
          <div className="grid grid-cols-2 gap-1.5">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  mode === m.key ? `${m.color} text-white shadow-sm` : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                <span className="text-sm">{m.icon}</span>{m.label}
              </button>
            ))}
          </div>
          {mode !== "view" && (
            <p className="mt-2 text-[11px] text-blue-600 bg-blue-50 px-2 py-1 rounded">
              Click pe model pentru a plasa: <strong>{activeMode.label.toLowerCase()}</strong>
            </p>
          )}
        </div>

        {/* Markers list */}
        <div className="p-4 border-b border-gray-100 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Marcaje ({markers.length})
            </label>
            {markers.length > 0 && (
              <button onClick={clearMarkers} className="text-[10px] text-red-500 hover:text-red-700 font-medium">Șterge tot</button>
            )}
          </div>
          {markers.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Niciun marcaj plasat încă.</p>
          ) : (
            <ul className="space-y-1">
              {markers.map((m) => (
                <li key={m.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-2 py-1.5 group">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {m.type === "obstacle" ? (
                      <span className="text-xs">⚠</span>
                    ) : (
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{
                        backgroundColor: m.type === "start" ? "#22c55e" : m.type === "end" ? "#ef4444" : "#3b82f6",
                      }} />
                    )}
                    <span className="text-xs text-gray-700 truncate">{m.label}</span>
                  </div>
                  <button onClick={() => removeMarker(m.id)}
                    className="text-gray-300 hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Route & animation */}
        <div className="p-4 border-b border-gray-100">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Simulare traseu</label>
          <label className="flex items-center gap-2 text-xs text-gray-600 mb-2 cursor-pointer">
            <input type="checkbox" checked={showRoute} onChange={(e) => setShowRoute(e.target.checked)} className="rounded" />
            Afișează traseu
          </label>
          <div className="flex gap-1.5 mb-3">
            {!isAnimating ? (
              <button onClick={handlePlay} disabled={routePath.length < 2}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg text-xs font-medium transition-colors">
                ▶ Play
              </button>
            ) : (
              <button onClick={handlePause}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium transition-colors">
                ⏸ Pauză
              </button>
            )}
            <button onClick={handleReset}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-medium transition-colors">
              ↺ Reset
            </button>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-gray-500">Viteză</span>
              <span className="text-[11px] font-mono text-gray-600">{animationSpeed.toFixed(1)}x</span>
            </div>
            <input type="range" min="0.1" max="5" step="0.1" value={animationSpeed}
              onChange={(e) => setAnimationSpeed(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
          </div>
        </div>

        {/* Stats */}
        <div className="p-4">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Informații</label>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-blue-50 rounded-lg p-2">
              <span className="block text-blue-800 font-bold text-base">{stats.markers}</span>
              <span className="text-blue-600">Marcaje</span>
            </div>
            <div className="bg-orange-50 rounded-lg p-2">
              <span className="block text-orange-800 font-bold text-base">{stats.obstacles}</span>
              <span className="text-orange-600">Obstacole</span>
            </div>
            <div className="bg-indigo-50 rounded-lg p-2">
              <span className="block text-indigo-800 font-bold text-base">
                {stats.routeLength > 0 ? `${stats.routeLength.toFixed(1)}` : "—"}
              </span>
              <span className="text-indigo-600">Dist.</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-13 flex-shrink-0 bg-white border-b border-gray-100 flex items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <span className="text-xl">🦯</span>
            <span className="font-bold text-blue-800 tracking-tight">Solemtrix</span>
            <span className="text-gray-300 mx-1">/</span>
            <span className="text-sm text-gray-500 font-medium">Indoor Map 3D</span>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/" className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">🗺 Hartă GPS</Link>
            <Link href="/simulator" className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">🛠 Simulator</Link>
            <Link href="/settings" className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">⚙ Setări</Link>
          </div>
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
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 pointer-events-none">
              <span className="text-base">{activeMode.icon}</span>
              Click pe model: <strong>{activeMode.label}</strong>
            </div>
          )}

          {routePath.length >= 2 && (
            <div className="absolute bottom-4 left-4 right-4">
              <div className="bg-black/50 backdrop-blur rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all duration-100"
                  style={{ width: `${animationProgress * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
