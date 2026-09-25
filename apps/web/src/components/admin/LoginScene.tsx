'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, Sparkles } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

/** Quartz point: hexagonal prism with a pyramid termination (flat facets). */
function makeCrystalGeometry() {
  const profile = [
    new THREE.Vector2(0.0001, -1.3),
    new THREE.Vector2(0.62, -0.74),
    new THREE.Vector2(0.62, 0.7),
    new THREE.Vector2(0.0001, 1.55),
  ];
  const lathe = new THREE.LatheGeometry(profile, 6);
  const flat = lathe.toNonIndexed();
  flat.computeVertexNormals();
  lathe.dispose();
  return flat;
}

interface Shard {
  home: THREE.Vector3;
  dir: THREE.Vector3;
  scale: number;
  spin: THREE.Vector3;
  rot: THREE.Euler;
  phase: number;
  offset: THREE.Vector3;
}

// deterministic pseudo-random so server/client agree and the layout is stable between renders
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeShards(count: number): Shard[] {
  const r = rng(42);
  return Array.from({ length: count }, (_, i) => {
    const angle = r() * Math.PI * 2;
    const radius = 2.6 + r() * 4.2;
    const home = new THREE.Vector3(Math.cos(angle) * radius * 1.35, Math.sin(angle) * radius * 0.8, -2.5 + r() * 3.6);
    // keep the middle clear for the login card: push shards out of the central box
    if (Math.abs(home.x) < 2.6 && Math.abs(home.y) < 3) home.x = (home.x < 0 ? -1 : 1) * (2.6 + r() * 2.2);
    return {
      home,
      dir: home.clone().normalize(),
      scale: 0.28 + r() * 0.75 + (i % 6 === 0 ? 0.4 : 0),
      spin: new THREE.Vector3((r() - 0.5) * 0.5, (r() - 0.5) * 0.7, (r() - 0.5) * 0.3),
      rot: new THREE.Euler(r() * 6, r() * 6, r() * 6),
      phase: r() * 10,
      offset: new THREE.Vector3(),
    };
  });
}

const ORBS: [number, number, number, number, string][] = [
  [-3.2, 1.6, -3.5, 0.22, '#f3dfae'],
  [3.4, -1.2, -3.2, 0.3, '#8fb6e8'],
  [0.4, 2.7, -3.8, 0.16, '#f5f0e6'],
  [-2.2, -2.4, -3.4, 0.2, '#efd9a8'],
  [2.4, 2.1, -3.6, 0.14, '#ffffff'],
];

function Scene({ burst, reduceMotion }: { burst: boolean; reduceMotion: boolean }) {
  const geometry = useMemo(makeCrystalGeometry, []);
  const shards = useMemo(() => makeShards(17), []);
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        transmission: 1,
        thickness: 1.2,
        ior: 1.55,
        roughness: 0,
        dispersion: 0.4,
        attenuationDistance: 2.2,
        attenuationColor: new THREE.Color('#fff0cc'),
        iridescence: 0.7,
        iridescenceIOR: 1.35,
        clearcoat: 1,
        envMapIntensity: 2.2,
      }),
    [],
  );

  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const hero = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const group = useRef<THREE.Group>(null);
  const burstT = useRef(0);
  const { camera } = useThree();

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const vp = state.viewport;
    if (burst) burstT.current = Math.min(burstT.current + dt / 1.15, 1);
    const b = burstT.current;
    const speed = reduceMotion ? 0.25 : 1;

    // pointer in world units (at z = 0)
    const px = state.pointer.x * vp.width * 0.5;
    const py = state.pointer.y * vp.height * 0.5;

    if (group.current) {
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, state.pointer.x * 0.12, 3, dt);
      group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -state.pointer.y * 0.08, 3, dt);
    }

    shards.forEach((s, i) => {
      const m = meshes.current[i];
      if (!m) return;
      // repel from the pointer, springing back home
      const bx = s.home.x;
      const by = s.home.y + Math.sin(t * 0.6 * speed + s.phase) * 0.22;
      const dx = bx - px;
      const dy = by - py;
      const dist = Math.hypot(dx, dy) || 0.001;
      const push = Math.max(0, 2.8 - dist) * 0.55;
      s.offset.x = THREE.MathUtils.damp(s.offset.x, (dx / dist) * push, 4, dt);
      s.offset.y = THREE.MathUtils.damp(s.offset.y, (dy / dist) * push, 4, dt);

      const fly = b * b * 16; // burst: accelerate outward
      m.position.set(
        bx + s.offset.x + s.dir.x * fly,
        by + s.offset.y + s.dir.y * fly,
        s.home.z + b * b * b * 12 + Math.sin(t * 0.4 + s.phase) * 0.2,
      );
      const spinBoost = 1 + b * 10;
      m.rotation.x += s.spin.x * dt * speed * spinBoost;
      m.rotation.y += s.spin.y * dt * speed * spinBoost;
      m.rotation.z += s.spin.z * dt * speed * spinBoost;
      m.scale.setScalar(s.scale * (1 + b * 1.2));
    });

    if (hero.current) {
      hero.current.rotation.y += dt * 0.35 * speed * (1 + b * 8);
      hero.current.rotation.z = Math.sin(t * 0.3) * 0.06;
      hero.current.position.y = Math.sin(t * 0.7 * speed) * 0.15;
      hero.current.position.z = -2.4 + b * b * b * 13; // flies through the camera
      hero.current.scale.setScalar(1.15 * (1 + b * 2.4));
    }
    if (ring.current) {
      ring.current.rotation.z += dt * 0.25 * speed;
      ring.current.rotation.x = 1.15 + Math.sin(t * 0.4) * 0.08;
      ring.current.scale.setScalar(1 + b * 3);
    }

    if (camera instanceof THREE.PerspectiveCamera) {
      const fov = 42 + b * 26;
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    }
  });

  return (
    <>
      {/* glowing shapes behind: the crystals refract these */}
      <group position={[0, 0, -3.5]}>
        {ORBS.map(([x, y, z, r, c], i) => (
          <mesh key={i} position={[x, y, z + 3.5]}>
            <icosahedronGeometry args={[r, 1]} />
            <meshBasicMaterial color={c} toneMapped={false} />
          </mesh>
        ))}
      </group>

      <group ref={group}>
        <mesh ref={ring} position={[0, 0, -1.4]} rotation={[1.15, 0, 0]}>
          <torusGeometry args={[4.1, 0.02, 16, 160]} />
          <meshBasicMaterial color="#e0bd7a" toneMapped={false} />
        </mesh>

        <group ref={hero} position={[0, 0, -2.4]}>
          <mesh geometry={geometry} material={material} />
        </group>

        {shards.map((s, i) => (
          <mesh
            key={i}
            ref={(el) => {
              meshes.current[i] = el;
            }}
            geometry={geometry}
            material={material}
            position={s.home}
            rotation={s.rot}
            scale={s.scale}
          />
        ))}
      </group>

      <Sparkles count={90} scale={[16, 9, 6]} size={3.4} speed={burst ? 2.4 : 0.35} opacity={0.9} color="#f3dfae" />

      <Environment resolution={256}>
        <group rotation={[-Math.PI / 3, 0, 1]}>
          <Lightformer form="rect" intensity={4.5} position={[0, 5, -9]} scale={[10, 10, 1]} color="#ffffff" />
          <Lightformer form="rect" intensity={3.2} position={[-6, 1, -1]} scale={[10, 2, 1]} rotation-y={Math.PI / 2} color="#ffd98a" />
          <Lightformer form="rect" intensity={3} position={[6, -1, -1]} scale={[10, 2, 1]} rotation-y={-Math.PI / 2} color="#7fa8ea" />
          <Lightformer form="ring" intensity={2.4} position={[0, 1, 6]} scale={6} color="#f5f0e6" />
          <Lightformer form="circle" intensity={2} position={[0, -6, 2]} scale={8} color="#c9a35c" />
        </group>
      </Environment>
    </>
  );
}

export default function LoginScene({ burst, onReady }: { burst: boolean; onReady?: () => void }) {
  const reduce = useRef(false);
  useEffect(() => {
    reduce.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  return (
    <Canvas
      camera={{ position: [0, 0, 9], fov: 42 }}
      dpr={[1, 1.6]}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.25;
        onReady?.();
      }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Scene burst={burst} reduceMotion={reduce.current} />
    </Canvas>
  );
}
