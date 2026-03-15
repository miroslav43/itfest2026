"use client";

import { Suspense, useRef, useMemo, useEffect, useCallback, useState, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Canvas, useFrame, useThree, ThreeEvent } from "@react-three/fiber";
import {
  OrbitControls,
  useGLTF,
  Grid,
  Html,
  Line,
} from "@react-three/drei";
import * as THREE from "three";
import type { IndoorMarker, IndoorMarkerType } from "@/types";

const MARKER_COLORS: Record<IndoorMarkerType, string> = {
  start: "#22c55e",
  end: "#ef4444",
  waypoint: "#3b82f6",
  obstacle: "#f97316",
  router: "#38bdf8",
};

const MARKER_LABELS: Record<IndoorMarkerType, string> = {
  start: "Start",
  end: "Destinație",
  waypoint: "Punct",
  obstacle: "Obstacol",
  router: "Router",
};

const OBSTACLE_RADIUS = 0.35;

function LoadingFallback() {
  return (
    <Html center>
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-3 border-slate-500 border-t-blue-400 rounded-full animate-spin" />
        <p className="text-slate-300 text-sm font-medium">Se încarcă modelul 3D…</p>
      </div>
    </Html>
  );
}

/** Procedural placeholder shown when the GLB file is missing */
function ProceduralRoom({
  placementMode,
  onSurfaceClick,
}: {
  placementMode: string;
  onSurfaceClick: (pos: [number, number, number]) => void;
}) {
  const floorRef = useRef<THREE.Mesh>(null);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (placementMode === "view") return;
      e.stopPropagation();
      onSurfaceClick([e.point.x, e.point.y, e.point.z]);
    },
    [placementMode, onSurfaceClick]
  );

  const wallMat = new THREE.MeshStandardMaterial({ color: "#5a5755", roughness: 0.9, metalness: 0 });
  const floorMat = new THREE.MeshStandardMaterial({ color: "#3d3b39", roughness: 0.95, metalness: 0 });

  return (
    <group>
      {/* Floor */}
      <mesh ref={floorRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={handleClick}>
        <planeGeometry args={[10, 8]} />
        <primitive object={floorMat} attach="material" />
      </mesh>

      {/* Walls */}
      {/* Back */}
      <mesh position={[0, 1.5, -4]} castShadow receiveShadow>
        <boxGeometry args={[10, 3, 0.15]} />
        <primitive object={wallMat} attach="material" />
      </mesh>
      {/* Front */}
      <mesh position={[0, 1.5, 4]} castShadow receiveShadow>
        <boxGeometry args={[10, 3, 0.15]} />
        <primitive object={wallMat} attach="material" />
      </mesh>
      {/* Left */}
      <mesh position={[-5, 1.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.15, 3, 8]} />
        <primitive object={wallMat} attach="material" />
      </mesh>
      {/* Right */}
      <mesh position={[5, 1.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.15, 3, 8]} />
        <primitive object={wallMat} attach="material" />
      </mesh>

      <Html position={[0, 2.5, 0]} center distanceFactor={8}>
        <div className="bg-orange-500/90 backdrop-blur text-white text-xs px-3 py-1.5 rounded-xl font-medium select-none pointer-events-none text-center max-w-[200px]">
          ⚠ Modelul 3D lipsește<br />
          <span className="text-[10px] opacity-80">Adaugă fișierul <code>public/models/part1.glb</code></span>
        </div>
      </Html>
    </group>
  );
}

/** Error boundary that catches GLB load failures */
class ModelErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("IndoorMapViewer: model load failed —", error.message, info);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function AutoFit({ scene }: { scene: THREE.Object3D }) {
  const { camera } = useThree();
  useEffect(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180;
    const dist = (maxDim / (2 * Math.tan(fov / 2))) * 1.4;
    camera.position.set(center.x + dist * 0.6, center.y + dist * 0.5, center.z + dist * 0.6);
    camera.lookAt(center);
    (camera as THREE.PerspectiveCamera).near = 0.01;
    (camera as THREE.PerspectiveCamera).far = dist * 10;
    camera.updateProjectionMatrix();
  }, [scene, camera]);
  return null;
}

function Model({
  url,
  placementMode,
  onSurfaceClick,
}: {
  url: string;
  placementMode: string;
  onSurfaceClick: (pos: [number, number, number]) => void;
}) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    const clayMaterial = new THREE.MeshPhysicalMaterial({
      color: "#d4d0cb",
      roughness: 0.95,
      metalness: 0.0,
      clearcoat: 0.05,
      clearcoatRoughness: 0.9,
      reflectivity: 0.1,
      sheen: 0.2,
      sheenColor: new THREE.Color("#e8e4df"),
    });
    cloned.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.material = clayMaterial;
      }
    });
  }, [cloned]);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (placementMode === "view") return;
      e.stopPropagation();
      const p = e.point;
      onSurfaceClick([p.x, p.y, p.z]);
    },
    [placementMode, onSurfaceClick]
  );

  return (
    <>
      <primitive object={cloned} onClick={handleClick} />
      <AutoFit scene={cloned} />
    </>
  );
}

/* ── Marker ────────────────────────────────────────────────────────────────── */

function MarkerSphere({ marker }: { marker: IndoorMarker }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const color = MARKER_COLORS[marker.type];
  const isObstacle = marker.type === "obstacle";

  useFrame((state) => {
    if (!meshRef.current) return;
    if (marker.type === "start" || marker.type === "end") {
      meshRef.current.position.y =
        marker.position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.03;
    }
    if (isObstacle && ringRef.current) {
      const pulse = 0.3 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = pulse;
    }
  });

  if (isObstacle) {
    return (
      <group position={marker.position}>
        {/* Warning ring on floor */}
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[OBSTACLE_RADIUS * 0.6, OBSTACLE_RADIUS, 32]} />
          <meshBasicMaterial color="#f97316" transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>

        {/* Center dot */}
        <mesh position={[0, 0.04, 0]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial color="#f97316" emissive="#ea580c" emissiveIntensity={0.6} />
        </mesh>

        {/* Warning triangle icon */}
        <Html position={[0, 0.25, 0]} center distanceFactor={4}>
          <div className="bg-orange-500/90 backdrop-blur text-white text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap font-semibold select-none pointer-events-none flex items-center gap-1">
            <span>⚠</span> {marker.label}
          </div>
        </Html>
      </group>
    );
  }

  const radius = 0.08;
  return (
    <group position={marker.position}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[radius, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} transparent opacity={0.95} />
      </mesh>

      {(marker.type === "start" || marker.type === "end") && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[radius * 1.8, radius * 2.5, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.25} side={THREE.DoubleSide} />
        </mesh>
      )}

      <Html position={[0, radius + 0.18, 0]} center distanceFactor={4}>
        <div className="bg-gray-900/80 backdrop-blur text-white text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap font-medium select-none pointer-events-none">
          {marker.label || MARKER_LABELS[marker.type]}
        </div>
      </Html>
    </group>
  );
}

/* ── Router marker ─────────────────────────────────────────────────────────── */

function RouterMarker({
  marker,
  distanceToCane,
}: {
  marker: IndoorMarker;
  distanceToCane: number | null;
}) {
  const coreRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (coreRef.current) {
      coreRef.current.position.y =
        marker.position[1] + 0.06 + Math.sin(t * 2) * 0.02;
    }
    // Ripple rings outward
    const rings = [ring1Ref, ring2Ref, ring3Ref];
    rings.forEach((ref, i) => {
      if (!ref.current) return;
      const phase = (t * 0.5 + i * 0.33) % 1;
      const s = 0.5 + phase * 2.5;
      ref.current.scale.setScalar(s);
      (ref.current.material as THREE.MeshBasicMaterial).opacity =
        (1 - phase) * 0.35;
    });
  });

  const distLabel =
    distanceToCane !== null
      ? `${distanceToCane.toFixed(2)} m`
      : null;

  return (
    <group position={marker.position}>
      {/* Ripple rings on floor */}
      {[ring1Ref, ring2Ref, ring3Ref].map((ref, i) => (
        <mesh key={i} ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[0.18, 0.22, 32]} />
          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Core glowing sphere */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.1, 20, 20]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#0ea5e9"
          emissiveIntensity={1.2}
          transparent
          opacity={0.95}
        />
      </mesh>

      {/* Label with distance */}
      <Html
        position={[0, 0.35, 0]}
        center
        distanceFactor={4}
      >
        <div className="flex flex-col items-center gap-0.5 select-none pointer-events-none">
          <div className="bg-sky-500/90 backdrop-blur text-white text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 whitespace-nowrap">
            {/* WiFi icon SVG */}
            <svg width="10" height="8" viewBox="0 0 20 16" fill="none">
              <path d="M2 6a12 12 0 0116 0" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M5.5 9.5a7 7 0 019 0" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M9 13a1 1 0 002 0" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            Router
          </div>
          {distLabel && (
            <div className="bg-sky-900/80 backdrop-blur text-sky-200 text-[9px] px-2 py-0.5 rounded-full font-mono whitespace-nowrap">
              📏 {distLabel}
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}

/* ── Animated route ────────────────────────────────────────────────────────── */

function RoutePath({
  path,
  progress,
  isAnimating,
  speed,
  onTick,
  obstacles,
}: {
  path: [number, number, number][];
  progress: number;
  isAnimating: boolean;
  speed: number;
  onTick: (p: number) => void;
  obstacles: IndoorMarker[];
}) {
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!isAnimating || path.length < 2) return;
    let next = progress + delta * speed * 0.08;
    if (next >= 1) next = 0;
    onTick(next);
  });

  const currentPos = useMemo(() => {
    if (path.length < 2) return null;
    const total = path.length - 1;
    const idx = Math.min(Math.floor(progress * total), total - 1);
    const t = progress * total - idx;
    const a = path[idx];
    const b = path[Math.min(idx + 1, path.length - 1)];
    return [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ] as [number, number, number];
  }, [path, progress]);

  const isNearObstacle = useMemo(() => {
    if (!currentPos || obstacles.length === 0) return false;
    return obstacles.some((obs) => {
      const dx = currentPos[0] - obs.position[0];
      const dz = currentPos[2] - obs.position[2];
      return Math.sqrt(dx * dx + dz * dz) < OBSTACLE_RADIUS;
    });
  }, [currentPos, obstacles]);

  useFrame((state) => {
    if (!glowRef.current || !currentPos) return;
    const scale = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.3;
    glowRef.current.scale.setScalar(scale);
  });

  if (path.length < 2 || !currentPos) return null;

  const dotColor = isNearObstacle ? "#ef4444" : "#a78bfa";
  const dotEmissive = isNearObstacle ? "#dc2626" : "#7c3aed";

  return (
    <group>
      <Line points={path} color="#818cf8" lineWidth={3} dashed dashScale={15} dashSize={0.2} dashOffset={0} />
      <Line points={path} color="#4f46e5" lineWidth={1.5} />

      <mesh position={currentPos}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color={dotColor} emissive={dotEmissive} emissiveIntensity={1} />
      </mesh>

      <mesh ref={glowRef} position={currentPos}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshBasicMaterial color={dotEmissive} transparent opacity={0.15} />
      </mesh>

      <Html position={currentPos} center distanceFactor={5}>
        <div className={`text-white text-[9px] px-1.5 py-0.5 rounded-full font-mono select-none pointer-events-none -translate-y-5 ${
          isNearObstacle ? "bg-red-600/90" : "bg-indigo-600/90"
        }`}>
          {isNearObstacle ? "⚠ OBSTACOL" : `${(progress * 100).toFixed(0)}%`}
        </div>
      </Html>
    </group>
  );
}

function ContextLostHandler({ onLost }: { onLost: () => void }) {
  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const handleLost = (e: Event) => { e.preventDefault(); onLost(); };
    canvas.addEventListener("webglcontextlost", handleLost);
    return () => canvas.removeEventListener("webglcontextlost", handleLost);
  }, [gl, onLost]);
  return null;
}

/* ── Scene ─────────────────────────────────────────────────────────────────── */

interface SceneProps {
  modelUrl: string;
  markers: IndoorMarker[];
  routePath: [number, number, number][];
  animationProgress: number;
  isAnimating: boolean;
  placementMode: IndoorMarkerType | "view";
  animationSpeed: number;
  onSurfaceClick: (pos: [number, number, number]) => void;
  onAnimationTick: (p: number) => void;
  onContextLost: () => void;
}

function dist3(a: [number, number, number], b: [number, number, number]) {
  return Math.sqrt((b[0]-a[0])**2 + (b[1]-a[1])**2 + (b[2]-a[2])**2);
}

function Scene(props: SceneProps) {
  const obstacles = props.markers.filter((m) => m.type === "obstacle");
  const routerMarker = props.markers.find((m) => m.type === "router") ?? null;
  const startMarker  = props.markers.find((m) => m.type === "start")  ?? null;

  const distanceToRouter: number | null =
    routerMarker && startMarker
      ? dist3(startMarker.position, routerMarker.position)
      : null;

  return (
    <>
      <ContextLostHandler onLost={props.onContextLost} />

      <ambientLight intensity={0.8} color="#f0ede8" />
      <directionalLight
        position={[8, 14, 6]} intensity={1.2} color="#ffffff"
        castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024}
        shadow-bias={-0.001} shadow-radius={8}
      />
      <directionalLight position={[-5, 8, -6]} intensity={0.4} color="#e8e4f0" />
      <directionalLight position={[0, 3, 10]} intensity={0.2} color="#f5f0e8" />
      <hemisphereLight args={["#f0ede8", "#d4d0cb", 0.5]} />

      <ModelErrorBoundary
        fallback={
          <ProceduralRoom
            placementMode={props.placementMode}
            onSurfaceClick={props.onSurfaceClick}
          />
        }
      >
        <Suspense fallback={<LoadingFallback />}>
          <Model url={props.modelUrl} placementMode={props.placementMode} onSurfaceClick={props.onSurfaceClick} />
        </Suspense>
      </ModelErrorBoundary>

      {props.markers
        .filter((m) => m.type !== "router")
        .map((m) => <MarkerSphere key={m.id} marker={m} />)}

      {routerMarker && (
        <RouterMarker
          key={routerMarker.id}
          marker={routerMarker}
          distanceToCane={distanceToRouter}
        />
      )}

      {props.routePath.length >= 2 && (
        <RoutePath
          path={props.routePath} progress={props.animationProgress}
          isAnimating={props.isAnimating} speed={props.animationSpeed}
          onTick={props.onAnimationTick} obstacles={obstacles}
        />
      )}

      <Grid
        args={[40, 40]} cellSize={0.5} cellThickness={0.4} cellColor="#4a4744"
        sectionSize={2} sectionThickness={0.8} sectionColor="#5a5753"
        fadeDistance={25} fadeStrength={1.5} followCamera={false}
        position={[0, -0.01, 0]} infiniteGrid
      />

      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={0.3} maxDistance={50} />
    </>
  );
}

/* ── Exported wrapper ──────────────────────────────────────────────────────── */

interface IndoorMapViewerProps {
  modelUrl: string;
  markers: IndoorMarker[];
  routePath: [number, number, number][];
  animationProgress: number;
  isAnimating: boolean;
  placementMode: IndoorMarkerType | "view";
  animationSpeed: number;
  onSurfaceClick: (pos: [number, number, number]) => void;
  onAnimationTick: (p: number) => void;
}

export default function IndoorMapViewer(props: IndoorMapViewerProps) {
  const [contextLost, setContextLost] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);

  const handleContextLost = useCallback(() => setContextLost(true), []);
  const handleRetry = useCallback(() => { setContextLost(false); setCanvasKey((k) => k + 1); }, []);

  if (contextLost) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900">
        <div className="text-center max-w-sm px-6">
          <span className="text-5xl block mb-4">⚠️</span>
          <h2 className="text-lg font-bold text-white mb-2">Contextul WebGL s-a pierdut</h2>
          <p className="text-slate-400 text-sm mb-4">GPU-ul a pierdut conexiunea. Apasă pentru a reîncărca.</p>
          <button onClick={handleRetry} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm">
            ↻ Reîncarcă 3D
          </button>
        </div>
      </div>
    );
  }

  return (
    <Canvas
      key={canvasKey} camera={{ position: [5, 5, 5], fov: 50 }} shadows
      gl={{ antialias: true, powerPreference: "high-performance", failIfMajorPerformanceCaveat: false, preserveDrawingBuffer: false }}
      dpr={[1, 1.5]} style={{ background: "#2a2725" }}
    >
      <Scene {...props} onContextLost={handleContextLost} />
    </Canvas>
  );
}
