'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, Sparkles } from '@react-three/drei';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';

export const CRYSTAL_VARIANTS = [
  { name: 'Quartzo cristal', attenuation: '#fff3d6', sheen: '#ffe7b0' }, // como o cristal da logo
  { name: 'Champanhe', attenuation: '#e8c98a', sheen: '#f3dfae' },
  { name: 'Safira', attenuation: '#4f86e0', sheen: '#dbe7fb' },
  { name: 'Ametista', attenuation: '#a37bff', sheen: '#d9c6ff' },
] as const;

/** Ponta de quartzo: prisma hexagonal com terminação em pirâmide (facetas planas). */
function makeCrystalGeometry() {
  const profile = [
    new THREE.Vector2(0.0001, -1.3),
    new THREE.Vector2(0.62, -0.74),
    new THREE.Vector2(0.62, 0.7),
    new THREE.Vector2(0.0001, 1.55),
  ];
  const lathe = new THREE.LatheGeometry(profile, 6);
  const flat = lathe.toNonIndexed(); // vértices não compartilhados → normais por face → aspecto lapidado
  flat.computeVertexNormals();
  lathe.dispose();
  return flat;
}

// Cristais menores ao redor do principal: [posição, rotação, escala]
const CLUSTER: [[number, number, number], [number, number, number], number][] = [
  [[-0.98, -0.42, 0.25], [0.15, 0.5, 0.62], 0.5],
  [[0.95, -0.5, -0.1], [-0.1, 1.1, -0.66], 0.44],
  [[-0.32, -0.62, 0.82], [0.72, 0.2, 0.18], 0.36],
  [[0.5, -0.7, -0.8], [-0.7, 0.9, -0.12], 0.4],
  [[1.25, -0.25, 0.55], [0.3, 0.4, -0.95], 0.28],
];

// Orbes luminosos atrás do cristal: são o que ele refrata (o fundo da página é transparente).
const ORBS: [number, number, number, number, string][] = [
  [-1.6, 1.2, 0, 0.16, '#f3dfae'],
  [1.7, 1.5, -0.5, 0.11, '#8fb6e8'],
  [-0.2, -1.7, 0.3, 0.2, '#efd9a8'],
  [1.9, -0.9, 0, 0.14, '#f5f0e6'],
  [-2.0, -0.6, -0.4, 0.09, '#8fb6e8'],
  [0.3, 1.9, -0.6, 0.08, '#f5f0e6'],
  [0.9, 0.2, 0.6, 0.06, '#ffffff'],
];

const damp = THREE.MathUtils.damp;

interface SceneProps {
  /** Index into CRYSTAL_VARIANTS (the display names are localized in the i18n messages). */
  onVariant: (index: number) => void;
  reduceMotion: boolean;
}

function Crystal({ onVariant, reduceMotion }: SceneProps) {
  const group = useRef<THREE.Group>(null);
  const backdrop = useRef<THREE.Group>(null);
  const geometry = useMemo(makeCrystalGeometry, []);
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        transmission: 1,
        thickness: 1.5,
        ior: 1.55,
        roughness: 0.0,
        metalness: 0,
        dispersion: 0.35,
        attenuationDistance: 2.4,
        attenuationColor: new THREE.Color(CRYSTAL_VARIANTS[0].attenuation),
        sheen: 0.6,
        sheenColor: new THREE.Color(CRYSTAL_VARIANTS[0].sheen),
        iridescence: 0.7,
        iridescenceIOR: 1.35,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        envMapIntensity: 2.2,
        specularIntensity: 1,
      }),
    [],
  );

  const { viewport, size, events, gl } = useThree();
  const state = useRef({
    variant: 0,
    vel: 0, // velocidade angular extra vinda do arraste
    pulse: 0,
    hovered: false,
    dragging: false,
    lastX: 0,
    downX: 0,
    downY: 0,
    moved: 0,
  });
  const targetAttenuation = useMemo(() => new THREE.Color(), []);
  const targetSheen = useMemo(() => new THREE.Color(), []);

  // Arraste / clique nativos no elemento que recebe os eventos (a seção inteira do hero).
  useEffect(() => {
    const el = (events.connected as HTMLElement | undefined) ?? gl.domElement;
    const s = state.current;

    const down = (e: PointerEvent) => {
      s.downX = e.clientX;
      s.downY = e.clientY;
      s.lastX = e.clientX;
      s.moved = 0;
      s.dragging = s.hovered;
    };
    const move = (e: PointerEvent) => {
      if (!s.dragging) return;
      const dx = e.clientX - s.lastX;
      s.lastX = e.clientX;
      s.moved = Math.max(s.moved, Math.hypot(e.clientX - s.downX, e.clientY - s.downY));
      if (group.current) group.current.rotation.y += dx * 0.011;
      s.vel = THREE.MathUtils.clamp(dx * 0.011 * 55, -14, 14);
    };
    const up = () => {
      if (s.dragging && s.moved < 6) {
        s.variant = (s.variant + 1) % CRYSTAL_VARIANTS.length;
        s.pulse = 1;
        onVariant(s.variant);
      }
      s.dragging = false;
    };

    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [events.connected, gl.domElement, onVariant]);

  useFrame((frame, delta) => {
    const g = group.current;
    if (!g) return;
    const s = state.current;
    const dt = Math.min(delta, 0.05);
    const t = frame.clock.elapsedTime;

    // Layout responsivo: à direita do texto no desktop; abaixo do texto em tablet/celular.
    const wide = window.innerWidth >= 1024; // mesmo breakpoint (lg) do CSS do hero
    const unit = viewport.height / size.height; // unidades 3D por pixel
    const svh = window.innerHeight / 100;
    // Celular/tablet: o cristal ocupa o topo (46svh, abaixo da navbar de 72px) e o texto vem depois.
    const topArea = 46 * svh;
    const fit = wide
      ? Math.min((viewport.height * 0.78) / 2.9, (viewport.width * 0.4) / 3.3)
      : Math.min((unit * (topArea - 88)) / 2.9, (viewport.width * 0.8) / 3.3);
    const px = wide ? viewport.width * 0.24 : 0;
    const py = wide ? 0 : viewport.height / 2 - unit * ((72 + topArea) / 2);

    // rotação: automática + inércia do arraste
    s.vel = damp(s.vel, 0, 2.2, dt);
    if (!s.dragging) g.rotation.y += ((reduceMotion ? 0.05 : 0.32) + s.vel) * dt;

    // inclinação suave seguindo o mouse
    const px01 = frame.pointer.x;
    const py01 = frame.pointer.y;
    g.rotation.x = damp(g.rotation.x, -py01 * 0.28 + Math.sin(t * 0.6) * 0.05, 4, dt);
    g.rotation.z = damp(g.rotation.z, px01 * 0.1, 4, dt);

    g.position.x = damp(g.position.x, px + px01 * 0.18, 3, dt);
    g.position.y = damp(g.position.y, py + Math.sin(t * 0.9) * 0.07 + py01 * 0.08, 3, dt);

    s.pulse = damp(s.pulse, 0, 4.5, dt);
    const targetScale = fit * (1 + s.pulse * 0.14 + (s.hovered ? 0.03 : 0));
    g.scale.setScalar(damp(g.scale.x, targetScale, 6, dt));

    // transição de cor entre tipos de cristal
    const v = CRYSTAL_VARIANTS[s.variant];
    targetAttenuation.set(v.attenuation);
    targetSheen.set(v.sheen);
    const k = 1 - Math.exp(-4 * dt);
    material.attenuationColor.lerp(targetAttenuation, k);
    material.sheenColor.lerp(targetSheen, k);

    // barras de luz atrás do cristal: são elas que ele "refrata"
    if (backdrop.current) {
      backdrop.current.position.x = damp(backdrop.current.position.x, px, 3, dt);
      backdrop.current.position.y = damp(backdrop.current.position.y, py, 3, dt);
      backdrop.current.rotation.z = Math.sin(t * 0.25) * 0.12;
      backdrop.current.scale.setScalar(damp(backdrop.current.scale.x, fit * 0.85, 4, dt));
    }
  });

  const setHover = (v: boolean) => {
    state.current.hovered = v;
    gl.domElement.style.cursor = v ? 'grab' : '';
  };

  return (
    <>
      <group ref={backdrop} position={[0, 0, -3]}>
        {ORBS.map(([x, y, z, r, c], i) => (
          <mesh key={i} position={[x, y, z]}>
            <icosahedronGeometry args={[r, 1]} />
            <meshBasicMaterial color={c} toneMapped={false} />
          </mesh>
        ))}
        <mesh rotation={[0.25, 0.3, 0]}>
          <torusGeometry args={[2.2, 0.018, 16, 140]} />
          <meshBasicMaterial color="#a8843f" toneMapped={false} />
        </mesh>
      </group>

      <group
        ref={group}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
        }}
        onPointerOut={() => setHover(false)}
      >
        <mesh geometry={geometry} material={material} />
        {CLUSTER.map(([pos, rot, sc], i) => (
          <mesh key={i} geometry={geometry} material={material} position={pos} rotation={rot} scale={sc} />
        ))}
      </group>

      <Sparkles count={70} scale={[9, 6, 4]} size={3.2} speed={0.35} opacity={0.85} color="#f3dfae" />

      {/* Luzes de estúdio geradas em runtime: sem baixar HDRI externo */}
      <Environment resolution={256}>
        <group rotation={[-Math.PI / 3, 0, 1]}>
          <Lightformer form="rect" intensity={4.5} position={[0, 5, -9]} scale={[10, 10, 1]} color="#ffffff" />
          <Lightformer form="rect" intensity={3.2} position={[-6, 1, -1]} scale={[10, 2, 1]} rotation-y={Math.PI / 2} color="#ffd98a" />
          <Lightformer form="rect" intensity={3} position={[6, -1, -1]} scale={[10, 2, 1]} rotation-y={-Math.PI / 2} color="#8fb6e8" />
          <Lightformer form="ring" intensity={2.4} position={[0, 1, 6]} scale={6} color="#f5f0e6" />
          <Lightformer form="circle" intensity={2} position={[0, -6, 2]} scale={8} color="#c9a35c" />
        </group>
      </Environment>
    </>
  );
}

export default function CrystalScene({
  eventSource,
  active,
  onVariant,
  reduceMotion,
  onReady,
}: SceneProps & {
  eventSource: RefObject<HTMLElement | null>;
  active: boolean;
  onReady?: () => void;
}) {
  return (
    <Canvas
      camera={{ position: [0, 0, 7], fov: 35 }}
      dpr={[1, 1.75]}
      frameloop={active ? 'always' : 'never'}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      eventSource={eventSource as RefObject<HTMLElement>}
      eventPrefix="client"
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.3;
        onReady?.();
      }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Crystal onVariant={onVariant} reduceMotion={reduceMotion} />
    </Canvas>
  );
}
