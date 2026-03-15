"use client";

import { Suspense, useRef, useMemo, useEffect, useCallback, useState } from "react";
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
};

const MARKER_LABELS: Record<IndoorMarkerType, string> = {
  start: "Start",
  end: "Destinație",
  waypoint: "Punct",
  obstacle: "Obstacol",
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

function Scene(props: SceneProps) {
  const obstacles = props.markers.filter((m) => m.type === "obstacle");

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

      <Suspense fallback={<LoadingFallback />}>
        <Model url={props.modelUrl} placementMode={props.placementMode} onSurfaceClick={props.onSurfaceClick} />
      </Suspense>

      {props.markers.map((m) => <MarkerSphere key={m.id} marker={m} />)}

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
